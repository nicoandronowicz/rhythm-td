/**
 * The audio engine owns the master clock.
 *
 * One repeating event on the Tone.js transport fires every 16th note, slightly ahead of time
 * (look-ahead). On that tick the current session's world advances one step, the composer writes the
 * step's notes, and every note is scheduled at the exact transport time of its step, plus swing and the
 * part's own micro-timing.
 *
 * The engine lives for the whole page: `init` once on the first click, then `prepare` (instruments
 * and samples for the level's song) + `load` + `play` for each level, `stop` when going back to the menu.
 *
 * Visuals: one-off effects (pulses, shots, kills) go through Tone.Draw; a late one is simply skipped.
 * State the screen must never miss is recorded with its audio time and read every frame via `audible()`.
 */

import * as Tone from 'tone';
import type { Session } from '../app/session';
import type { Tuning } from '../config/tuning';
import { tuning as store } from '../config/tuningStore';
import type { CoreLayerId } from '../game/core';
import type { CoachTrigger } from '../game/levels';
import { TOWER_TYPES, type TowerType } from '../game/towers';
import type { WaveStatus } from '../game/waves';
import type { Attack, CoreMode, EnemyAttack, EnemySnapshot, LayerSound, StepResult } from '../game/world';
import type { NoteEvent } from '../music/compose';
import type { SongDef } from '../music/song';
import { sixteenthSeconds, stepToPosition, swingOffset, ticksToStep, type GridPosition, type SwingGrid } from '../music/timing';
import { loadGroup } from './bank';
import { dbToGain } from './curves';
import { TransitionFx } from './fx';
import { Mixer } from './mixer';
import { createVoice, type PatchVoice } from './voices';

/** What the listener hears at a step. */
export interface AudibleState {
  time: number;
  stepSeconds: number;
  step: number;
  stepsPerBar: number;
  pos: GridPosition;
  chord: string;
  layers: Record<TowerType, LayerSound>;
  playingTowers: ReadonlySet<number>;
  enemies: EnemySnapshot[];
  waves: WaveStatus;
  core: CoreMode;
  coreHp: Record<CoreLayerId, number>;
  combos: StepResult['combos'];
  layerUpgraded: StepResult['layerUpgraded'];
  perksOwned: StepResult['perksOwned'];
  hype: number;
  lifted: boolean;
  liftPending: boolean;
  gameOver: boolean;
  victory: boolean;
}

export interface HitEvent {
  /** Layer id: a core layer, 'pad', or a tower role. */
  layer: string;
  velocity: number;
  step: number;
}

export interface EngineListener {
  onHit?(e: HitEvent): void;
  onAttack?(e: Attack): void;
  onKill?(e: StepResult['kills'][number]): void;
  onLeak?(e: StepResult['leaks'][number]): void;
  onEnemyAttack?(e: EnemyAttack): void;
}

interface PresenceTarget {
  cutoff: number;
  db: number;
}

export class AudioEngine {
  private mixer!: Mixer;
  private fx!: TransitionFx;
  private voices = new Map<string, PatchVoice>();
  private listeners = new Set<EngineListener>();
  private ready = false;
  private session: Session | null = null;
  private song: SongDef | null = null;
  private timeline: AudibleState[] = [];
  private current: AudibleState | null = null;
  private liveAt = new Map<number, number>();
  private presence = new Map<TowerType, PresenceTarget>();
  private coreMode: CoreMode | null = null;
  private lifted = false;
  private ended = false;
  /** Audio time the current run started; earlier ticks are left over from the previous run. */
  private runStart = Infinity;
  private triggerQueue: { time: number; trigger: CoachTrigger }[] = [];
  private rewardsSeen = 0;

  addListener(l: EngineListener): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  get bpm(): number {
    return Tone.getTransport().bpm.value;
  }

  get isPlaying(): boolean {
    return Tone.getTransport().state === 'started';
  }

  get isReady(): boolean {
    return this.ready;
  }

  /** Dev hook: runs before every step (the offline renderer uses it to play like a player). */
  beforeStep: ((step: number) => void) | null = null;
  /** Dev: layers that make no sound (for measuring what each one costs). */
  readonly muted = new Set<string>();

