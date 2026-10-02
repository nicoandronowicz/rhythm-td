/**
 * The game world, advanced one 16th step at a time by the transport tick. Pure: no audio, no drawing.
 *
 * Order inside a step:
 *   1. towers queued last bar go live (bar starts only)
 *   2. due enemies spawn
 *   3. each enemy either attacks a tower in reach (on its attack steps; it hovers in place) or moves;
 *      enemies past the end of the path hit the core and knock drums out
 *   4. towers with an enemy in range start or keep playing at full presence; they hold to the bar end
 *   5. drums and towers sound on their pattern steps (idle towers too, quietly); playing towers attack
 *   6. dead enemies pay their bounty; noise and muffling on towers slowly recover
 */

import type { Tuning } from '../config/tuning';
import { stepAt, type HitKind, type Pattern } from '../music/patterns';
import { nextBarStart, stepToPosition } from '../music/timing';
import { Board, type Tower } from './board';
import { DRUM_DEFS, DRUM_ORDER, type DrumType } from './core';
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
  hp: number;
  cost: number;
  damage: number;
  range: number;
  stun: number;
  slow: number;
  slowSteps: number;
  muffleShrink: number;
}

export function towerStats(t: Readonly<Tuning>, type: TowerType): TowerStats {
  return t[`${type}Tower`];
}

export interface SoundHit {
  instrument: InstrumentId;
  kind: HitKind;
  /** Which hit of the bar this is (0 = first). Melodic voices use it to pick notes. */
  hitIndex: number;
}

/** How a tower layer sounds this step. */
export type LayerMode = 'fighting' | 'idle' | 'none';

export interface LayerSound {
  mode: LayerMode;
  /** Enemies in range of the layer's fighting towers. */
  enemies: number;
  /** Noise and crush on the layer, 0..1 (worst tower of the type). */
  staticLevel: number;
  /** Muffling on the layer, 0..1. */
  muffleLevel: number;
}

/** The core's mood: resting between waves, rising in the bar before one, active otherwise. */
export type CoreMode = 'resting' | 'rising' | 'active';

export interface Attack {
  towerId: number;
  type: TowerType;
  targets: number[];
  /** Where each target was when hit, in cell units. */
  points: Point[];
}

export interface EnemyAttack {
  enemyId: number;
  type: EnemyType;
  towerId: number;
  from: Point;
  destroyed: boolean;
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
  enemyAttacks: EnemyAttack[];
  kills: { id: number; type: EnemyType; point: Point; bounty: number }[];
  leaks: { id: number; type: EnemyType; dropped: DrumType | null }[];
  /** Tower ids playing at full presence on this step. */
  playingTowers: Set<number>;
  layers: Record<TowerType, LayerSound>;
  core: CoreMode;
  drums: Record<DrumType, number>;
  enemies: EnemySnapshot[];
  waves: WaveStatus;
  gameOver: boolean;
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
  /** Leaks each drum can still take. A drum at 0 has dropped out. */
  readonly drums: Record<DrumType, number>;
  gameOver = false;
  /** Waves fully survived (reached the next one). */
  wavesSurvived = 0;
  private nextEnemyId = 1;
  /** Step (exclusive) each tower keeps playing until. */
  private playUntil = new Map<number, number>();

  constructor(board: Board, t: Readonly<Tuning>) {
    this.board = board;
    this.path = new PathGeometry(board.layout);
    this.money = t.economy.startMoney;
    const hp = Math.max(1, Math.round(t.core.hpPerDrum));
    this.drums = { hats: hp, clap: hp, kick: hp };
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
    if (this.gameOver || !this.canBuild(cell)) return { ok: false, reason: 'blocked' };
    const stats = towerStats(t, type);
    if (this.money < stats.cost) return { ok: false, reason: 'money' };
    const tower = this.board.place(type, cell, stats.hp);
    if (!tower) return { ok: false, reason: 'blocked' };
    this.money -= stats.cost;
    return { ok: true, tower };
  }

  repairCost(tower: Tower, t: Readonly<Tuning>): number {
    return Math.ceil(towerStats(t, tower.type).cost * t.economy.repair);
  }

  /** Repair a wreck: it comes back on the next bar. */
  repair(id: number, t: Readonly<Tuning>): { ok: true } | { ok: false; reason: 'money' | 'not-wreck' } {
    const tower = this.board.get(id);
    if (!tower || tower.state !== 'wreck' || this.gameOver) return { ok: false, reason: 'not-wreck' };
    const cost = this.repairCost(tower, t);
    if (this.money < cost) return { ok: false, reason: 'money' };
    tower.maxHp = towerStats(t, tower.type).hp;
    this.board.repair(id);
    this.money -= cost;
    return { ok: true };
  }

  move(id: number, cell: Cell): boolean {
    if (isCoreCell(this.board.layout, cell)) return false;
    return this.board.move(id, cell);
  }

