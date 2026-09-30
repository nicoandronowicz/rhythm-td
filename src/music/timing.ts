/**
 * Grid math: steps, bars, quantization, swing. Pure, no Tone.js.
 *
 * A "step" is an absolute 16th-note index counted from the start of the transport (step 0 = bar 1, beat 1).
 */

import { STEPS_PER_BAR } from './patterns';

export const STEPS_PER_BEAT = 4;

export interface GridPosition {
  /** 0-based bar index. */
  bar: number;
  /** 0-based beat inside the bar (0..3). */
  beat: number;
  /** 0-based 16th inside the beat (0..3). */
  sixteenth: number;
  /** 0-based step inside the bar (0..15). */
  stepInBar: number;
}

/** Convert transport ticks to the nearest 16th step. */
export function ticksToStep(ticks: number, ppq: number): number {
  const ticksPerStep = ppq / STEPS_PER_BEAT;
  return Math.round(ticks / ticksPerStep);
}

export function stepToPosition(step: number): GridPosition {
  const bar = Math.floor(step / STEPS_PER_BAR);
  const stepInBar = step - bar * STEPS_PER_BAR;
  return {
    bar,
    beat: Math.floor(stepInBar / STEPS_PER_BEAT),
    sixteenth: stepInBar % STEPS_PER_BEAT,
    stepInBar,
  };
}

export function isBarStart(step: number): boolean {
  return ((step % STEPS_PER_BAR) + STEPS_PER_BAR) % STEPS_PER_BAR === 0;
}

/**
 * The first bar-start step strictly after `step`.
 * Something requested while `step` is (or has been) processed enters here.
 */
export function nextBarStart(step: number): number {
  return (Math.floor(step / STEPS_PER_BAR) + 1) * STEPS_PER_BAR;
}

/** Seconds per 16th at a tempo. */
export function sixteenthSeconds(bpm: number): number {
  return 60 / bpm / STEPS_PER_BEAT;
}

/** Snap a time in seconds to the nearest 16th at a tempo (time 0 = step 0). */
export function quantizeToSixteenth(seconds: number, bpm: number): number {
  const s = sixteenthSeconds(bpm);
  return Math.round(seconds / s) * s;
}

export type SwingGrid = 8 | 16;

/**
 * Delay (in seconds) applied to an off-grid note for swing.
 *
 * swing 0 = straight, 1 = hard shuffle (the late note lands at 75% of its pair, MPC-style max).
 * grid 16: every second 16th (steps 1, 3, 5...) is pushed late.
 * grid 8: every second 8th (steps 2, 6, 10, 14) is pushed late.
 */
export function swingOffset(step: number, swing: number, grid: SwingGrid, bpm: number): number {
  const amount = Math.min(Math.max(swing, 0), 1);
  if (amount === 0) return 0;
  const unitSteps = grid === 16 ? 1 : 2;
  const posInPair = ((step % (unitSteps * 2)) + unitSteps * 2) % (unitSteps * 2);
  if (posInPair !== unitSteps) return 0;
  const unitSeconds = sixteenthSeconds(bpm) * unitSteps;
  return amount * 0.5 * unitSeconds;
}