  /** Must be called from a click/tap: browsers only allow audio after a user gesture. */
  async init(opts: { offline?: boolean } = {}): Promise<void> {
    if (this.ready) return;
    if (!opts.offline) await Tone.start();
    if (!opts.offline) Tone.getContext().lookAhead = 0.1;
    this.mixer = new Mixer();
    this.fx = new TransitionFx();
    this.fx.output.connect(this.mixer.fx);
    if (!opts.offline) store.subscribe(() => this.applyMix());
    Tone.getTransport().scheduleRepeat((time) => this.tick(time), '16n', 0);
    this.ready = true;
    // The crash and reverse cymbal in transitions use the hi-hat samples.
    void loadGroup('hihat');
  }

  /** Build the song's instruments and load its samples. Call before `load` when the song changes. */
  async prepare(song: SongDef): Promise<void> {
    if (this.song === song) return;
    this.stop();
    for (const v of this.voices.values()) v.dispose();
    this.voices.clear();
    this.mixer.build(song);
    const layers: [string, string][] = [
      ...song.core.map((l) => [l.id, l.patch] as [string, string]),
      ['pad', song.pad.patch],
      ...TOWER_TYPES.map((r) => [r, song.parts[r].patch] as [string, string]),
    ];
    const banks = new Set<string>(['hihat']);
    for (const [layer, patchId] of layers) {
      const patch = song.patches[patchId];
      if (!patch) throw new Error(`Song ${song.id}: no patch "${patchId}"`);
      const voice = createVoice(patch);
      voice.output.connect(this.mixer.layer(layer).input);
      this.voices.set(`${layer}:${patchId}`, voice);
      for (const b of voice.banks()) banks.add(b);
    }
    await Promise.all([...banks].map(loadGroup));
    this.song = song;
  }

  /** Get ready to play a session from its first step (its song must be prepared). */
  load(session: Session): void {
    this.stop();
    if (session.song !== this.song) throw new Error('Engine: prepare the song before loading the session');
    this.session = session;
    this.timeline = [];
    this.current = null;
    this.liveAt.clear();
    this.presence.clear();
    this.coreMode = null;
    this.lifted = false;
    this.ended = false;
    this.runStart = Infinity;
    this.triggerQueue = [];
    this.rewardsSeen = 0;
    const t = session.tuning;
    this.applyMix();
    this.mixer.reset(t);
    const now = Tone.now();
    for (const ty of TOWER_TYPES) this.mixer.layer(ty).setPresence(t.engage.idleCutoff, t.engage.idle, 0.01, now);
    Tone.getTransport().bpm.value = this.tempo(t);
  }

  private tempo(t: Readonly<Tuning>): number {
    return Math.min(200, Math.max(50, (this.song?.bpm ?? 120) + t.transport.tempo));
  }

  private applyMix(): void {
    const s = this.session;
    if (!s || !this.song) return;
    const t = s.tuning;
    this.mixer.apply(t, s.world.mods, this.tempo(t));
    const transport = Tone.getTransport();
    if (Math.abs(transport.bpm.value - this.tempo(t)) > 0.01) transport.bpm.rampTo(this.tempo(t), 0.05);
  }

  play(): void {
    const transport = Tone.getTransport();
    transport.stop();
    transport.position = 0;
    this.runStart = Tone.now() + 0.12;
    transport.start(this.runStart);
  }

  stop(): void {
    if (!this.ready) return;
    Tone.getTransport().stop();
    Tone.getDraw().cancel(0);
  }

  /** The live audio context (dev checks: playback stats). */
  get rawContext(): BaseAudioContext {
    return Tone.getContext().rawContext as unknown as BaseAudioContext;
  }

  now(): number {
    return Tone.getContext().rawContext.currentTime;
  }

  audible(): AudibleState | null {
    const now = this.now();
    while (this.timeline.length && this.timeline[0]!.time <= now) this.current = this.timeline.shift()!;
    return this.current;
  }

  drainTriggers(): CoachTrigger[] {
    const now = this.now();
    const out: CoachTrigger[] = [];
    while (this.triggerQueue.length && this.triggerQueue[0]!.time <= now) out.push(this.triggerQueue.shift()!.trigger);
    return out;
  }

  isAudiblyLive(towerId: number): boolean {
    const at = this.liveAt.get(towerId);
    return at !== undefined && at <= this.now();
  }

  togglePause(): void {
    this.setPaused(this.isPlaying);
  }

  setPaused(paused: boolean): void {
    if (!this.ready || !this.session) return;
    const transport = Tone.getTransport();
    if (paused && transport.state === 'started') transport.pause();
    if (!paused && transport.state !== 'started') transport.start('+0.05');
  }

