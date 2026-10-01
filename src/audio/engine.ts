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
import type { Attack, EnemySnapshot, StepResult, World } from '../game/world';
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
  playingLayers: ReadonlySet<TowerType>;
  playingTowers: ReadonlySet<number>;
  enemies: EnemySnapshot[];
  waves: WaveStatus;
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

    const swing = swingOffset(step, t.transport.swing, t.transport.swingGrid as SwingGrid, bpm);
    const hitEvents: HitEvent[] = [];
    for (const hit of r.hits) {
      const velocity = velocityFor(hit.kind, t.velocity) * hit.gain;
      this.voices[hit.instrument].trigger(
        time + swing,
        { kind: hit.kind, velocity, bar: pos.bar, step, sixteenth, hitIndex: hit.hitIndex },
        t,
      );
      hitEvents.push({ instrument: hit.instrument, kind: hit.kind, velocity, step });
    }

    this.timeline.push({
      time,
      stepSeconds: sixteenth,
      step,
      pos,
      chord: chordAtBar(pos.bar).name,
      playingLayers: r.playingLayers,
      playingTowers: r.playingTowers,
      enemies: r.enemies,
      waves: r.waves,
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
    if (r.kills.length || r.leaks.length) {
      draw.schedule(() => {
        for (const l of this.listeners) {
          for (const k of r.kills) l.onKill?.(k);
          for (const k of r.leaks) l.onLeak?.(k);
        }
      }, time);
    }
  }
}
