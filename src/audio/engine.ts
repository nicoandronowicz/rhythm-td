/**
 * The audio engine owns the master clock.
 *
 * One repeating event on the Tone.js transport fires every 16th note, slightly ahead of time
 * (look-ahead). On that tick the game logic runs (board.onStep), the sequencer decides the hits,
 * and every sound is scheduled at the exact transport time of its step (plus swing).
 *
 * Visuals: hit pulses go through Tone.Draw (a late pulse is simply skipped). State the screen must
 * never miss (which step is audible, which layers are audible, when a tower went live) is recorded
 * with its audio time and read by the scene every frame via `audible()`.
 */

import * as Tone from 'tone';
import { tuning } from '../config/tuningStore';
import type { Tuning } from '../config/tuning';
import type { Board } from '../game/board';
import { hitsForStep, velocityFor, type Hit } from '../game/sequencer';
import { TOWER_TYPES, type TowerType } from '../game/towers';
import { chordAtBar } from '../music/theory';
import { sixteenthSeconds, stepToPosition, swingOffset, ticksToStep, type GridPosition, type SwingGrid } from '../music/timing';
import { BassVoice } from './instruments/bass';
import { ClapVoice } from './instruments/clap';
import { HatsVoice } from './instruments/hats';
import { KickVoice } from './instruments/kick';
import { Mixer } from './mixer';
import type { Voice } from './voice';

/** What the listener hears right now. */
export interface AudibleState {
  step: number;
  pos: GridPosition;
  chord: string;
  active: ReadonlySet<TowerType>;
}

interface Timed<T> {
  time: number;
  value: T;
}

export interface HitEvent extends Hit {
  step: number;
  velocity: number;
}

export interface EngineListener {
  onHit?(e: HitEvent): void;
}

export function createVoices(t: Readonly<Tuning>): Record<TowerType, Voice> {
  return {
    kick: new KickVoice(t),
    clap: new ClapVoice(),
    hats: new HatsVoice(),
    bass: new BassVoice(t),
  };
}

export class AudioEngine {
  private mixer!: Mixer;
  private voices!: Record<TowerType, Voice>;
  private listeners = new Set<EngineListener>();
  private started = false;
  /** Scheduled-but-maybe-not-yet-heard steps, oldest first. */
  private timeline: Timed<AudibleState>[] = [];
  private current: AudibleState | null = null;
  /** Audio time each tower went live. */
  private liveAt = new Map<number, number>();

  constructor(private readonly board: Board) {}

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
    for (const type of TOWER_TYPES) this.voices[type].output.connect(this.mixer.layers[type].input);
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
      this.current = this.timeline.shift()!.value;
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
    for (const type of TOWER_TYPES) this.voices[type].applyTuning(t);
  }

  /** The 16th-note tick. `time` is the exact audio time of this step. */
  private tick(time: number): void {
    const transport = Tone.getTransport();
    const t = tuning.current;
    const step = ticksToStep(transport.getTicksAtTime(time), transport.PPQ);
    const pos = stepToPosition(step);
    const bpm = transport.bpm.value;

    // Game logic first: layers change only on bar starts.
    const barChange = this.board.onStep(step);
    const active = new Set(this.board.activeLayers);
    if (barChange) for (const tw of barChange.entered) this.liveAt.set(tw.id, time);

    const swing = swingOffset(step, t.transport.swing, t.transport.swingGrid as SwingGrid, bpm);
    const hits = hitsForStep(step, active);
    const sixteenth = sixteenthSeconds(bpm);
    const hitEvents: HitEvent[] = [];
    for (const hit of hits) {
      const velocity = velocityFor(hit.kind, t.velocity);
      this.voices[hit.type].trigger(time + swing, { kind: hit.kind, velocity, bar: pos.bar, step, sixteenth }, t);
      hitEvents.push({ ...hit, step, velocity });
    }

    this.timeline.push({ time, value: { step, pos, chord: chordAtBar(pos.bar).name, active } });
    if (this.timeline.length > 64) this.timeline.shift();
    if (hitEvents.length) {
      Tone.getDraw().schedule(() => {
        for (const e of hitEvents) this.listeners.forEach((l) => l.onHit?.(e));
      }, time + swing);
    }
  }
}