  /** The 16th-note tick. `time` is the exact audio time of this step. */
  private tick(time: number): void {
    const session = this.session;
    const song = this.song;
    if (!session || !song || time < this.runStart - 0.001) return;
    const transport = Tone.getTransport();
    const t = session.tuning;
    const spb = song.stepsPerBar;
    const step = ticksToStep(transport.getTicksAtTime(time), transport.PPQ);
    const pos = stepToPosition(step, spb);
    const bpm = transport.bpm.value;
    const sixteenth = sixteenthSeconds(bpm);
    this.beforeStep?.(step);

    const world = session.world;
    const r = world.onStep(step, t);
    if (world.rewardsTaken.length !== this.rewardsSeen) {
      this.rewardsSeen = world.rewardsTaken.length;
      this.applyMix();
    }
    for (const tw of r.entered) this.liveAt.set(tw.id, time);

    // Mix moves: core resting/rising/active, Lift, each layer's presence and damage.
    this.applyCore(r.core, r.waves.nextWaveStep - step, time, sixteenth, t);
    this.applyLift(r.lifted, time, sixteenth);
    for (const ty of TOWER_TYPES) {
      const layer = r.layers[ty];
      this.applyPresence(ty, layer, r.lifted, time, sixteenth, t);
      this.mixer.layer(ty).setDamage(layer.staticLevel, layer.muffleLevel, time, t);
    }

    for (const ev of r.events) {
      if (ev.kind === 'build') this.fx.build(time, ev.steps * sixteenth, sixteenth, true);
      else if (ev.kind === 'impact') this.fx.impact(time, ev.big ?? true);
      else this.fx.downlifter(time, ev.steps * sixteenth);
    }

    const swingAmount = Math.min(1, song.swing + t.transport.swing + world.mods.swing);
    const swing = swingOffset(step, swingAmount, t.transport.swingGrid as SwingGrid, bpm);
    const crits = new Set(r.attacks.filter((a) => a.crit).map((a) => a.type));
    const width = world.mods.width;

    if (r.pumpHit) {
      const at = time + swing;
      const base = song.mix.pump.depth * t.groove.pump;
      const release = sixteenth * song.mix.pump.release;
      for (const id of this.mixer.layerIds) {
        if (song.core.some((l) => l.id === id && l.pump)) continue;
        const isTower = (TOWER_TYPES as readonly string[]).includes(id);
        const combo = isTower && r.pump.has(id as TowerType);
        const depth = combo ? t.combos.sidechainPump + world.mods.pump : id === 'pad' ? base * 1.3 : isTower ? base : base * 0.35;
        this.mixer.layer(id).duck(depth, combo ? release * 1.2 : release, at);
      }
    }

    const hits: HitEvent[] = [];
    for (const n of r.notes) this.playNote(n, time + swing, sixteenth, width, crits, r, t, hits);

    if ((r.gameOver || r.victory) && !this.ended) {
      this.ended = true;
      if (r.gameOver) this.mixer.tapeStop(sixteenth * 24, time);
    }

    this.timeline.push({
      time,
      stepSeconds: sixteenth,
      step,
      stepsPerBar: spb,
      pos,
      chord: r.harmony.chord.name,
      layers: r.layers,
      playingTowers: r.playingTowers,
      enemies: r.enemies,
      waves: r.waves,
      core: r.core,
      coreHp: r.coreHp,
      combos: r.combos,
      layerUpgraded: r.layerUpgraded,
      perksOwned: r.perksOwned,
      hype: r.hype,
      lifted: r.lifted,
      liftPending: r.liftPending,
      gameOver: r.gameOver,
      victory: r.victory,
    });
    if (this.timeline.length > 64) this.timeline.shift();

    const draw = Tone.getDraw();
    if (hits.length || r.attacks.length) {
      draw.schedule(() => {
        for (const l of this.listeners) {
          for (const e of hits) l.onHit?.(e);
          for (const a of r.attacks) l.onAttack?.(a);
        }
      }, time + swing);
    }
    for (const trigger of r.triggers) this.triggerQueue.push({ time, trigger });
    if (r.kills.length || r.leaks.length || r.enemyAttacks.length) {
      draw.schedule(() => {
        for (const l of this.listeners) {
          for (const k of r.kills) l.onKill?.(k);
          for (const k of r.leaks) l.onLeak?.(k);
          for (const a of r.enemyAttacks) l.onEnemyAttack?.(a);
        }
      }, time);
    }
  }

