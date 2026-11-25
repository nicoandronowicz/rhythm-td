/**
 * The audio engine owns the master clock.
 *
 * One repeating event on the Tone.js transport fires every 16th note, slightly ahead of time
 * (look-ahead). On that tick the current session's world advances one step and every resulting
 * sound is scheduled at the exact transport time of its step, plus swing and each instrument's
 * micro-timing (a laid-back clap, loose percussion).
 *
 * The engine lives for the whole page: `init` once on the first click, then `load` + `play` for each
 * level, `stop` when going back to the menu.
 *
 * Visuals: one-off effects (pulses, shots, kills) go through Tone.Draw; a late one is simply skipped.
 * State the screen must never miss (step, enemies, who is playing, waves) is recorded with its
 * audio time and read by the scene every frame via `audible()`.
 */

import * as Tone from 'tone';
import type { Session } from '../app/session';
import type { Tuning } from '../config/tuning';
import { tuning as store } from '../config/tuningStore';
import type { DrumType } from '../game/core';
import { INSTRUMENTS, type InstrumentId } from '../game/instruments';
import { velocityFor } from '../game/sequencer';
import { TOWER_TYPES, type TowerType } from '../game/towers';
import type { WaveStatus } from '../game/waves';
import type { Attack, CoreMode, EnemyAttack, EnemySnapshot, LayerSound, StepResult } from '../game/world';
import type { CoachTrigger } from '../game/levels';
import type { HitKind } from '../music/patterns';
import { sixteenthSeconds, stepToPosition, swingOffset, ticksToStep, type GridPosition, type SwingGrid } from '../music/timing';
import { dbToGain } from './curves';
import { ArpVoice } from './instruments/arp';
import { BassVoice } from './instruments/bass';
import { ChordsVoice } from './instruments/chords';
import { ClapVoice } from './instruments/clap';
import { FxVoice } from './instruments/fx';
import { HatsVoice } from './instruments/hats';
import { KickVoice } from './instruments/kick';
import { LeadVoice } from './instruments/lead';
import { PadVoice } from './instruments/pad';
import { RimVoice } from './instruments/rim';
import { ShakerVoice } from './instruments/shaker';
import { StaticNoiseVoice } from './instruments/staticNoise';
import { Mixer } from './mixer';
import type { Voice } from './voice';

/** What the listener hears at a step. */
export interface AudibleState {
  /** Audio time of the step. */
  time: number;
  /** Seconds per 16th at the time. */
  stepSeconds: number;
  step: number;
  pos: GridPosition;
  chord: string;
  layers: Record<TowerType, LayerSound>;
  playingTowers: ReadonlySet<number>;
  enemies: EnemySnapshot[];
  waves: WaveStatus;
  core: CoreMode;
  drums: Record<DrumType, number>;
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
  instrument: InstrumentId;
  kind: HitKind;
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

/** Where a tower layer's presence is heading. */
interface PresenceTarget {
  cutoff: number;
  db: number;
}

export function createVoices(t: Readonly<Tuning>): Record<InstrumentId, Voice> {
  return {
    kick: new KickVoice(t),
    clap: new ClapVoice(),
    hats: new HatsVoice(),
    bass: new BassVoice(t),
    chords: new ChordsVoice(),
    arp: new ArpVoice(),
    lead: new LeadVoice(),
    shaker: new ShakerVoice(),
    rim: new RimVoice(),
    openhat: new HatsVoice((x) => x.openhat.decay),
    pad: new PadVoice(),
  };
}

/** Micro-timing per instrument, seconds (positive = behind the grid). */
function grooveOffset(id: InstrumentId, t: Readonly<Tuning>): number {
  const g = t.groove;
  const loose = () => ((Math.random() - 0.5) * 2 * g.loose) / 1000;
  switch (id) {
    case 'clap':
      return g.clapLate / 1000 + loose() * 0.3;
    case 'hats':
    case 'openhat':
      return g.hatsLate / 1000 + loose() * 0.3;
    case 'shaker':
    case 'rim':
      return loose();
    default:
      return 0;
  }
}

export class AudioEngine {
  private mixer!: Mixer;
  private voices!: Record<InstrumentId, Voice>;
  private noise!: Record<TowerType, StaticNoiseVoice>;
  private fxVoice!: FxVoice;
  private listeners = new Set<EngineListener>();
  private ready = false;
  private session: Session | null = null;
  /** Scheduled-but-maybe-not-yet-heard steps, oldest first. */
  private timeline: AudibleState[] = [];
  private current: AudibleState | null = null;
  /** Audio time each tower went live. */
  private liveAt = new Map<number, number>();
  private presence = new Map<TowerType, PresenceTarget>();
  private coreMode: CoreMode | null = null;
  private lifted = false;
  private ended = false;
  /**
   * Audio time the current run started. Ticks before it are left over from the previous run's clock
   * (the transport can fire a few late ones after a stop) and must not reach the new world.
   */
  private runStart = Infinity;
  /** Coach triggers with the audio time they happen, never dropped (see `drainTriggers`). */
  private triggerQueue: { time: number; trigger: CoachTrigger }[] = [];

