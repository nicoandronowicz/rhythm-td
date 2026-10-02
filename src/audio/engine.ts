/**
 * The audio engine owns the master clock.
 *
 * One repeating event on the Tone.js transport fires every 16th note, slightly ahead of time
 * (look-ahead). On that tick the world advances one step (spawns, movement, who plays, attacks,
 * kills) and every resulting sound is scheduled at the exact transport time of its step (plus swing).
 *
 * Visuals: one-off effects (pulses, shots, kills) go through Tone.Draw; a late one is simply skipped.
 * State the screen must never miss (step, enemies, who is playing, waves) is recorded with its
 * audio time and read by the scene every frame via `audible()`.
 */

import * as Tone from 'tone';
import { tuning } from '../config/tuningStore';
import type { Tuning } from '../config/tuning';
import type { InstrumentId } from '../game/instruments';
import { INSTRUMENTS } from '../game/instruments';
import { velocityFor } from '../game/sequencer';
import type { Attack, CoreMode, EnemyAttack, EnemySnapshot, LayerSound, StepResult, World } from '../game/world';
import { TOWER_TYPES } from '../game/towers';
import type { DrumType } from '../game/core';
import type { TowerType } from '../game/towers';
import type { WaveStatus } from '../game/waves';
import type { HitKind } from '../music/patterns';
import { chordAtBar } from '../music/theory';
import { sixteenthSeconds, stepToPosition, swingOffset, ticksToStep, type GridPosition, type SwingGrid } from '../music/timing';
import { ArpVoice } from './instruments/arp';
import { BassVoice } from './instruments/bass';
import { ChordsVoice } from './instruments/chords';
import { ClapVoice } from './instruments/clap';
import { HatsVoice } from './instruments/hats';
import { KickVoice } from './instruments/kick';
import { LeadVoice } from './instruments/lead';
import { Mixer } from './mixer';
import { StaticNoiseVoice } from './instruments/staticNoise';
import { dbToGain } from './curves';
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
  gameOver: boolean;
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
  };
}

export class AudioEngine {
  private mixer!: Mixer;
  private voices!: Record<InstrumentId, Voice>;
  private listeners = new Set<EngineListener>();
  private started = false;
  /** Scheduled-but-maybe-not-yet-heard steps, oldest first. */
  private timeline: AudibleState[] = [];
  private current: AudibleState | null = null;
  /** Audio time each tower went live. */
  private liveAt = new Map<number, number>();
  private noise!: Record<TowerType, StaticNoiseVoice>;
  private presence = new Map<TowerType, PresenceTarget>();
  private coreMode: CoreMode | null = null;
  private ended = false;

  constructor(private readonly world: World) {}

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

  /** Must be called from a click/tap: browsers only allow audio after a user gesture. */
  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;
    await Tone.start();

    const t = tuning.current;
    this.mixer = new Mixer(t);
    this.voices = createVoices(t);
    for (const id of INSTRUMENTS) this.voices[id].output.connect(this.mixer.layers[id].input);
    this.noise = Object.fromEntries(TOWER_TYPES.map((ty) => [ty, new StaticNoiseVoice()])) as Record<TowerType, StaticNoiseVoice>;
    for (const ty of TOWER_TYPES) this.noise[ty].output.connect(this.mixer.layers[ty].input);
    // Towers start in the distance, the core starts resting.
    const now = Tone.now();
    for (const ty of TOWER_TYPES) this.mixer.layers[ty].setPresence(t.engage.idleCutoff, t.engage.idle, 0.01, now);
    await this.mixer.ready();

    tuning.subscribe((path) => this.onTuningChange(path));

    const transport = Tone.getTransport();
    transport.bpm.value = t.transport.bpm;
    transport.scheduleRepeat((time) => this.tick(time), '16n', 0);
    transport.start('+0.1');
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

  /** True once the bar a tower entered on is being heard. */
  isAudiblyLive(towerId: number): boolean {
    const at = this.liveAt.get(towerId);
    return at !== undefined && at <= this.now();
  }

  togglePause(): void {
    if (!this.started) return;
    const transport = Tone.getTransport();
    if (transport.state === 'started') transport.pause();
    else transport.start('+0.05');
  }

