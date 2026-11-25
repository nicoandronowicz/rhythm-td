/**
 * The game world, advanced one 16th step at a time by the transport tick. Pure: no audio, no drawing.
 *
 * Order inside a step:
 *   1. on bar starts: queued towers, upgrades, perks and a chosen reward join; a Lift may start
 *   2. due enemies spawn; a new wave switches the progression
 *   3. each enemy either attacks a tower in reach (on its attack steps; it hovers in place) or moves;
 *      enemies past the end of the path hit the core and knock drums out
 *   4. towers with an enemy in range start or keep playing at full presence; they hold to the bar end
 *   5. the core (drums and pad) and towers sound on their pattern steps (idle towers too, quietly);
 *      playing towers attack
 *   6. dead enemies pay their bounty and fill the Lift meter; noise and muffling on towers recover
 *   7. a cleared wave offers rewards, or wins the level
 */

import type { Tuning } from '../config/tuning';
import { stepAt, type HitKind, type Pattern } from '../music/patterns';
import { chordInProgression, progressionForWave, type Chord } from '../music/theory';
import { nextBarStart, stepToPosition } from '../music/timing';
import { Board, type Tower } from './board';
import { detectCombos, type ComboState } from './combos';
import { BASE_DRUMS, DRUM_DEFS, DRUM_ORDER, LIFT_PATTERNS, PERK_DRUMS, TURNAROUND, type DrumType, type PerkDrum } from './core';
import type { CoachTrigger, LevelDef, LevelFeatures } from './levels';
import { emptyMods, offerRewards, rewardById, type Mods, type RewardId } from './rewards';
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
  upgradeCost: number;
  upgradeDamage: number;
  upgradeRange: number;
}

export function towerStats(t: Readonly<Tuning>, type: TowerType): TowerStats {
  return t[`${type}Tower`];
}

export interface SoundHit {
  instrument: InstrumentId;
  kind: HitKind;
  /** Which hit of the bar this is (0 = first). Melodic voices use it to pick notes. */
  hitIndex: number;
  /** Bars to hold (the pad). */
  sustainBars?: number;
  /** A bass passing note into the next chord. */
  approach?: boolean;
  /** The last note of an 8-bar phrase (for delay throws). */
  phraseEnd?: boolean;
}

/** Arrangement moments the audio engine dresses up. */
export interface TrackEvent {
  kind: 'riser' | 'impact' | 'downlifter';
  /** Length in 16ths. */
  steps: number;
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

/** What the band is playing over: the chord, where we are in the 8-bar phrase, and which wave (for hook and arp shapes). */
export interface Harmony {
  chord: Chord;
  /** The chord of the next bar (for passing notes). */
  nextChord: Chord;
  phraseBar: number;
  progression: number;
  wave: number;
}

/** The core's mood: resting between waves, rising in the bar before one, active otherwise. */
export type CoreMode = 'resting' | 'rising' | 'active';

export interface Attack {
  towerId: number;
  type: TowerType;
  targets: number[];
  /** Where each target was when hit, in cell units. */
  points: Point[];
  /** A Call & response critical hit. */
  crit: boolean;
  /** Boosted by Sidechain (right after a kick). */
  sidechain: boolean;
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
  harmony: Harmony;
  combos: ComboState;
  /** Tower layers that pump with the kick (Sidechain). */
  pump: Set<TowerType>;
  /** Which pattern each tower layer is playing. */
  layerUpgraded: Record<TowerType, boolean>;
  perksOwned: Set<PerkDrum>;
  events: TrackEvent[];
  /** For the training coach. */
  triggers: CoachTrigger[];
  /** Lift meter 0..1, and whether the track is lifted right now (or about to be). */
  hype: number;
  lifted: boolean;
  liftPending: boolean;
  gameOver: boolean;
  victory: boolean;
}

export type PlaceResult = { ok: true; tower: Tower } | { ok: false; reason: 'blocked' | 'money' | 'locked' };

/** Everything on, all towers: Endless, and what tests get by default. */
export const ALL_FEATURES: LevelFeatures = { upgrades: true, perks: true, combos: true, rewards: true, lift: true, enemiesAttack: true };

export interface WorldRules {
  towers: readonly TowerType[];
  features: LevelFeatures;
}

export function rulesFor(level: LevelDef): WorldRules {
  return { towers: level.towers, features: level.features };
}

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
  victory = false;
  /** Perks bought (they may have dropped out since: check `drums`). */
  readonly perksOwned = new Set<PerkDrum>();
  /** Perks bought this bar, joining on the next one. */
  readonly perksPending = new Set<PerkDrum>();
  combos: ComboState = detectCombos([]);
  /** Waves fully survived (cleared). */
  wavesSurvived = 0;
  /** Reward modifiers picked so far. */
  readonly mods: Mods = emptyMods();
  readonly rewardsTaken: RewardId[] = [];
  /** Three rewards on offer after a cleared wave, until one is picked. */
  rewardOffer: RewardId[] | null = null;
  private rewardPending: RewardId | null = null;
  /** Lift meter, 0..1. */
  hype = 0;
  liftPending = false;
  private liftEnd = -1;
  private liftReadyFired = false;
  private nextEnemyId = 1;
  /** Step (exclusive) each tower keeps playing until. */
  private playUntil = new Map<number, number>();
  /** Each wave plays its own progression from its first bar; the intro plays the first one. */
  private progression = 0;
  private progressionStartBar = 0;
  private clearedWaves = new Set<number>();
  private lastCore: CoreMode | null = null;
  private hadCombo = false;
  private firstKillFired = false;
  readonly rules: WorldRules;