  addListener(l: EngineListener): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  /** Tempo the transport is actually running at. */
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

  /** Must be called from a click/tap: browsers only allow audio after a user gesture. `offline` is for dev renders. */
  async init(opts: { offline?: boolean } = {}): Promise<void> {
    if (this.ready) return;
    if (!opts.offline) await Tone.start();
    if (!opts.offline) Tone.getContext().lookAhead = 0.1;
    const t = store.current;
    this.mixer = new Mixer(t);
    this.voices = createVoices(t);
    for (const id of INSTRUMENTS) this.voices[id].output.connect(this.mixer.layers[id].input);
    this.noise = Object.fromEntries(TOWER_TYPES.map((ty) => [ty, new StaticNoiseVoice()])) as Record<TowerType, StaticNoiseVoice>;
    for (const ty of TOWER_TYPES) this.noise[ty].output.connect(this.mixer.layers[ty].input);
    this.fxVoice = new FxVoice();
    this.fxVoice.output.connect(this.mixer.fx);
    await this.mixer.ready();

    if (!opts.offline) store.subscribe((path) => this.onTuningChange(path));
    Tone.getTransport().scheduleRepeat((time) => this.tick(time), '16n', 0);
    this.ready = true;
  }

  /** Get ready to play a session from its first step. */
  load(session: Session): void {
    this.stop();
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
    const t = session.audioTuning;
    this.mixer.applyTuning(t);
    this.mixer.reset(t);
    for (const id of INSTRUMENTS) this.voices[id].applyTuning(t);
    const now = Tone.now();
    for (const ty of TOWER_TYPES) this.mixer.layers[ty].setPresence(t.engage.idleCutoff, t.engage.idle, 0.01, now);
    Tone.getTransport().bpm.value = t.transport.bpm;
  }

  play(): void {
    const transport = Tone.getTransport();
    transport.stop();
    transport.position = 0;
    this.runStart = Tone.now() + 0.12;
    transport.start(this.runStart);
  }

  /** Stop the clock (back to the menu or before a new level). */
  stop(): void {
    if (!this.ready) return;
    Tone.getTransport().stop();
    Tone.getDraw().cancel(0);
  }

  /** Audio clock time the listener is hearing now. */
  now(): number {
    return Tone.getContext().rawContext.currentTime;
  }

  /** The latest scheduled step whose time has come. Null before the first step is heard. */
  audible(): AudibleState | null {
    const now = this.now();
    while (this.timeline.length && this.timeline[0]!.time <= now) {
      this.current = this.timeline.shift()!;
    }
    return this.current;
  }

