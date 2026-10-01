/**
 * The game world, advanced one 16th step at a time by the transport tick. Pure: no audio, no drawing.
 *
 * Order inside a step:
 *   1. towers queued last bar go live (bar starts only)
 *   2. due enemies spawn
 *   3. enemies move (stun freezes, slow scales speed); enemies past the end reach the core
 *   4. towers with an enemy in range start or keep playing; they hold to the end of the bar
 *   5. drums and playing towers sound on their pattern steps; playing towers attack on those steps
 *   6. dead enemies pay their bounty
 */

import type { Tuning } from '../config/tuning';
import { stepAt, type HitKind, type Pattern } from '../music/patterns';
import { nextBarStart, stepToPosition } from '../music/timing';
import { dbToGain } from '../audio/curves';
import { Board, type Tower } from './board';
import { DRUM_DEFS, DRUM_ORDER } from './core';
import type { EnemyType } from './enemies';
import { isCoreCell, type Cell } from './grid';
import type { InstrumentId } from './instruments';
import { distance, PathGeometry, type Point } from './path';
import { TOWER_DEFS, TOWER_TYPES, type TowerType } from './towers';
import { WaveClock, type WaveStatus } from './waves';

export interface Enemy {
  readonly id: number;
  readonly type: EnemyType;
  hp: number;
  readonly maxHp: number;
  /** Distance walked along the path, in cells. */
  progress: number;
  stunLeft: number;
  slowLeft: number;
  slowAmount: number;
}

export interface TowerStats {
  cost: number;
  damage: number;
  range: number;
  stun: number;
  slow: number;
  slowSteps: number;
}

export function towerStats(t: Readonly<Tuning>, type: TowerType): TowerStats {
  return t[`${type}Tower`];
}

export interface SoundHit {
  instrument: InstrumentId;
  kind: HitKind;
  /** Which hit of the bar this is (0 = first). Melodic voices use it to pick notes. */
  hitIndex: number;
  /** Extra gain on top of the hit's velocity (idle towers play quieter). */
  gain: number;
}

export interface Attack {
  towerId: number;
  type: TowerType;
  targets: number[];
  /** Where each target was when hit, in cell units. */
  points: Point[];
}

export interface EnemySnapshot {
  id: number;
  type: EnemyType;
  progress: number;
  /** Cells it will move on the next step, for smooth drawing between ticks. */
  nextMove: number;
  hp: number;
  maxHp: number;
  stunned: boolean;
  slowed: boolean;
}

export interface StepResult {
  step: number;
  entered: Tower[];
  hits: SoundHit[];
  attacks: Attack[];
  kills: { id: number; type: EnemyType; point: Point; bounty: number }[];
  leaks: { id: number; type: EnemyType }[];
  /** Tower ids playing on this step. */
  playingTowers: Set<number>;
  /** Tower layers sounding on this step (at full or idle volume). */
  playingLayers: Set<TowerType>;
  enemies: EnemySnapshot[];
  waves: WaveStatus;
}

export type PlaceResult = { ok: true; tower: Tower } | { ok: false; reason: 'blocked' | 'money' };

export function hitIndexAt(pattern: Pattern, stepInBar: number): number {
  let n = 0;
  for (let i = 0; i < stepInBar; i++) if (pattern[i]) n++;
  return n;
}

export class World {
  readonly board: Board;
  readonly path: PathGeometry;
  readonly waves = new WaveClock();
  readonly enemies = new Map<number, Enemy>();
  money: number;
  leaked = 0;
  killed = 0;
  private nextEnemyId = 1;
  /** Step (exclusive) each tower keeps playing until. */
  private playUntil = new Map<number, number>();

  constructor(
    board: Board,
    t: Readonly<Tuning>,
  ) {
    this.board = board;
    this.path = new PathGeometry(board.layout);
    this.money = t.economy.startMoney;
  }

  towerCenter(c: Cell): Point {
    return { x: c.col + 0.5, y: c.row + 0.5 };
  }

  enemyPoint(e: { progress: number }): Point {
    return this.path.pointAt(e.progress);
  }

  canBuild(cell: Cell, ignoreId?: number): boolean {
    return !isCoreCell(this.board.layout, cell) && this.board.canPlace(cell, ignoreId);
  }

  place(type: TowerType, cell: Cell, t: Readonly<Tuning>): PlaceResult {
    if (!this.canBuild(cell)) return { ok: false, reason: 'blocked' };
    const cost = towerStats(t, type).cost;
    if (this.money < cost) return { ok: false, reason: 'money' };
    const tower = this.board.place(type, cell);
    if (!tower) return { ok: false, reason: 'blocked' };
    this.money -= cost;
    return { ok: true, tower };
  }

  move(id: number, cell: Cell): boolean {
    if (isCoreCell(this.board.layout, cell)) return false;
    return this.board.move(id, cell);
  }

  /** Removes a tower and refunds part of its cost. Returns the refund, or null if there was no tower. */
  remove(id: number, t: Readonly<Tuning>): number | null {
    const tower = this.board.remove(id);
    if (!tower) return null;
    this.playUntil.delete(id);
    const refund = Math.floor(towerStats(t, tower.type).cost * t.economy.refund);
    this.money += refund;
    return refund;
  }

  addEnemy(type: EnemyType, hp: number, progress = 0): Enemy {
    const e: Enemy = { id: this.nextEnemyId++, type, hp, maxHp: hp, progress, stunLeft: 0, slowLeft: 0, slowAmount: 0 };
    this.enemies.set(e.id, e);
    return e;
  }