  private onTuningChange(path: string): void {
    const t = tuning.current;
    if (path === 'transport.bpm') Tone.getTransport().bpm.rampTo(t.transport.bpm, 0.05);
    this.mixer.applyTuning(t);
    for (const id of INSTRUMENTS) this.voices[id].applyTuning(t);
  }

  /** The 16th-note tick. `time` is the exact audio time of this step. */
  private tick(time: number): void {
    const transport = Tone.getTransport();
    const t = tuning.current;
    const step = ticksToStep(transport.getTicksAtTime(time), transport.PPQ);
    const pos = stepToPosition(step);
    const bpm = transport.bpm.value;
    const sixteenth = sixteenthSeconds(bpm);

    const r = this.world.onStep(step, t);
    for (const tw of r.entered) this.liveAt.set(tw.id, time);

    // Mix moves: core resting/rising/active, each layer's presence and damage.
    this.applyCore(r.core, r.waves.nextWaveStep - step, time, sixteenth, t);
    const velocityScale = new Map<TowerType, number>();
    for (const ty of TOWER_TYPES) {
      const layer = r.layers[ty];
      this.applyPresence(ty, layer, time, sixteenth, t);
      this.mixer.layers[ty].setDamage(layer.staticLevel, layer.muffleLevel, time, t);
      const k = intensity(layer, t);
      velocityScale.set(ty, layer.mode === 'fighting' ? 0.8 + 0.2 * k : 1);
    }

    const swing = swingOffset(step, t.transport.swing, t.transport.swingGrid as SwingGrid, bpm);
    const hitEvents: HitEvent[] = [];
    for (const hit of r.hits) {
      const tower = (TOWER_TYPES as readonly string[]).includes(hit.instrument) ? (hit.instrument as TowerType) : null;
      const velocity = velocityFor(hit.kind, t.velocity) * (tower ? velocityScale.get(tower)! : 1);
      const ctx = { kind: hit.kind, velocity, bar: pos.bar, step, sixteenth, hitIndex: hit.hitIndex };
      this.voices[hit.instrument].trigger(time + swing, ctx, t);
      if (tower && r.layers[tower].staticLevel > 0.02) {
        const level = Math.min(r.layers[tower].staticLevel, 1) * dbToGain(t.fx.maxNoise);
        this.noise[tower].trigger(time + swing, { ...ctx, velocity: level }, t);
      }
      hitEvents.push({ instrument: hit.instrument, kind: hit.kind, velocity, step });
    }

    if (r.gameOver && !this.ended) {
      this.ended = true;
      this.mixer.fadeOut(sixteenth * 32, time);
    }

    this.timeline.push({
      time,
      stepSeconds: sixteenth,
      step,
      pos,
      chord: chordAtBar(pos.bar).name,
      layers: r.layers,
      playingTowers: r.playingTowers,
      enemies: r.enemies,
      waves: r.waves,
      core: r.core,
      drums: r.drums,
      gameOver: r.gameOver,
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

  /** Tower presence: open (brighter with more enemies) while fighting, distant when idle. */
  private applyPresence(type: TowerType, layer: LayerSound, time: number, sixteenth: number, t: Readonly<Tuning>): void {
    if (layer.mode === 'none') return;
    const target: PresenceTarget =
      layer.mode === 'fighting'
        ? { cutoff: t.engage.calmCutoff * Math.pow(20000 / Math.max(t.engage.calmCutoff, 20), intensity(layer, t)), db: 0 }
        : { cutoff: t.engage.idleCutoff, db: t.engage.idle };
    const prev = this.presence.get(type);
    if (prev && Math.abs(prev.cutoff - target.cutoff) < 1 && Math.abs(prev.db - target.db) < 0.1) return;
    this.presence.set(type, target);
    const opening = !prev || target.cutoff > prev.cutoff || target.db > prev.db;
    const ramp = opening ? 0.03 : Math.max(0.02, t.engage.closeBeats * sixteenth * 4);
    this.mixer.layers[type].setPresence(target.cutoff, target.db, ramp, time);
  }
}

/** 0..1: how hard a fighting layer is pushed, by the number of enemies near it. */
function intensity(layer: LayerSound, t: Readonly<Tuning>): number {
  if (layer.mode !== 'fighting' || layer.enemies <= 1) return 0;
  return Math.min(1, (layer.enemies - 1) / Math.max(1, t.engage.fullIntensity - 1));
}