  constructor(
    board: Board,
    t: Readonly<Tuning>,
    /** Random source for crits and reward offers; tests pass a fixed one. */
    private readonly rng: () => number = Math.random,
    rules?: WorldRules,
  ) {
    this.board = board;
    this.path = new PathGeometry(board.layout);
    this.money = t.economy.startMoney;
    const hp = Math.max(1, Math.round(t.core.hpPerDrum));
    this.drums = { hats: hp, clap: hp, kick: hp, shaker: 0, rim: 0, openhat: 0 };
    this.rules = rules ?? { towers: TOWER_TYPES, features: ALL_FEATURES };
  }

  get features(): LevelFeatures {
    return this.rules.features;
  }

  // ---------- upgrades, perks, rewards, lift ----------

  upgradeCost(tower: Tower, t: Readonly<Tuning>): number {
    return towerStats(t, tower.type).upgradeCost;
  }

  /** Upgrade a tower: it switches to its upgraded pattern and stats on the next bar. */
  upgrade(id: number, t: Readonly<Tuning>): { ok: true } | { ok: false; reason: 'money' | 'done' | 'wreck' | 'locked' } {
    const tower = this.board.get(id);
    if (!tower || this.gameOver) return { ok: false, reason: 'done' };
    if (!this.features.upgrades) return { ok: false, reason: 'locked' };
    if (tower.state === 'wreck') return { ok: false, reason: 'wreck' };
    if (tower.upgraded || tower.upgradeQueued) return { ok: false, reason: 'done' };
    const cost = this.upgradeCost(tower, t);
    if (this.money < cost) return { ok: false, reason: 'money' };
    this.money -= cost;
    tower.upgradeQueued = true;
    return { ok: true };
  }

  perkCost(perk: PerkDrum, t: Readonly<Tuning>): number {
    return t.core[`${perk}Cost`];
  }

  /** A perk is playing if bought and not knocked out. */
  hasPerk(perk: PerkDrum): boolean {
    return this.drums[perk] > 0;
  }

  /** Buy (or rebuy after it dropped out) a perk drum. It joins on the next bar with a full drum's health. */
  buyPerk(perk: PerkDrum, t: Readonly<Tuning>): { ok: true } | { ok: false; reason: 'money' | 'playing' | 'locked' } {
    if (!this.features.perks) return { ok: false, reason: 'locked' };
    if (this.gameOver || this.hasPerk(perk) || this.perksPending.has(perk)) return { ok: false, reason: 'playing' };
    const cost = this.perkCost(perk, t);
    if (this.money < cost) return { ok: false, reason: 'money' };
    this.money -= cost;
    this.perksPending.add(perk);
    return { ok: true };
  }