  /** Coach triggers whose time has come, in order. Unlike Tone.Draw events, these are never skipped. */
  drainTriggers(): CoachTrigger[] {
    const now = this.now();
    const out: CoachTrigger[] = [];
    while (this.triggerQueue.length && this.triggerQueue[0]!.time <= now) out.push(this.triggerQueue.shift()!.trigger);
    return out;
  }

  /** True once the bar a tower entered on is being heard. */
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

  private onTuningChange(path: string): void {
    if (!this.session) return;
    const t = this.session.audioTuning;
    if (path.startsWith('transport.bpm') || path.endsWith('.bpm')) Tone.getTransport().bpm.rampTo(t.transport.bpm, 0.05);
    this.mixer.applyTuning(t);
    for (const id of INSTRUMENTS) this.voices[id].applyTuning(t);
  }

  /** The 16th-note tick. `time` is the exact audio time of this step. */
  private tick(time: number): void {
    const session = this.session;
    if (!session || time < this.runStart - 0.001) return;
    const transport = Tone.getTransport();
    const t = session.audioTuning;
    const step = ticksToStep(transport.getTicksAtTime(time), transport.PPQ);
    const pos = stepToPosition(step);
    const bpm = transport.bpm.value;
    const sixteenth = sixteenthSeconds(bpm);
    this.beforeStep?.(step);

    const before = session.world.rewardsTaken.length;
    const r = session.world.onStep(step, session.tuning);
    // A reward that just landed can change the sound: re-apply.
    if (session.world.rewardsTaken.length !== before) {
      const a = session.audioTuning;
      this.mixer.applyTuning(a);
      for (const id of INSTRUMENTS) this.voices[id].applyTuning(a);
    }
    for (const tw of r.entered) this.liveAt.set(tw.id, time);

    // Mix moves: core resting/rising/active, Lift, each layer's presence and damage.
    this.applyCore(r.core, r.waves.nextWaveStep - step, time, sixteenth, t);
    this.applyLift(r.lifted, time, sixteenth);
    const velocityScale = new Map<TowerType, number>();
    for (const ty of TOWER_TYPES) {
      const layer = r.layers[ty];
      this.applyPresence(ty, layer, r.lifted, time, sixteenth, t);
      this.mixer.layers[ty].setDamage(layer.staticLevel, layer.muffleLevel, time, t);
      const k = intensity(layer, t);
      velocityScale.set(ty, layer.mode === 'fighting' ? 0.8 + 0.2 * k : 1);
    }

    // Arrangement moments.
    for (const ev of r.events) {
      if (ev.kind === 'riser') this.fxVoice.riser(time, ev.steps * sixteenth);
      else if (ev.kind === 'impact') this.fxVoice.impact(time);
      else this.fxVoice.downlifter(time, ev.steps * sixteenth);
    }

    const swing = swingOffset(step, t.transport.swing, t.transport.swingGrid as SwingGrid, bpm);
    const crits = new Set(r.attacks.filter((a) => a.crit).map((a) => a.type));
    const width = session.world.mods.width;
    const hitEvents: HitEvent[] = [];
    for (const hit of r.hits) {
      const tower = (TOWER_TYPES as readonly string[]).includes(hit.instrument) ? (hit.instrument as TowerType) : null;
      const kind = tower && crits.has(tower) ? 'accent' : hit.kind;
      const human = hit.instrument === 'kick' || hit.instrument === 'pad' ? 1 : 1 + (Math.random() - 0.5) * 2 * t.groove.humanize;
      const velocity =
        velocityFor(kind, t.velocity) * (tower ? velocityScale.get(tower)! : 1) * (kind !== hit.kind ? 1.15 : 1) * human;
      const at = time + swing + grooveOffset(hit.instrument, t);
      if (hit.instrument === 'kick') {
        // The whole track breathes with the kick; Sidechain makes chords and bass pump hard.
        for (const ty of TOWER_TYPES) {
          const depth = r.pump.has(ty) ? t.combos.sidechainPump : t.groove.pump;
          this.mixer.layers[ty].duck(depth, sixteenth * 3, at);
        }
        this.mixer.layers.pad.duck(t.groove.pump * 1.4, sixteenth * 3.5, at);
      }
      const ctx = {
        kind: hit.kind,
        velocity,
        chord: r.harmony.chord,
        nextChord: r.harmony.nextChord,
        phraseBar: r.harmony.phraseBar,
        wave: r.harmony.wave,
        step,
        sixteenth,
        hitIndex: hit.hitIndex,
        approach: hit.approach,
        sustainBars: hit.sustainBars,
        width,
      };
      this.voices[hit.instrument].trigger(at, ctx, t);
      if (tower && r.layers[tower].staticLevel > 0.02) {
        const level = Math.min(r.layers[tower].staticLevel, 1) * dbToGain(t.fx.maxNoise);
        this.noise[tower].trigger(at, { ...ctx, velocity: level }, t);
      }
      // The lead's last note of a phrase gets thrown into the delay.
      if (hit.instrument === 'lead' && hit.phraseEnd && r.layers.lead.mode === 'fighting' && t.groove.throw > 0) {
        this.mixer.throwDelay('lead', t.groove.throw, at, sixteenth * 2);
      }
      hitEvents.push({ instrument: hit.instrument, kind: hit.kind, velocity, step });
    }

    if ((r.gameOver || r.victory) && !this.ended) {
      this.ended = true;
      if (r.gameOver) this.mixer.fadeOut(sixteenth * 32, time);
    }

    this.timeline.push({
      time,
      stepSeconds: sixteenth,
      step,
      pos,
      chord: r.harmony.chord.name,
      layers: r.layers,
      playingTowers: r.playingTowers,
      enemies: r.enemies,
      waves: r.waves,
      core: r.core,
      drums: r.drums,
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
    if (hitEvents.length || r.attacks.length) {
      draw.schedule(() => {
        for (const l of this.listeners) {
          for (const e of hitEvents) l.onHit?.(e);
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

  /** Core: rests between waves, sweeps open over the bar before a wave, snaps open otherwise. */
  private applyCore(mode: CoreMode, stepsToWave: number, time: number, sixteenth: number, t: Readonly<Tuning>): void {
    if (mode === this.coreMode) return;
    const previous = this.coreMode;
    this.coreMode = mode;
    if (mode === 'resting') this.mixer.setCore(t.core.restCutoff, t.core.restVolume, previous === null ? 0.01 : sixteenth * 4, time);
    else if (mode === 'rising') this.mixer.setCore(20000, 0, Math.max(1, stepsToWave) * sixteenth, time);
    else if (previous !== 'rising') this.mixer.setCore(20000, 0, 0.04, time);
  }

  /** Lift: the pad swells and the core pushes a little louder for the lifted phrase. */
  private applyLift(lifted: boolean, time: number, sixteenth: number): void {
    if (lifted === this.lifted) return;
    this.lifted = lifted;
    const pad = this.mixer.layers.pad;
    pad.setPresence(20000, lifted ? 5 : 0, lifted ? sixteenth * 2 : sixteenth * 16, time);
  }

  /** Tower presence: open (brighter with more enemies) while fighting, distant when idle, wide open in a Lift. */
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
    // Coming in from idle fades over `openBeats`; getting brighter with more enemies takes a quarter beat;
    // settling back down takes `closeBeats`.
    const ramp = fromIdle ? Math.max(0.03, t.engage.openBeats * beat) : brighter ? beat / 4 : Math.max(0.03, t.engage.closeBeats * beat);
    this.mixer.layers[type].setPresence(target.cutoff, target.db, ramp, time);
  }
}

/** 0..1: how hard a fighting layer is pushed, by the number of enemies near it. */
function intensity(layer: LayerSound, t: Readonly<Tuning>): number {
  if (layer.mode !== 'fighting' || layer.enemies <= 1) return 0;
  return Math.min(1, (layer.enemies - 1) / Math.max(1, t.engage.fullIntensity - 1));
}
