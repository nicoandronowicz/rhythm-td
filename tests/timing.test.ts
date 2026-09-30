import { describe, expect, it } from 'vitest';
import {
  isBarStart,
  nextBarStart,
  quantizeToSixteenth,
  sixteenthSeconds,
  stepToPosition,
  swingOffset,
  ticksToStep,
} from '../src/music/timing';

describe('grid timing', () => {
  it('converts transport ticks to 16th steps', () => {
    expect(ticksToStep(0, 192)).toBe(0);
    expect(ticksToStep(48, 192)).toBe(1);
    expect(ticksToStep(192 * 4, 192)).toBe(16);
    // Tiny float drift still lands on the right step.
    expect(ticksToStep(47.9999, 192)).toBe(1);
  });

  it('maps steps to bar, beat and 16th', () => {
    expect(stepToPosition(0)).toEqual({ bar: 0, beat: 0, sixteenth: 0, stepInBar: 0 });
    expect(stepToPosition(5)).toEqual({ bar: 0, beat: 1, sixteenth: 1, stepInBar: 5 });
    expect(stepToPosition(16)).toEqual({ bar: 1, beat: 0, sixteenth: 0, stepInBar: 0 });
    expect(stepToPosition(63)).toEqual({ bar: 3, beat: 3, sixteenth: 3, stepInBar: 15 });
  });

  it('knows bar starts', () => {
    expect(isBarStart(0)).toBe(true);
    expect(isBarStart(16)).toBe(true);
    expect(isBarStart(1)).toBe(false);
    expect(isBarStart(15)).toBe(false);
  });

  it('next bar start is always strictly later', () => {
    expect(nextBarStart(0)).toBe(16);
    expect(nextBarStart(5)).toBe(16);
    expect(nextBarStart(15)).toBe(16);
    expect(nextBarStart(16)).toBe(32);
  });

  it('a 16th at 124 BPM is about 121 ms and a bar about 1.94 s', () => {
    expect(sixteenthSeconds(124)).toBeCloseTo(0.12097, 4);
    expect(sixteenthSeconds(124) * 16).toBeCloseTo(1.935, 3);
  });

  it('quantizes times to the 16th grid', () => {
    const s = sixteenthSeconds(124);
    expect(quantizeToSixteenth(0.4 * s, 124)).toBeCloseTo(0);
    expect(quantizeToSixteenth(0.6 * s, 124)).toBeCloseTo(s);
    expect(quantizeToSixteenth(10.2 * s, 124)).toBeCloseTo(10 * s);
  });

  describe('swing', () => {
    it('no swing means no offset', () => {
      for (let s = 0; s < 16; s++) expect(swingOffset(s, 0, 16, 124)).toBe(0);
    });

    it('16th swing only delays every second 16th', () => {
      const late = [1, 3, 5, 7, 9, 11, 13, 15];
      for (let s = 0; s < 16; s++) {
        const off = swingOffset(s, 0.5, 16, 124);
        if (late.includes(s)) expect(off).toBeGreaterThan(0);
        else expect(off).toBe(0);
      }
    });

    it('8th swing only delays the offbeat 8ths', () => {
      for (let s = 0; s < 16; s++) {
        const off = swingOffset(s, 0.5, 8, 124);
        if ([2, 6, 10, 14].includes(s)) expect(off).toBeGreaterThan(0);
        else expect(off).toBe(0);
      }
    });

    it('never pushes a note past half its slot (stays on its grid step)', () => {
      const s16 = sixteenthSeconds(124);
      expect(swingOffset(1, 1, 16, 124)).toBeCloseTo(0.5 * s16);
      expect(swingOffset(2, 1, 8, 124)).toBeCloseTo(s16);
      expect(swingOffset(1, 5, 16, 124)).toBeCloseTo(0.5 * s16); // clamped
    });
  });
});