  /** Pick one of the offered rewards; it takes effect on the next bar. */
  chooseReward(id: RewardId): boolean {
    if (!this.rewardOffer?.includes(id)) return false;
    this.rewardOffer = null;
    this.rewardPending = id;
    return true;
  }

  /** Ask for a Lift: it starts at the next 8-bar phrase. */
  requestLift(): boolean {
    if (!this.features.lift || this.gameOver || this.hype < 1 || this.liftPending || this.liftEnd > 0) return false;
    this.liftPending = true;
    return true;
  }

  isLifted(step: number): boolean {
    return step < this.liftEnd;
  }

  /** Leaks the core can still take, and its total when everything owned is healthy. */
  coreHealth(t: Readonly<Tuning>): { left: number; total: number } {
    const per = Math.max(1, Math.round(t.core.hpPerDrum));
    const owned: DrumType[] = [...BASE_DRUMS, ...PERK_DRUMS.filter((p) => this.perksOwned.has(p))];
    return { left: owned.reduce((n, d) => n + Math.max(0, this.drums[d]), 0), total: owned.length * per };
  }

  /** The pattern a tower plays and attacks on: upgraded, else a reward's alternate part, else the base part. */
  towerPattern(tower: Tower): Pattern {
    const p = TOWER_DEFS[tower.type].patterns;
    if (tower.upgraded) return p.upgraded;
    return this.mods.variants.has(tower.type) ? p.variant : p.base;
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
    if (!this.rules.towers.includes(type)) return { ok: false, reason: 'locked' };
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

  /** Removes a tower and refunds part of what was spent on it (nothing for a wreck). Returns the refund, or null if there was no tower. */
  remove(id: number, t: Readonly<Tuning>): number | null {
    const tower = this.board.remove(id);
    if (!tower) return null;
    this.playUntil.delete(id);
    if (tower.state === 'wreck') return 0;
    const s = towerStats(t, tower.type);
    const spent = s.cost + (tower.upgraded || tower.upgradeQueued ? s.upgradeCost : 0);
    const refund = Math.floor(spent * t.economy.refund);
    this.money += refund;
    return refund;
  }

  addEnemy(type: EnemyType, hp: number, progress = 0): Enemy {
    const e: Enemy = { id: this.nextEnemyId++, type, hp, maxHp: hp, progress, stunLeft: 0, slowLeft: 0, slowAmount: 0 };
    this.enemies.set(e.id, e);
    return e;
  }

  /** Effective range: upgrades, Full band and the Wide mix reward extend it, muffling shrinks it. */
  rangeOf(tower: Tower, t: Readonly<Tuning>): number {
    const s = towerStats(t, tower.type);
    const base = s.range + (tower.upgraded ? s.upgradeRange : 0);
    const band = this.combos.byTower.get(tower.id)?.has('fullBand') ? 1 + t.combos.fullBandRange : 1;
    return base * band * (1 + this.mods.range) * (1 - Math.min(Math.max(s.muffleShrink, 0), 0.9) * tower.muffleLevel);
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

  harmonyAt(bar: number, wave: number): Harmony {
    const phraseBar = bar - this.progressionStartBar;
    return {
      chord: chordInProgression(this.progression, phraseBar),
      nextChord: chordInProgression(this.progression, phraseBar + 1),
      phraseBar: ((phraseBar % 8) + 8) % 8,
      progression: this.progression,
      wave,
    };
  }

  onStep(step: number, t: Readonly<Tuning>): StepResult {
    const { stepInBar, bar } = stepToPosition(step);
    const empty = this.emptyLayers();
    const events: TrackEvent[] = [];
    const triggers: CoachTrigger[] = [];

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
        harmony: this.harmonyAt(bar, this.waves.status(step).wave),
        combos: this.combos,
        pump: new Set(),
        layerUpgraded: { bass: false, chords: false, arp: false, lead: false },
        perksOwned: new Set(this.perksOwned),
        events,
        triggers,
        hype: this.hype,
        lifted: false,
        liftPending: false,
        gameOver: true,
        victory: this.victory,
      };
    }

    // 1. Towers, upgrades, perks and rewards join on bar starts.
    const barChange = this.board.onStep(step);
    if (barChange) {
      for (const p of this.perksPending) {
        this.drums[p] = Math.max(1, Math.round(t.core.hpPerDrum));
        this.perksOwned.add(p);
      }
      this.perksPending.clear();
      if (this.rewardPending) this.applyReward(this.rewardPending, t);
    }
    this.combos = this.features.combos ? detectCombos(this.board.all()) : detectCombos([]);
    if (this.combos.active.size > 0 && !this.hadCombo) triggers.push('combo');
    this.hadCombo = this.combos.active.size > 0;

    // 2. Spawns; a new wave switches the progression.
    const waveBefore = this.waves.status(step).wave;
    for (const s of this.waves.onStep(step, t, t.waves.toWin)) this.addEnemy(s.type, s.hp);
    const waveNow = this.waves.status(step).wave;
    if (waveNow > waveBefore) {
      this.progression = progressionForWave(waveNow);
      this.progressionStartBar = bar;
      events.push({ kind: 'impact', steps: 16 });
      triggers.push(`wave:${waveNow}`);
    }
    const harmony = this.harmonyAt(bar, waveNow);

    // Lift: rises over the last bar of a phrase, starts on the next phrase.
    if (barChange && this.liftEnd > 0 && step >= this.liftEnd) this.liftEnd = -1;
    if (barChange && this.liftPending && harmony.phraseBar === 7) events.push({ kind: 'riser', steps: 16 });
    if (barChange && this.liftPending && harmony.phraseBar === 0) {
      this.liftPending = false;
      this.liftEnd = step + Math.max(1, Math.round(t.lift.bars)) * 16;
      this.hype = 0;
      this.liftReadyFired = false;
      events.push({ kind: 'impact', steps: 16 });
      triggers.push('lift');
    }
    const lifted = this.isLifted(step);

    // 3. Enemies attack or move.
    const enemyAttacks: EnemyAttack[] = [];
    const leaks: StepResult['leaks'] = [];
    const standing = this.board.all().filter((tw) => tw.state === 'live');
    for (const e of [...this.enemies.values()]) {
      const target = this.enemyTarget(e, standing, step, t);
      if (target) {
        const a = this.enemyAttack(e, target, t);
        enemyAttacks.push(a);
        triggers.push('enemyAttack');
        if (a.destroyed) triggers.push('wreck');
        continue; // hovers while it hits
      }
      e.progress += this.moveFor(e, t);
      if (e.stunLeft > 0) e.stunLeft--;
      else if (e.slowLeft > 0) e.slowLeft--;
      if (e.progress >= this.path.length) {
        this.enemies.delete(e.id);
        this.leaked++;
        leaks.push({ id: e.id, type: e.type, dropped: this.hitCore(t[e.type].leak) });
        triggers.push('leak');
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
    const waves = this.waves.status(step);
    const core = lifted ? 'active' : this.coreMode(step, waves);
    const turnaround = t.groove.turnarounds > 0 && core === 'active' && harmony.phraseBar === 7;
    const hits: SoundHit[] = [];
    if (!this.gameOver) {
      for (const drum of this.aliveDrums()) {
        const pattern = (lifted && LIFT_PATTERNS[drum]) || (turnaround && TURNAROUND[drum]) || DRUM_DEFS[drum].pattern;
        const kind = stepAt(pattern, stepInBar);
        if (kind) hits.push({ instrument: drum, kind, hitIndex: hitIndexAt(pattern, stepInBar) });
      }
      // The pad changes with the chord (every 2 bars).
      if (stepInBar === 0 && (bar - this.progressionStartBar) % 2 === 0) {
        hits.push({ instrument: 'pad', kind: 'normal', hitIndex: 0, sustainBars: 2 });
      }
    }

    const layers = empty;
    const attacks: Attack[] = [];
    const idleOn = t.engage.idle > -60;
    const layerUpgraded = { bass: false, chords: false, arp: false, lead: false };
    const afterKick = this.drums.kick > 0 && (step % 4 === 1 || step % 4 === 2);
    const chordChangeNext = harmony.nextChord !== harmony.chord;
    for (const type of TOWER_TYPES) {
      const ofType = live.filter((tw) => tw.type === type);
      if (ofType.length === 0 || this.gameOver) continue;
      const playing = ofType.filter((tw) => playingTowers.has(tw.id));
      const sounding = playing.length > 0 ? playing : ofType;
      // The layer plays the upgraded part if any tower it's sounding for is upgraded.
      layerUpgraded[type] = sounding.some((tw) => tw.upgraded);
      const near = new Set<number>();
      for (const tw of playing) for (const e of targets.get(tw.id) ?? []) near.add(e.id);
      layers[type] = {
        mode: playing.length > 0 ? 'fighting' : idleOn ? 'idle' : 'none',
        enemies: near.size,
        staticLevel: Math.max(...ofType.map((tw) => tw.staticLevel)),
        muffleLevel: Math.max(...ofType.map((tw) => tw.muffleLevel)),
      };
      if (layers[type].mode === 'none') continue;
      const p = TOWER_DEFS[type].patterns;
      const pattern = layerUpgraded[type] ? p.upgraded : this.mods.variants.has(type) ? p.variant : p.base;
      const kind = stepAt(pattern, stepInBar);
      if (kind) {
        const hitIndex = hitIndexAt(pattern, stepInBar);
        const lastInBar = hitIndex === hitIndexAt(pattern, 16) - 1;
        hits.push({
          instrument: type,
          kind,
          hitIndex,
          approach: type === 'bass' && t.groove.approach > 0 && chordChangeNext && lastInBar,
          phraseEnd: harmony.phraseBar === 7 && lastInBar,
        });
      }
      for (const tower of playing) {
        if (!stepAt(this.towerPattern(tower), stepInBar)) continue;
        const attack = this.attack(tower, targets.get(tower.id) ?? [], t, afterKick, lifted);
        if (attack) attacks.push(attack);
      }
    }

    // 6. Kills, Lift meter and recovery.
    const kills: StepResult['kills'] = [];
    for (const e of this.enemies.values()) {
      if (e.hp > 0) continue;
      const bounty = t[e.type].bounty + this.mods.bounty;
      this.money += bounty;
      this.killed++;
      kills.push({ id: e.id, type: e.type, point: this.enemyPoint(e), bounty });
      this.enemies.delete(e.id);
      if (!this.firstKillFired) {
        this.firstKillFired = true;
        triggers.push('firstKill');
      }
    }
    if (this.features.lift && !lifted && !this.liftPending) {
      const comboHits = attacks.filter((a) => a.sidechain || a.crit || this.combos.byTower.has(a.towerId)).length;
      this.hype = Math.min(1, this.hype + kills.length * t.lift.perKill + comboHits * t.lift.perCombo);
      if (this.hype >= 1 && !this.liftReadyFired) {
        this.liftReadyFired = true;
        triggers.push('liftReady');
      }
    }
    const recover = 1 / (Math.max(0.25, t.fx.recoverBars) * 16);
    const attacked = new Set(enemyAttacks.map((a) => a.towerId));
    for (const tw of this.board.all()) {
      if (attacked.has(tw.id)) continue;
      tw.staticLevel = Math.max(0, tw.staticLevel - recover);
      tw.muffleLevel = Math.max(0, tw.muffleLevel - recover);
    }

    // 7. A cleared wave: rewards, or the level is won.
    if (waves.wave > 0 && waves.pending === 0 && this.enemies.size === 0 && !this.clearedWaves.has(waves.wave)) {
      this.clearedWaves.add(waves.wave);
      this.wavesSurvived = waves.wave;
      events.push({ kind: 'downlifter', steps: 32 });
      triggers.push(`cleared:${waves.wave}`);
      if (t.waves.toWin > 0 && waves.wave >= t.waves.toWin) {
        this.victory = true;
      } else if (this.features.rewards) {
        this.rewardOffer = offerRewards(this.rng, this.rewardsTaken, { level: this.levelLike() });
        if (this.rewardOffer.length) triggers.push('rewardOffer');
      }
    }

    // The core sweeps open over the last bar before a wave: dress it with a riser.
    const coreNow = this.coreMode(step, waves);
    if (coreNow === 'rising' && this.lastCore !== 'rising') events.push({ kind: 'riser', steps: Math.max(1, waves.nextWaveStep - step) });
    this.lastCore = coreNow;

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

    const pump = new Set<TowerType>();
    if (this.combos.active.has('sidechain')) for (const ty of ['bass', 'chords'] as const) pump.add(ty);

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
      core,
      drums: { ...this.drums },
      enemies,
      waves,
      harmony,
      combos: this.combos,
      pump,
      layerUpgraded,
      perksOwned: new Set(this.perksOwned),
      events,
      triggers,
      hype: this.hype,
      lifted,
      liftPending: this.liftPending,
      gameOver: this.gameOver,
      victory: this.victory,
    };
  }

  /** Resting once the wave has fully spawned and nobody is on the path; rising in the bar before the next wave. */
  coreMode(step: number, waves: WaveStatus): CoreMode {
    if (this.waves.pendingSpawns > 0 || this.enemies.size > 0) return 'active';
    if (this.victory) return 'active';
    const toNext = waves.nextWaveStep - step;
    return toNext > 0 && toNext <= 16 ? 'rising' : 'resting';
  }

  /** Just enough of a level for reward availability checks. */
  private levelLike(): LevelDef {
    return { towers: this.rules.towers, features: this.rules.features } as LevelDef;
  }

  private applyReward(id: RewardId, t: Readonly<Tuning>): void {
    this.rewardPending = null;
    this.rewardsTaken.push(id);
    rewardById(id).apply(this.mods, t);
    if (id === 'patchCable') {
      for (const tw of this.board.all()) {
        if (tw.state !== 'wreck') continue;
        tw.maxHp = towerStats(t, tw.type).hp;
        this.board.repair(tw.id);
      }
      const per = Math.max(1, Math.round(t.core.hpPerDrum));
      const order: DrumType[] = ['kick', 'clap', 'hats', ...PERK_DRUMS.filter((p) => this.perksOwned.has(p))];
      const drum = order.find((d) => this.drums[d] < per);
      if (drum) this.drums[drum]++;
    }
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

  private attack(tower: Tower, inRange: Enemy[], t: Readonly<Tuning>, afterKick: boolean, lifted: boolean): Attack | null {
    const alive = inRange.filter((e) => e.hp > 0);
    if (alive.length === 0) return null;
    const stats = towerStats(t, tower.type);
    const combos = this.combos.byTower.get(tower.id);
    const sidechain = afterKick && !!combos?.has('sidechain');
    const crit = !!combos?.has('callResponse') && tower.type === 'lead' && this.rng() < t.combos.callCrit + this.mods.critChance;
    const damage =
      stats.damage *
      (1 + this.mods.damage[tower.type]) *
      (tower.upgraded ? stats.upgradeDamage : 1) *
      (sidechain ? t.combos.sidechainBoost + this.mods.sidechainBoost : 1) *
      (crit ? t.combos.callCritDamage : 1) *
      (lifted ? t.lift.damage : 1);
    const stun = stats.stun + this.mods.stun[tower.type];
    const hit =
      TOWER_DEFS[tower.type].target === 'area'
        ? alive
        : [alive.reduce((best, e) => (e.progress > best.progress ? e : best))];
    for (const e of hit) {
      e.hp -= damage;
      if (stun > 0) e.stunLeft = Math.max(e.stunLeft, Math.round(stun));
      if (stats.slow > 0 && stats.slowSteps > 0) {
        e.slowAmount = Math.max(e.slowLeft > 0 ? e.slowAmount : 0, Math.min(stats.slow, 0.9));
        e.slowLeft = Math.max(e.slowLeft, Math.round(stats.slowSteps));
      }
    }
    return {
      towerId: tower.id,
      type: tower.type,
      targets: hit.map((e) => e.id),
      points: hit.map((e) => this.enemyPoint(e)),
      crit,
      sidechain,
    };
  }
}
