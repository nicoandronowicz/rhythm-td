import { describe, expect, it } from 'vitest';
import { hitSteps, parsePattern, stepAt } from '../src/music/patterns';
import { TOWER_DEFS, TOWER_TYPES } from '../src/game/towers';

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
    expect(hitSteps(TOWER_DEFS.kick.patterns.base)).toEqual([0, 4, 8, 12]);
    expect(hitSteps(TOWER_DEFS.clap.patterns.base)).toEqual([4, 12]);
    expect(hitSteps(TOWER_DEFS.hats.patterns.base)).toEqual([2, 6, 10, 14]);
    expect(hitSteps(TOWER_DEFS.bass.patterns.base)).toEqual([2, 6, 10, 14]);
  });

  it('upgraded patterns keep every base hit', () => {
    for (const type of TOWER_TYPES) {
      const base = hitSteps(TOWER_DEFS[type].patterns.base);
      const up = hitSteps(TOWER_DEFS[type].patterns.upgraded);
      for (const s of base) expect(up).toContain(s);
    }
  });

  it('upgrades add what the spec says', () => {
    expect(TOWER_DEFS.kick.patterns.upgraded[14]).toBe('ghost');
    expect(TOWER_DEFS.clap.patterns.upgraded[15]).not.toBeNull();
    expect(hitSteps(TOWER_DEFS.hats.patterns.upgraded)).toHaveLength(16);
    for (const s of [2, 6, 10, 14]) expect(TOWER_DEFS.hats.patterns.upgraded[s]).toBe('accent');
    expect(TOWER_DEFS.bass.patterns.upgraded).toContain('octave');
  });
});
