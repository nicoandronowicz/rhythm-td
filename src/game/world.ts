/**
 * The game world, advanced one 16th step at a time by the transport tick. Pure: no audio, no drawing.
 *
 * Order inside a step:
 *   1. on bar starts: queued towers, upgrades, perks and a chosen reward join; a Lift may start
 *   2. due enemies spawn; a new wave starts the song's next section
 *   3. each enemy either attacks a tower in reach (on its attack steps; it hovers in place) or moves;
 *      enemies past the end of the path hit the core and knock its layers out
 *   4. towers with an enemy in range start or keep playing at full presence; they hold to the bar end
 *   5. the composer writes this step's notes (core, pad, towers; idle towers play quietly);
 *      fighting towers attack on their main hits
 *   6. dead enemies pay their bounty and fill the Lift meter; noise and muffling on towers recover
 *   7. a cleared wave offers rewards, or wins the level
 */

import type { Tuning } from '../config/tuning';
import { Composer, type ComposeInput, type Harmony, type NoteEvent, type PartState } from '../music/compose';
import type { SongDef } from '../music/song';
import { AFTERHOURS } from '../music/songs/afterhours';
import { nextBarStart, stepToPosition } from '../music/timing';
import { Board, type Tower } from './board';
import { detectCombos, type ComboState } from './combos';
import { coreLayer, perkCost, type CoreLayerId } from './core';
import type { EnemyType } from './enemies';
import { isCoreCell, type Cell } from './grid';
import type { CoachTrigger, LevelDef, LevelFeatures } from './levels';
import { distance, PathGeometry, type Point } from './path';
import { emptyMods, offerRewards, rewardById, type Mods, type RewardId } from './rewards';
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
  refHits: number;
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

/** Arrangement moments the audio engine dresses up. */
export interface TrackEvent {
  kind: 'build' | 'impact' | 'downlifter';
  /** Length in 16ths. */
  steps: number;
  /** A big moment (wave start, Lift) or a small one. */
  big?: boolean;
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

/** Where the song is: section, bar inside it, and its harmony. */
export interface SongPosition extends Harmony {
  section: number;
  barInSection: number;
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
  /** Every note of this step. */
  notes: NoteEvent[];
  /** A pump layer (the kick) hit on this step: the mix ducks. */
  pumpHit: boolean;
  attacks: Attack[];
  enemyAttacks: EnemyAttack[];
  kills: { id: number; type: EnemyType; point: Point; bounty: number }[];
  leaks: { id: number; type: EnemyType; dropped: CoreLayerId | null }[];
  /** Tower ids playing at full presence on this step. */
  playingTowers: Set<number>;
  layers: Record<TowerType, LayerSound>;
  core: CoreMode;
  /** Leaks each core layer can still take (0 = dropped out or not bought). */
  coreHp: Record<CoreLayerId, number>;
  enemies: EnemySnapshot[];
  waves: WaveStatus;
  harmony: SongPosition;
  energy: number;
  combos: ComboState;
  /** Tower layers that pump with the kick (Sidechain). */
  pump: Set<TowerType>;
  /** Which pattern each tower layer is playing. */
  layerUpgraded: Record<TowerType, boolean>;
  perksOwned: Set<CoreLayerId>;
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
  song: SongDef;
}

export function rulesFor(level: LevelDef, song: SongDef): WorldRules {
  return { towers: level.towers, features: level.features, song };
}

/** Bars in a phrase: a Lift starts on a phrase boundary. */
const PHRASE = 8;

export class World {
  readonly board: Board;
  readonly path: PathGeometry;
  readonly waves: WaveClock;
  readonly enemies = new Map<number, Enemy>();
  readonly song: SongDef;
  readonly composer: Composer;
  money: number;
  leaked = 0;
  killed = 0;
  /** Leaks each core layer can still take. A layer at 0 has dropped out (or is a perk not bought). */
  readonly coreHp: Record<CoreLayerId, number>;
  gameOver = false;
  victory = false;
  /** Perks bought (they may have dropped out since: check `coreHp`). */
  readonly perksOwned = new Set<CoreLayerId>();
  /** Perks bought this bar, joining on the next one. */
  readonly perksPending = new Set<CoreLayerId>();
  combos: ComboState = detectCombos([]);
  /** Waves fully survived (cleared). */
  wavesSurvived = 0;
  readonly mods: Mods = emptyMods();
  readonly rewardsTaken: RewardId[] = [];
  rewardOffer: RewardId[] | null = null;
  private rewardPending: RewardId | null = null;
  hype = 0;
  liftPending = false;
  private liftEnd = -1;
  private liftReadyFired = false;
  private nextEnemyId = 1;
  private playUntil = new Map<number, number>();
  /** The song section playing and the bar it started on. */
  private section = -1;
  private sectionStartBar = 0;
  private sectionPasses = new Map<number, number>();
  private pass = 0;
  private lastPumpStep = -100;
  private clearedWaves = new Set<number>();
  private lastCore: CoreMode | null = null;
  private hadCombo = false;
  private firstKillFired = false;
  /** The composer input of the last step, for previews. */
  private lastInput: ComposeInput | null = null;
  readonly rules: WorldRules;