  inRange(tower: Tower, range: number): Enemy[] {
    const c = this.towerCenter(tower);
    return [...this.enemies.values()].filter((e) => distance(c, this.enemyPoint(e)) <= range);
  }

  isPlaying(towerId: number, step: number): boolean {
    return (this.playUntil.get(towerId) ?? -1) > step;
  }

  onStep(step: number, t: Readonly<Tuning>): StepResult {
    const { stepInBar } = stepToPosition(step);

    // 1. Towers go live on bar starts.
    const barChange = this.board.onStep(step);

    // 2. Spawns.
    for (const s of this.waves.onStep(step, t)) this.addEnemy(s.type, s.hp);

    // 3. Movement.
    const leaks: StepResult['leaks'] = [];
    for (const e of this.enemies.values()) {
      e.progress += this.moveFor(e, t);
      if (e.stunLeft > 0) e.stunLeft--;
      else if (e.slowLeft > 0) e.slowLeft--;
      if (e.progress >= this.path.length) {
        leaks.push({ id: e.id, type: e.type });
        this.enemies.delete(e.id);
        this.leaked++;
      }
    }

    // 4. Engagement.
    const live = this.board.all().filter((tw) => tw.state === 'live');
    const targets = new Map<number, Enemy[]>();
    for (const tower of live) {
      const found = this.inRange(tower, towerStats(t, tower.type).range);
      targets.set(tower.id, found);
      if (found.length === 0) continue;
      const already = this.isPlaying(tower.id, step);
      const quantize = Math.max(1, Math.round(t.engage.quantize));
      if (!already && step % quantize !== 0) continue;
      const hold = Math.max(1, Math.round(t.engage.holdBars));
      this.playUntil.set(tower.id, nextBarStart(step) + (hold - 1) * 16);
    }
    const playingTowers = new Set(live.filter((tw) => this.isPlaying(tw.id, step)).map((tw) => tw.id));

    // 5. Sound and attacks.
    const hits: SoundHit[] = [];
    for (const drum of DRUM_ORDER) {
      const pattern = DRUM_DEFS[drum].pattern;
      const kind = stepAt(pattern, stepInBar);
      if (kind) hits.push({ instrument: drum, kind, hitIndex: hitIndexAt(pattern, stepInBar), gain: 1 });
    }

    const playingLayers = new Set<TowerType>();
    const attacks: Attack[] = [];
    const idleGain = t.engage.idle <= -60 ? 0 : dbToGain(t.engage.idle);
    for (const type of TOWER_TYPES) {
      const ofType = live.filter((tw) => tw.type === type);
      if (ofType.length === 0) continue;
      const playing = ofType.filter((tw) => playingTowers.has(tw.id));
      const gain = playing.length > 0 ? 1 : idleGain;
      if (gain === 0) continue;
      playingLayers.add(type);
      const pattern = TOWER_DEFS[type].patterns.base;
      const kind = stepAt(pattern, stepInBar);
      if (!kind) continue;
      hits.push({ instrument: type, kind, hitIndex: hitIndexAt(pattern, stepInBar), gain });
      for (const tower of playing) {
        const attack = this.attack(tower, targets.get(tower.id) ?? [], t);
        if (attack) attacks.push(attack);
      }
    }

    // 6. Kills.
    const kills: StepResult['kills'] = [];
    for (const e of this.enemies.values()) {
      if (e.hp > 0) continue;
      const bounty = t[e.type].bounty;
      this.money += bounty;
      this.killed++;
      kills.push({ id: e.id, type: e.type, point: this.enemyPoint(e), bounty });
      this.enemies.delete(e.id);
    }

    const enemies: EnemySnapshot[] = [...this.enemies.values()].map((e) => ({
      id: e.id,
      type: e.type,
      progress: e.progress,
      nextMove: this.moveFor(e, t),
      hp: e.hp,
      maxHp: e.maxHp,
      stunned: e.stunLeft > 0,
      slowed: e.slowLeft > 0,
    }));

    return {
      step,
      entered: barChange?.entered ?? [],
      hits,
      attacks,
      kills,
      leaks,
      playingTowers,
      playingLayers,
      enemies,
      waves: this.waves.status(step),
    };
  }

  /** Cells an enemy moves on its next step. */
  private moveFor(e: Enemy, t: Readonly<Tuning>): number {
    if (e.stunLeft > 0) return 0;
    const base = t[e.type].speed / 4;
    return e.slowLeft > 0 ? base * (1 - e.slowAmount) : base;
  }

  private attack(tower: Tower, inRange: Enemy[], t: Readonly<Tuning>): Attack | null {
    const alive = inRange.filter((e) => e.hp > 0);
    if (alive.length === 0) return null;
    const stats = towerStats(t, tower.type);
    const hit =
      TOWER_DEFS[tower.type].target === 'area'
        ? alive
        : [alive.reduce((best, e) => (e.progress > best.progress ? e : best))];
    for (const e of hit) {
      e.hp -= stats.damage;
      if (stats.stun > 0) e.stunLeft = Math.max(e.stunLeft, Math.round(stats.stun));
      if (stats.slow > 0 && stats.slowSteps > 0) {
        e.slowAmount = Math.max(e.slowLeft > 0 ? e.slowAmount : 0, Math.min(stats.slow, 0.9));
        e.slowLeft = Math.max(e.slowLeft, Math.round(stats.slowSteps));
      }
    }
    return { towerId: tower.id, type: tower.type, targets: hit.map((e) => e.id), points: hit.map((e) => this.enemyPoint(e)) };
  }
}
