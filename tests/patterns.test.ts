import { describe, expect, it } from 'vitest';
import { hitSteps, parsePattern, stepAt } from '../src/music/patterns';
import { TOWER_DEFS, TOWER_TYPES } from '../src/game/towers';
import { DRUM_DEFS, DRUM_ORDER } from '../src/game/core';

describe('patterns', () => {
  it('parses hits and kinds', () => {
    const p = parsePattern('x...X...g...o...');
    expect(hitSteps(p)).toEqual([0, 4, 8, 12]);
    expect(p[0]).toBe('normal');
    expect(p[4]).toBe('accent');
    expect(p[8]).toBe('ghost');
    expect(p[12]).toBe('octave');
  });

  it('rejects wrong lengths and unknown symbols', () => {
    expect(() => parsePattern('x...')).toThrow();
    expect(() => parsePattern('x...x...x...x..?')).toThrow();
  });

  it('wraps step lookups to the bar', () => {
    const p = parsePattern('x...............');
    expect(stepAt(p, 16)).toBe('normal');
    expect(stepAt(p, -16)).toBe('normal');
    expect(stepAt(p, 17)).toBeNull();
  });

  it('tower base patterns match the spec', () => {
    expect(hitSteps(TOWER_DEFS.bass.patterns.base)).toEqual([2, 6, 10, 14]);
    expect(hitSteps(TOWER_DEFS.chords.patterns.base)).toEqual([3, 10, 13]);
    expect(hitSteps(TOWER_DEFS.arp.patterns.base)).toEqual([0, 2, 4, 6, 8, 10, 12, 14]);
    expect(hitSteps(TOWER_DEFS.lead.patterns.base)).toEqual([0, 7, 10]);
  });

  it('drum core patterns match the spec', () => {
    expect(hitSteps(DRUM_DEFS.kick.pattern)).toEqual([0, 4, 8, 12]);
    expect(hitSteps(DRUM_DEFS.clap.pattern)).toEqual([4, 12]);
    expect(hitSteps(DRUM_DEFS.hats.pattern)).toEqual([2, 6, 10, 14]);
    expect(DRUM_ORDER[DRUM_ORDER.length - 1]).toBe('kick');
  });

  it('upgraded patterns keep every base hit', () => {
    for (const type of TOWER_TYPES) {
      const base = hitSteps(TOWER_DEFS[type].patterns.base);
      const up = hitSteps(TOWER_DEFS[type].patterns.upgraded);
      for (const s of base) expect(up).toContain(s);
    }
  });

  it('upgrades add hits', () => {
    for (const type of TOWER_TYPES) {
      expect(hitSteps(TOWER_DEFS[type].patterns.upgraded).length).toBeGreaterThan(hitSteps(TOWER_DEFS[type].patterns.base).length);
    }
    expect(hitSteps(TOWER_DEFS.arp.patterns.upgraded)).toHaveLength(16);
    expect(TOWER_DEFS.bass.patterns.upgraded).toContain('octave');
  });
});