  constructor(
    board: Board,
    t: Readonly<Tuning>,
    /** Random source for crits and reward offers; tests pass a fixed one. */
    private readonly rng: () => number = Math.random,
    rules?: WorldRules,
  ) {
    this.rules = rules ?? { towers: TOWER_TYPES, features: ALL_FEATURES, song: AFTERHOURS };
    this.song = this.rules.song;
    this.composer = new Composer(this.song);
    this.board = board;
    this.waves = new WaveClock(this.song.stepsPerBar);
    this.path = new PathGeometry(board.layout);
    this.money = t.economy.startMoney;
    const hp = Math.max(1, Math.round(t.core.hpPerDrum));
    this.coreHp = Object.fromEntries(this.song.core.map((l) => [l.id, l.perk ? 0 : hp]));
  }

  get features(): LevelFeatures {
    return this.rules.features;
  }

  get stepsPerBar(): number {
    return this.song.stepsPerBar;
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

  perkCost(perk: CoreLayerId, t: Readonly<Tuning>): number {
    const layer = coreLayer(this.song, perk);
    return layer ? perkCost(layer, t) : Infinity;
  }

  /** A perk is playing if bought and not knocked out. */
  hasPerk(perk: CoreLayerId): boolean {
    return (this.coreHp[perk] ?? 0) > 0;
  }

  /** Buy (or rebuy after it dropped out) a perk layer. It joins on the next bar with full health. */
  buyPerk(perk: CoreLayerId, t: Readonly<Tuning>): { ok: true } | { ok: false; reason: 'money' | 'playing' | 'locked' } {
    if (!this.features.perks || !coreLayer(this.song, perk)?.perk) return { ok: false, reason: 'locked' };
    if (this.gameOver || this.hasPerk(perk) || this.perksPending.has(perk)) return { ok: false, reason: 'playing' };
    const cost = this.perkCost(perk, t);
    if (this.money < cost) return { ok: false, reason: 'money' };
    this.money -= cost;
    this.perksPending.add(perk);
    return { ok: true };
  }

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
    const owned = this.song.core.filter((l) => !l.perk || this.perksOwned.has(l.id));
    return { left: owned.reduce((n, l) => n + Math.max(0, this.coreHp[l.id] ?? 0), 0), total: owned.length * per };
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

  /** Core layers still playing, in drop-out order. */
  aliveCore(): CoreLayerId[] {
    return this.song.core.filter((l) => (this.coreHp[l.id] ?? 0) > 0).map((l) => l.id);
  }

  /** Where the song is at a bar. */
  position(bar: number, wave: number): SongPosition {
    const barInSection = Math.max(0, bar - this.sectionStartBar);
    return { ...this.composer.harmony(this.section, barInSection), section: this.section, barInSection, wave };
  }

  onStep(step: number, t: Readonly<Tuning>): StepResult {
    const spb = this.stepsPerBar;
    const { stepInBar, bar } = stepToPosition(step, spb);
    const empty = this.emptyLayers();
    const events: TrackEvent[] = [];
    const triggers: CoachTrigger[] = [];

    if (this.gameOver) {
      const waves = this.waves.status(step);
      return {
        step,
        entered: [],
        notes: [],
        pumpHit: false,
        attacks: [],
        enemyAttacks: [],
        kills: [],
        leaks: [],
        playingTowers: new Set(),
        layers: empty,
        core: 'active',
        coreHp: { ...this.coreHp },
        enemies: [],
        waves,
        harmony: this.position(bar, waves.wave),
        energy: 0,
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
        this.coreHp[p] = Math.max(1, Math.round(t.core.hpPerDrum));
        this.perksOwned.add(p);
      }
      this.perksPending.clear();
      if (this.rewardPending) this.applyReward(this.rewardPending, t);
    }
    this.combos = this.features.combos ? detectCombos(this.board.all()) : detectCombos([]);
    if (this.combos.active.size > 0 && !this.hadCombo) triggers.push('combo');
    this.hadCombo = this.combos.active.size > 0;

    // 2. Spawns; a new wave starts the song's next section.
    const waveBefore = this.waves.status(step).wave;
    for (const s of this.waves.onStep(step, t, t.waves.toWin)) this.addEnemy(s.type, s.hp);
    const waveNow = this.waves.status(step).wave;
    if (waveNow > waveBefore) {
      this.section = this.composer.sectionFor(waveNow);
      this.sectionStartBar = bar;
      this.pass = this.sectionPasses.get(this.section) ?? 0;
      this.sectionPasses.set(this.section, this.pass + 1);
      events.push({ kind: 'impact', steps: spb, big: true });
      triggers.push(`wave:${waveNow}`);
    }
    const pos = this.position(bar, waveNow);

    // Lift: builds over the last bar of a phrase, starts on the next phrase.
    const phraseBar = pos.barInSection % PHRASE;
    if (barChange && this.liftEnd > 0 && step >= this.liftEnd) this.liftEnd = -1;
    if (barChange && this.liftPending && phraseBar === PHRASE - 1) events.push({ kind: 'build', steps: spb });
    if (barChange && this.liftPending && phraseBar === 0) {
      this.liftPending = false;
      this.liftEnd = step + Math.max(1, Math.round(t.lift.bars)) * spb;
      this.hype = 0;
      this.liftReadyFired = false;
      events.push({ kind: 'impact', steps: spb, big: true });
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
      this.playUntil.set(tower.id, nextBarStart(step, spb) + (hold - 1) * spb);
    }
    const playingTowers = new Set(live.filter((tw) => this.isPlaying(tw.id, step)).map((tw) => tw.id));

    // 5. The composer writes the notes; towers attack on their main hits.
    const waves = this.waves.status(step);
    const core = lifted ? 'active' : this.coreMode(step, waves);
    const layers = empty;
    const layerUpgraded = { bass: false, chords: false, arp: false, lead: false };
    const parts = {} as Record<TowerType, PartState>;
    for (const type of TOWER_TYPES) {
      const ofType = live.filter((tw) => tw.type === type);
      const playing = ofType.filter((tw) => playingTowers.has(tw.id));
      const sounding = playing.length > 0 ? playing : ofType;
      layerUpgraded[type] = sounding.some((tw) => tw.upgraded);
      const near = new Set<number>();
      for (const tw of playing) for (const e of targets.get(tw.id) ?? []) near.add(e.id);
      const idleOn = t.engage.idle > -60;
      const mode = ofType.length === 0 ? 'none' : playing.length > 0 ? 'fighting' : idleOn ? 'idle' : 'none';
      layers[type] = {
        mode,
        enemies: near.size,
        staticLevel: ofType.length ? Math.max(...ofType.map((tw) => tw.staticLevel)) : 0,
        muffleLevel: ofType.length ? Math.max(...ofType.map((tw) => tw.muffleLevel)) : 0,
      };
      parts[type] = { mode, upgraded: layerUpgraded[type], variant: this.mods.variants.has(type) };
    }
    const energy = this.energyAt(step, core, waves, lifted);
    const input: ComposeInput = {
      step,
      bar,
      stepInBar,
      section: this.section,
      barInSection: pos.barInSection,
      pass: this.pass,
      wave: waveNow,
      energy,
      flowing: core === 'active',
      lifted,
      core: new Set(this.aliveCore()),
      parts,
    };
    this.lastInput = input;
    const notes = this.composer.compose(input);
    const pumpIds = new Set(this.song.core.filter((l) => l.pump).map((l) => l.id));
    const pumpHit = notes.some((n) => n.attack && pumpIds.has(n.layer));
    if (pumpHit) this.lastPumpStep = step;
    const afterPump = step - this.lastPumpStep === 1 || step - this.lastPumpStep === 2;

    const attacks: Attack[] = [];
    for (const type of TOWER_TYPES) {
      if (layers[type].mode !== 'fighting') continue;
      const part = this.song.parts[type];
      for (const tower of live) {
        if (tower.type !== type || !playingTowers.has(tower.id)) continue;
        const st: PartState = { mode: 'fighting', upgraded: tower.upgraded, variant: this.mods.variants.has(type) };
        if (!this.composer.mainHit(part, input, st)) continue;
        const attack = this.attack(tower, targets.get(tower.id) ?? [], t, afterPump, lifted);
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
    const recover = 1 / (Math.max(0.25, t.fx.recoverBars) * spb);
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
      events.push({ kind: 'downlifter', steps: spb * 2 });
      triggers.push(`cleared:${waves.wave}`);
      if (t.waves.toWin > 0 && waves.wave >= t.waves.toWin) {
        this.victory = true;
      } else if (this.features.rewards) {
        this.rewardOffer = offerRewards(this.rng, this.rewardsTaken, { level: this.levelLike() });
        if (this.rewardOffer.length) triggers.push('rewardOffer');
      }
    }

    // The core sweeps open over the bar before a wave: dress it with a build.
    const coreNow = this.coreMode(step, waves);
    if (coreNow === 'rising' && this.lastCore !== 'rising') events.push({ kind: 'build', steps: Math.max(1, waves.nextWaveStep - step) });
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
      notes,
      pumpHit,
      attacks,
      enemyAttacks,
      kills,
      leaks,
      playingTowers,
      layers,
      core,
      coreHp: { ...this.coreHp },
      enemies,
      waves,
      harmony: pos,
      energy,
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

  /** Steps a layer (core layer id, 'pad' or tower role) plays in the current bar, for the track view. */
  previewSteps(layer: string): number[] {
    const inp = this.lastInput;
    if (!inp) return [];
    const role = (TOWER_TYPES as readonly string[]).includes(layer) ? (layer as TowerType) : null;
    const part = role ? this.song.parts[role] : layer === 'pad' ? this.song.pad : coreLayer(this.song, layer);
    if (!part) return [];
    const st = role ? { ...inp.parts[role], mode: 'fighting' as const } : undefined;
    return this.composer.barPreview(part, { ...inp, stepInBar: 0 }, st);
  }

  /** How hard the track is pushing: resting low, building, a wave rising as it goes, a Lift at full. */
  private energyAt(step: number, core: CoreMode, waves: WaveStatus, lifted: boolean): number {
    if (lifted) return 1;
    if (core === 'resting') return 0.22;
    if (core === 'rising') return 0.5;
    const into = waves.phase === 'wave' ? (step - waves.waveStartStep) / Math.max(1, waves.nextWaveStep - waves.waveStartStep) : 1;
    return Math.min(0.95, 0.6 + 0.25 * Math.min(1, into) + 0.1 * Math.min(1, this.enemies.size / 10));
  }

  /** Resting once the wave has fully spawned and nobody is on the path; rising in the bar before the next wave. */
  coreMode(step: number, waves: WaveStatus): CoreMode {
    if (this.waves.pendingSpawns > 0 || this.enemies.size > 0) return 'active';
    if (this.victory) return 'active';
    const toNext = waves.nextWaveStep - step;
    return toNext > 0 && toNext <= this.stepsPerBar ? 'rising' : 'resting';
  }

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
      // Restore one leak, foundation first.
      const per = Math.max(1, Math.round(t.core.hpPerDrum));
      const order = [...this.song.core].reverse().filter((l) => !l.perk || this.perksOwned.has(l.id));
      const layer = order.find((l) => (this.coreHp[l.id] ?? 0) < per);
      if (layer) this.coreHp[layer.id]!++;
    }
  }

  private emptyLayers(): Record<TowerType, LayerSound> {
    const none = (): LayerSound => ({ mode: 'none', enemies: 0, staticLevel: 0, muffleLevel: 0 });
    return { bass: none(), chords: none(), arp: none(), lead: none() };
  }

  /** Knock `damage` leaks off the core, top layer first. Returns the layer that dropped, if any. */
  private hitCore(damage: number): CoreLayerId | null {
    let dropped: CoreLayerId | null = null;
    let left = Math.max(0, Math.round(damage));
    const foundationId = this.song.core[this.song.core.length - 1]!.id;
    while (left > 0) {
      const layer = this.aliveCore()[0];
      if (!layer) break;
      this.coreHp[layer]!--;
      left--;
      if (this.coreHp[layer] === 0) {
        dropped = layer;
        if (layer === foundationId) this.gameOver = true;
      }
    }
    if (this.aliveCore().length === 0) this.gameOver = true;
    return dropped;
  }

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

  /** Cells an enemy moves on its next step (speed is in cells per beat = 4 steps). */
  private moveFor(e: Enemy, t: Readonly<Tuning>): number {
    if (e.stunLeft > 0) return 0;
    const base = t[e.type].speed / 4;
    return e.slowLeft > 0 ? base * (1 - e.slowAmount) : base;
  }

  private attack(tower: Tower, inRange: Enemy[], t: Readonly<Tuning>, afterPump: boolean, lifted: boolean): Attack | null {
    const alive = inRange.filter((e) => e.hp > 0);
    if (alive.length === 0) return null;
    const stats = towerStats(t, tower.type);
    const combos = this.combos.byTower.get(tower.id);
    const sidechain = afterPump && !!combos?.has('sidechain');
    const crit = !!combos?.has('callResponse') && tower.type === 'lead' && this.rng() < t.combos.callCrit + this.mods.critChance;
    // Damage per bar stays what tuning says, however many notes the song's part plays.
    const density = this.composer.density(this.song.parts[tower.type]);
    const perHit = density > 0 ? Math.max(1, stats.refHits) / density : 1;
    const damage =
      stats.damage *
      perHit *
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

