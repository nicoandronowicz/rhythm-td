import { describe, expect, it } from 'vitest';
import { simulateLevel } from '../src/dev/simulate';

/**
 * Guards the difficulty curve against tuning edits, with the scripted player from src/dev/simulate.ts.
 * An active player (spends every bar) must clear every training level; a player who hoards money must
 * lose the last one; Club Night must last a while and then end.
 */
describe('difficulty', () => {
  for (const id of ['level1', 'level2', 'level3', 'level4', 'level5'] as const) {
    it(`${id} is winnable by an active player`, () => {
      for (const seed of [1, 2, 3]) expect(simulateLevel(id, { seed }).victory).toBe(true);
    });
  }

  it('level 5 punishes a player who barely builds', () => {
    expect(simulateLevel('level5', { seed: 1, skill: 0.4 }).victory).toBe(false);
  });

  it('Club Night lasts at least 8 waves for an active player, and ends within 40', () => {
    const r = simulateLevel('endless', { seed: 1, maxWaves: 40 });
    expect(r.gameOver).toBe(true);
    expect(r.wavesCleared).toBeGreaterThanOrEqual(8);
  });

  it('Club Night gets harder: a defense frozen at wave 6 falls within a few waves', () => {
    const r = simulateLevel('endless', { seed: 1, maxWaves: 40, stopBuildingAfterWave: 6 });
    expect(r.gameOver).toBe(true);
    expect(r.waves.length).toBeLessThanOrEqual(12);
  });
});
