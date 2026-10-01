import { describe, expect, it } from 'vitest';
import { DEFAULT_TUNING, type Tuning } from '../src/config/tuning';
import { enemyTypeAt, generateWave, hpMultiplier, WaveClock, waveSize } from '../src/game/waves';

function tuningWith(waves: Partial<Tuning['waves']>): Tuning {
  const t = JSON.parse(JSON.stringify(DEFAULT_TUNING)) as Tuning;
  Object.assign(t.waves, waves);
  return t;
}

describe('wave generation', () => {
  const t = DEFAULT_TUNING;

  it('each wave is bigger and tougher than the last', () => {
    for (let n = 1; n < 20; n++) {
      expect(waveSize(n + 1, t)).toBeGreaterThanOrEqual(waveSize(n, t));
      expect(hpMultiplier(n + 1, t)).toBeGreaterThan(hpMultiplier(n, t));
    }
    expect(waveSize(1, t)).toBe(t.waves.countBase);
  });

  it('spawns are on the grid, in order, and inside the first half of the wave', () => {
    for (let n = 1; n < 30; n++) {
      const w = generateWave(n, 64, t);
      expect(w.spawns).toHaveLength(waveSize(n, t));
      expect(w.endStep - w.startStep).toBe(t.waves.lengthBars * 16);
      let prev = -1;
      for (const s of w.spawns) {
        expect(Number.isInteger(s.step)).toBe(true);
        expect(s.step).toBeGreaterThan(prev);
        expect(s.step).toBeGreaterThanOrEqual(w.startStep);
        expect(s.step).toBeLessThan(w.startStep + (w.endStep - w.startStep) / 2);
        prev = s.step;
      }
    }
  });

  it('no mufflers before their wave, then roughly their share', () => {
    expect(generateWave(1, 0, t).spawns.every((s) => s.type === 'static')).toBe(true);
    const w = generateWave(10, 0, t);
    const share = w.spawns.filter((s) => s.type === 'muffler').length / w.spawns.length;
    expect(share).toBeGreaterThan(t.waves.mufflerShare - 0.1);
    expect(share).toBeLessThan(t.waves.mufflerShare + 0.1);
  });

  it('enemy mix is deterministic', () => {
    for (let i = 0; i < 20; i++) expect(enemyTypeAt(i, 5, t)).toBe(enemyTypeAt(i, 5, t));
  });

  it('HP scales with the wave', () => {
    const w1 = generateWave(1, 0, t).spawns[0]!;
    const w5 = generateWave(5, 0, t).spawns[0]!;
    expect(w1.hp).toBe(t.static.hp);
    expect(w5.hp).toBe(Math.round(t.static.hp * hpMultiplier(5, t)));
  });
});

describe('wave clock', () => {
  it('drums-only intro, then waves every length + breakdown bars, on bar starts', () => {
    const t = tuningWith({ firstDelayBars: 4, lengthBars: 16, breakdownBars: 4 });
    const clock = new WaveClock();
    const starts: number[] = [];
    let lastWave = 0;
    for (let s = 0; s < 16 * 70; s++) {
      clock.onStep(s, t);
      const st = clock.status(s);
      if (st.wave !== lastWave) {
        starts.push(s);
        lastWave = st.wave;
      }
    }
    expect(starts).toEqual([64, 64 + 320, 64 + 640, 64 + 960]);
    for (const s of starts) expect(s % 16).toBe(0);
  });

  it('reports intro, wave and breakdown phases', () => {
    const t = tuningWith({ firstDelayBars: 1, lengthBars: 2, breakdownBars: 1 });
    const clock = new WaveClock();
    const phases: string[] = [];
    for (let s = 0; s < 16 * 5; s += 1) {
      clock.onStep(s, t);
      if (s % 16 === 0) phases.push(clock.status(s).phase);
    }
    expect(phases).toEqual(['intro', 'wave', 'wave', 'breakdown', 'wave']);
  });

  it('hands out every spawn exactly once, on its step', () => {
    const t = tuningWith({ firstDelayBars: 0, countBase: 5, spawnGap: 4 });
    const clock = new WaveClock();
    const got: number[] = [];
    for (let s = 0; s < 64; s++) for (const sp of clock.onStep(s, t)) {
      expect(sp.step).toBe(s);
      got.push(sp.step);
    }
    expect(got).toEqual([0, 4, 8, 12, 16]);
  });
});