  /** Removes a tower and refunds part of its cost (nothing for a wreck). Returns the refund, or null if there was no tower. */
  remove(id: number, t: Readonly<Tuning>): number | null {
    const tower = this.board.remove(id);
    if (!tower) return null;
    this.playUntil.delete(id);
    if (tower.state === 'wreck') return 0;
    const refund = Math.floor(towerStats(t, tower.type).cost * t.economy.refund);
    this.money += refund;
    return refund;
  }

  addEnemy(type: EnemyType, hp: number, progress = 0): Enemy {
    const e: Enemy = { id: this.nextEnemyId++, type, hp, maxHp: hp, progress, stunLeft: 0, slowLeft: 0, slowAmount: 0 };
    this.enemies.set(e.id, e);
    return e;
  }

  /** Effective range: muffling shrinks it. */
  rangeOf(tower: Tower, t: Readonly<Tuning>): number {
    const s = towerStats(t, tower.type);
    return s.range * (1 - Math.min(Math.max(s.muffleShrink, 0), 0.9) * tower.muffleLevel);
  }

  inRange(tower: Tower, range: number): Enemy[] {
    const c = this.towerCenter(tower);
    return [...this.enemies.values()].filter((e) => distance(c, this.enemyPoint(e)) <= range);
  }

  isPlaying(towerId: number, step: number): boolean {
    return (this.playUntil.get(towerId) ?? -1) > step;
  }

  /** Drums still playing, in drop-out order. */
  aliveDrums(): DrumType[] {
    return DRUM_ORDER.filter((d) => this.drums[d] > 0);
  }