  private playNote(n: NoteEvent, at: number, sixteenth: number, width: number, crits: Set<TowerType>, r: StepResult, t: Readonly<Tuning>, hits: HitEvent[]): void {
    const voice = this.voices.get(`${n.layer}:${n.patch}`);
    if (!voice || this.muted.has(n.layer)) return;
    const tower = (TOWER_TYPES as readonly string[]).includes(n.layer) ? (n.layer as TowerType) : null;
    let vel = n.vel;
    if (tower) {
      const layer = r.layers[tower];
      // Harder with more enemies near; a crit lands accented.
      if (layer.mode === 'fighting') vel *= 0.85 + 0.15 * intensity(layer, t);
      if (crits.has(tower) && n.attack) vel = Math.min(1, vel * 1.18);
    }
    const time = at + n.offset * sixteenth;
    voice.play({
      time,
      notes: n.notes,
      hold: Math.max(0.03, n.len * sixteenth * 0.96),
      vel,
      mod: n.mod,
      art: n.art,
      slide: n.slide,
      strum: n.strum,
      width,
      lite: tower !== null && r.layers[tower].mode !== 'fighting',
    });
    if (tower && r.layers[tower].staticLevel > 0.02 && n.attack) {
      const level = Math.min(r.layers[tower].staticLevel, 1) * dbToGain(t.fx.maxNoise);
      this.fx.crackle(time, level, this.mixer.layer(tower).input);
    }
    // Long lead notes get thrown into the delay (dub-style echo tail).
    if (n.layer === 'lead' && n.len >= 8 && r.layers.lead.mode === 'fighting' && t.groove.throw > 0) {
      this.mixer.throwDelay('lead', t.groove.throw, time, sixteenth * 2);
    }
    if (n.attack || !tower) hits.push({ layer: n.layer, velocity: vel, step: r.step });
  }

  private applyCore(mode: CoreMode, stepsToWave: number, time: number, sixteenth: number, t: Readonly<Tuning>): void {
    if (mode === this.coreMode) return;
    const previous = this.coreMode;
    this.coreMode = mode;
    if (mode === 'resting') this.mixer.setCore(t.core.restCutoff, t.core.restVolume, previous === null ? 0.01 : sixteenth * 8, time);
    else if (mode === 'rising') this.mixer.setCore(20000, 0, Math.max(1, stepsToWave) * sixteenth, time);
    else if (previous !== 'rising') this.mixer.setCore(20000, 0, 0.04, time);
  }

  private applyLift(lifted: boolean, time: number, sixteenth: number): void {
    if (lifted === this.lifted) return;
    this.lifted = lifted;
    this.mixer.layer('pad').setPresence(20000, lifted ? 4 : 0, lifted ? sixteenth * 2 : sixteenth * 16, time);
  }

  private applyPresence(type: TowerType, layer: LayerSound, lifted: boolean, time: number, sixteenth: number, t: Readonly<Tuning>): void {
    if (layer.mode === 'none') return;
    const target: PresenceTarget =
      layer.mode === 'fighting'
        ? {
            cutoff: lifted ? 20000 : t.engage.calmCutoff * Math.pow(20000 / Math.max(t.engage.calmCutoff, 20), intensity(layer, t)),
            db: 0,
          }
        : { cutoff: t.engage.idleCutoff, db: t.engage.idle };
    const prev = this.presence.get(type);
    if (prev && Math.abs(prev.cutoff - target.cutoff) < 1 && Math.abs(prev.db - target.db) < 0.1) return;
    this.presence.set(type, target);
    const beat = sixteenth * 4;
    const fromIdle = !prev || target.db > prev.db;
    const brighter = target.cutoff > (prev?.cutoff ?? 0);
    const ramp = fromIdle ? Math.max(0.03, t.engage.openBeats * beat) : brighter ? beat / 4 : Math.max(0.03, t.engage.closeBeats * beat);
    this.mixer.layer(type).setPresence(target.cutoff, target.db, ramp, time);
  }
}

function intensity(layer: LayerSound, t: Readonly<Tuning>): number {
  if (layer.mode !== 'fighting' || layer.enemies <= 1) return 0;
  return Math.min(1, (layer.enemies - 1) / Math.max(1, t.engage.fullIntensity - 1));
}
