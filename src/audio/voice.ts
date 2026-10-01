/**
 * Shared bits for instrument voices.
 *
 * Voices build a small native Web Audio graph per hit, scheduled at the exact transport time
 * they are given. Per-hit graphs let hits overlap cleanly and always start at the same phase,
 * which keeps transients consistent. The nodes are garbage collected once they stop.
 */

import * as Tone from 'tone';
import type { Tuning } from '../config/tuning';
import type { HitKind } from '../music/patterns';

export { dbToGain, driveCurve } from './curves';

export interface HitContext {
  kind: HitKind;
  /** 0..1, already resolved from the hit kind via tuning. */
  velocity: number;
  /** 0-based bar, for anything that follows the chords. */
  bar: number;
  /** Absolute 16th step. */
  step: number;
  /** Seconds per 16th at the current tempo. */
  sixteenth: number;
  /** Which hit of the bar this is (0 = first). Melodic voices pick their note from it. */
  hitIndex: number;
}

export abstract class Voice {
  protected readonly context = Tone.getContext();
  /** Everything the voice plays ends up here. Connect to the layer channel. */
  readonly output = new Tone.Gain(1);

  abstract trigger(time: number, hit: HitContext, t: Readonly<Tuning>): void;

  /** Rebuild anything expensive (shaper curves) after a tuning change. */
  applyTuning(_t: Readonly<Tuning>): void {}

  dispose(): void {
    this.output.dispose();
  }

  /** Connect a native node into a Tone node. */
  protected into(node: AudioNode, dest: Tone.ToneAudioNode): void {
    Tone.connect(node as unknown as Tone.OutputNode, dest);
  }

  protected ctx(): BaseAudioContext {
    return this.context.rawContext as unknown as BaseAudioContext;
  }
}

/** 1 second of white noise per audio context, shared by all noise-based voices. */
const noiseBuffers = new WeakMap<object, AudioBuffer>();

export function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  let buf = noiseBuffers.get(ctx);
  if (!buf) {
    buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    noiseBuffers.set(ctx, buf);
  }
  return buf;
}
