import { describe, expect, it } from 'vitest';
import { dbToGain, driveCurve, safetyCurve } from '../src/audio/curves';

describe('audio curves', () => {
  it('drive 0 is clean', () => {
    const c = driveCurve(0);
    for (const x of [-1, -0.3, 0, 0.5, 1]) expect(c(x)).toBe(x);
  });

  it('drive keeps full scale at full scale and is monotonic', () => {
    const c = driveCurve(0.7);
    expect(c(1)).toBeCloseTo(1);
    expect(c(-1)).toBeCloseTo(-1);
    let prev = -Infinity;
    for (let x = -1; x <= 1; x += 0.01) {
      expect(c(x)).toBeGreaterThan(prev);
      prev = c(x);
    }
  });

  it('safety clipper is transparent below the knee and never exceeds full scale', () => {
    expect(safetyCurve(0.5)).toBe(0.5);
    expect(safetyCurve(-0.8)).toBe(-0.8);
    for (const x of [0.9, 1, 1.5, 4, 100]) {
      expect(safetyCurve(x)).toBeLessThanOrEqual(1);
      expect(safetyCurve(-x)).toBeGreaterThanOrEqual(-1);
    }
    expect(safetyCurve(1.2)).toBeGreaterThan(safetyCurve(1));
  });

  it('dB conversion', () => {
    expect(dbToGain(0)).toBe(1);
    expect(dbToGain(-6)).toBeCloseTo(0.501, 3);
  });
});