  onStep(step: number, t: Readonly<Tuning>): StepResult {
    const { stepInBar } = stepToPosition(step);
    const empty = this.emptyLayers();

    if (this.gameOver) {
      return {
        step,
        entered: [],
        hits: [],
        attacks: [],
        enemyAttacks: [],
        kills: [],
        leaks: [],
        playingTowers: new Set(),
        layers: empty,
        core: 'active',
        drums: { ...this.drums },
        enemies: [],
        waves: this.waves.status(step),
        gameOver: true,
      };
    }

    // 1. Towers go live on bar starts.
    const barChange = this.board.onStep(step);

    // 2. Spawns (and count survived waves when a new one starts).
    const waveBefore = this.waves.status(step).wave;
    for (const s of this.waves.onStep(step, t)) this.addEnemy(s.type, s.hp);
    const waveNow = this.waves.status(step).wave;
    if (waveNow > waveBefore && waveBefore > 0) this.wavesSurvived = waveBefore;

    // 3. Enemies attack or move.
    const enemyAttacks: EnemyAttack[] = [];
    const leaks: StepResult['leaks'] = [];
    const standing = this.board.all().filter((tw) => tw.state === 'live');
    for (const e of [...this.enemies.values()]) {
      const target = this.enemyTarget(e, standing, step, t);
      if (target) {
        enemyAttacks.push(this.enemyAttack(e, target, t));
        continue; // hovers while it hits
      }
      e.progress += this.moveFor(e, t);
      if (e.stunLeft > 0) e.stunLeft--;
      else if (e.slowLeft > 0) e.slowLeft--;
      if (e.progress >= this.path.length) {
        this.enemies.delete(e.id);
        this.leaked++;
        leaks.push({ id: e.id, type: e.type, dropped: this.hitCore(t[e.type].leak) });
        if (this.gameOver) break;
      }
    }

    // 4. Engagement.
    const live = this.board.all().filter((tw) => tw.state === 'live');
    const targets = new Map<number, Enemy[]>();
    for (const tower of live) {
      const found = this.inRange(tower, this.rangeOf(tower, t));
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
    if (!this.gameOver) {
      for (const drum of this.aliveDrums()) {
        const pattern = DRUM_DEFS[drum].pattern;
        const kind = stepAt(pattern, stepInBar);
        if (kind) hits.push({ instrument: drum, kind, hitIndex: hitIndexAt(pattern, stepInBar) });
      }
    }

    const layers = empty;
    const attacks: Attack[] = [];
    const idleOn = t.engage.idle > -60;
    for (const type of TOWER_TYPES) {
      const ofType = live.filter((tw) => tw.type === type);
      if (ofType.length === 0 || this.gameOver) continue;
      const playing = ofType.filter((tw) => playingTowers.has(tw.id));
      const near = new Set<number>();
      for (const tw of playing) for (const e of targets.get(tw.id) ?? []) near.add(e.id);
      layers[type] = {
        mode: playing.length > 0 ? 'fighting' : idleOn ? 'idle' : 'none',
        enemies: near.size,
        staticLevel: Math.max(...ofType.map((tw) => tw.staticLevel)),
        muffleLevel: Math.max(...ofType.map((tw) => tw.muffleLevel)),
      };
      if (layers[type].mode === 'none') continue;
      const pattern = TOWER_DEFS[type].patterns.base;
      const kind = stepAt(pattern, stepInBar);
      if (!kind) continue;
      hits.push({ instrument: type, kind, hitIndex: hitIndexAt(pattern, stepInBar) });
      for (const tower of playing) {
        const attack = this.attack(tower, targets.get(tower.id) ?? [], t);
        if (attack) attacks.push(attack);
      }
    }

    // 6. Kills and recovery.
    const kills: StepResult['kills'] = [];
    for (const e of this.enemies.values()) {
      if (e.hp > 0) continue;
      const bounty = t[e.type].bounty;
      this.money += bounty;
      this.killed++;
      kills.push({ id: e.id, type: e.type, point: this.enemyPoint(e), bounty });
      this.enemies.delete(e.id);
    }
    const recover = 1 / (Math.max(0.25, t.fx.recoverBars) * 16);
    const attacked = new Set(enemyAttacks.map((a) => a.towerId));
    for (const tw of this.board.all()) {
      if (attacked.has(tw.id)) continue;
      tw.staticLevel = Math.max(0, tw.staticLevel - recover);
      tw.muffleLevel = Math.max(0, tw.muffleLevel - recover);
    }

    const waves = this.waves.status(step);
    const enemies: EnemySnapshot[] = [...this.enemies.values()].map((e) => ({
      id: e.id,
      type: e.type,
      progress: e.progress,
      nextMove: this.willAttackNext(e, step + 1, t) ? 0 : this.moveFor(e, t),
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
      enemyAttacks,
      kills,
      leaks,
      playingTowers,
      layers,
      core: this.coreMode(step, waves),
      drums: { ...this.drums },
      enemies,
      waves,
      gameOver: this.gameOver,
    };
  }

  /** Resting once the wave has fully spawned and nobody is on the path; rising in the bar before the next wave. */
  coreMode(step: number, waves: WaveStatus): CoreMode {
    if (this.waves.pendingSpawns > 0 || this.enemies.size > 0) return 'active';
    const toNext = waves.nextWaveStep - step;
    return toNext > 0 && toNext <= 16 ? 'rising' : 'resting';
  }

  private emptyLayers(): Record<TowerType, LayerSound> {
    const none = (): LayerSound => ({ mode: 'none', enemies: 0, staticLevel: 0, muffleLevel: 0 });
    return { bass: none(), chords: none(), arp: none(), lead: none() };
  }

  /** Knock `damage` leaks off the core, top drum first. Returns the drum that dropped, if any. */
  private hitCore(damage: number): DrumType | null {
    let dropped: DrumType | null = null;
    let left = Math.max(0, Math.round(damage));
    while (left > 0) {
      const drum = this.aliveDrums()[0];
      if (!drum) break;
      this.drums[drum]--;
      left--;
      if (this.drums[drum] === 0) {
        dropped = drum;
        if (drum === 'kick') this.gameOver = true;
      }
    }
    if (this.aliveDrums().length === 0) this.gameOver = true;
    return dropped;
  }

  /** The nearest standing tower in reach, if this is one of the enemy's attack steps. */
  private enemyTarget(e: Enemy, standing: Tower[], step: number, t: Readonly<Tuning>): Tower | null {
    const s = t[e.type];
    if (e.stunLeft > 0 || (s.damage <= 0 && s.effect <= 0)) return null;
    if (step % Math.max(1, Math.round(s.attackEvery)) !== 0) return null;
    const p = this.enemyPoint(e);
    let best: Tower | null = null;
    let bestD = Infinity;
    for (const tw of standing) {
      if (tw.state !== 'live') continue;
      const d = distance(p, this.towerCenter(tw));
      if (d <= s.reach && d < bestD) {
        best = tw;
        bestD = d;
      }
    }
    return best;
  }

  private willAttackNext(e: Enemy, step: number, t: Readonly<Tuning>): boolean {
    const standing = this.board.all().filter((tw) => tw.state === 'live');
    return this.enemyTarget(e, standing, step, t) !== null;
  }

  private enemyAttack(e: Enemy, tower: Tower, t: Readonly<Tuning>): EnemyAttack {
    const s = t[e.type];
    tower.hp -= s.damage;
    if (e.type === 'static') tower.staticLevel = Math.min(1, tower.staticLevel + s.effect);
    else tower.muffleLevel = Math.min(1, tower.muffleLevel + s.effect);
    const destroyed = tower.hp <= 0;
    if (destroyed) {
      this.board.wreck(tower.id);
      this.playUntil.delete(tower.id);
    }
    return { enemyId: e.id, type: e.type, towerId: tower.id, from: this.enemyPoint(e), destroyed };
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
