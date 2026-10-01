import { describe, expect, it } from 'vitest';
import { DEFAULT_TUNING, type Tuning } from '../src/config/tuning';
import { Board } from '../src/game/board';
import { PROTOTYPE_MAP, type Cell } from '../src/game/grid';
import { World, type StepResult } from '../src/game/world';

/** Tuning with no waves, so tests control every enemy. */
function quiet(edit: (t: Tuning) => void = () => {}): Tuning {
  const t = JSON.parse(JSON.stringify(DEFAULT_TUNING)) as Tuning;
  t.waves.firstDelayBars = 1000;
  t.economy.startMoney = 10000;
  edit(t);
  return t;
}

function setup(t: Tuning) {
  const world = new World(new Board(PROTOTYPE_MAP), t);
  let step = 0;
  const results: StepResult[] = [];
  const run = (n: number) => {
    for (let i = 0; i < n; i++) results.push(world.onStep(step++, t));
    return results[results.length - 1]!;
  };
  return { world, run, results, now: () => step };
}

/** A buildable cell right next to the first stretch of path (row 2, cols 0-3). */
const NEAR_START: Cell = { col: 1, row: 1 };
const FAR: Cell = { col: 0, row: 9 };

describe('drum core', () => {
  it('always plays kick, clap and hats on their steps, with no towers and no enemies', () => {
    const t = quiet();
    const { results, run } = setup(t);
    run(16);
    const at = (s: number) => results[s]!.hits.map((h) => h.instrument).sort();
    expect(at(0)).toEqual(['kick']);
    expect(at(2)).toEqual(['hats']);
    expect(at(4)).toEqual(['clap', 'kick']);
    expect(at(1)).toEqual([]);
  });
});

describe('economy', () => {
  it('placing costs money; no money, no tower', () => {
    const t = quiet((x) => (x.economy.startMoney = 100));
    const { world } = setup(t);
    expect(world.place('lead', NEAR_START, t).ok).toBe(true);
    expect(world.money).toBe(100 - t.leadTower.cost);
    const second = world.place('lead', FAR, t);
    expect(second).toEqual({ ok: false, reason: 'money' });
  });

  it('removing refunds part of the cost', () => {
    const t = quiet((x) => (x.economy.startMoney = 100));
    const { world } = setup(t);
    const r = world.place('arp', NEAR_START, t);
    if (!r.ok) throw new Error('place failed');
    world.remove(r.tower.id, t);
    expect(world.money).toBe(100 - t.arpTower.cost + Math.floor(t.arpTower.cost * t.economy.refund));
  });

  it('cannot build on the core or the path', () => {
    const t = quiet();
    const { world } = setup(t);
    expect(world.place('bass', { col: 13, row: 6 }, t)).toEqual({ ok: false, reason: 'blocked' });
    expect(world.place('bass', { col: 14, row: 8 }, t)).toEqual({ ok: false, reason: 'blocked' });
    expect(world.place('bass', { col: 0, row: 2 }, t)).toEqual({ ok: false, reason: 'blocked' });
  });

  it('a kill pays the bounty', () => {
    const t = quiet();
    const { world, run } = setup(t);
    world.place('lead', NEAR_START, t);
    run(16);
    const money = world.money;
    world.addEnemy('static', 1, 2);
    const r = run(16);
    expect(world.killed).toBe(1);
    expect(world.money).toBe(money + t.static.bounty);
    expect(r).toBeDefined();
  });
});

describe('movement', () => {
  it('walks at speed cells per beat', () => {
    const t = quiet();
    const { world, run } = setup(t);
    const e = world.addEnemy('static', 999);
    run(16);
    expect(e.progress).toBeCloseTo(4 * t.static.speed);
  });

  it('reaching the end of the path is a leak', () => {
    const t = quiet();
    const { world, run, results } = setup(t);
    world.addEnemy('static', 999, world.path.length - 0.01);
    run(1);
    expect(world.enemies.size).toBe(0);
    expect(world.leaked).toBe(1);
    expect(results[0]!.leaks).toHaveLength(1);
  });

  it('stun freezes for its steps, slow scales speed', () => {
    const t = quiet();
    const { world, run } = setup(t);
    const a = world.addEnemy('static', 999);
    a.stunLeft = 3;
    run(3);
    expect(a.progress).toBe(0);
    run(1);
    expect(a.progress).toBeCloseTo(t.static.speed / 4);

    const b = world.addEnemy('static', 999, 0);
    b.slowLeft = 4;
    b.slowAmount = 0.5;
    run(4);
    expect(b.progress).toBeCloseTo((4 * t.static.speed) / 4 / 2);
  });
});

describe('towers play only while fighting', () => {
  it('a placed tower is silent with no enemy in range', () => {
    const t = quiet();
    const { world, run, results } = setup(t);
    world.place('arp', NEAR_START, t);
    run(48);
    expect(results.every((r) => !r.hits.some((h) => h.instrument === 'arp'))).toBe(true);
    expect(results.every((r) => r.attacks.length === 0)).toBe(true);
  });

  it('starts on its next pattern step when an enemy is in range', () => {
    const t = quiet();
    const { world, run, results } = setup(t);
    world.place('arp', NEAR_START, t);
    run(17); // live from step 16
    world.addEnemy('static', 999, 2); // right beside the tower
    run(3); // steps 17, 18, 19
    const arpSteps = results.filter((r) => r.hits.some((h) => h.instrument === 'arp')).map((r) => r.step);
    expect(arpSteps).toEqual([18]); // first even step after the enemy showed up
    expect(results[18]!.attacks).toHaveLength(1);
  });

  it('holds to the end of the bar after the enemy is gone, then stops', () => {
    const t = quiet();
    const { world, run, results } = setup(t);
    world.place('arp', NEAR_START, t);
    run(17);
    const e = world.addEnemy('static', 999, 2);
    run(3); // 17..19, playing
    world.enemies.delete(e.id);
    run(20); // 20..39
    const arpSteps = results.filter((r) => r.hits.some((h) => h.instrument === 'arp')).map((r) => r.step);
    expect(arpSteps).toEqual([18, 20, 22, 24, 26, 28, 30]);
    // Nothing to hit after the enemy left: sound only.
    expect(results.slice(20).every((r) => r.attacks.length === 0)).toBe(true);
  });

  it('"next beat" waits for the beat before coming in', () => {
    const t = quiet((x) => (x.engage.quantize = 4));
    const { world, run, results } = setup(t);
    world.place('arp', NEAR_START, t);
    run(17);
    world.addEnemy('static', 999, 2);
    run(7); // 17..23
    const arpSteps = results.filter((r) => r.hits.some((h) => h.instrument === 'arp')).map((r) => r.step);
    expect(arpSteps).toEqual([20, 22]);
  });

  it('a queued tower does not fight before its bar', () => {
    const t = quiet();
    const { world, run, results } = setup(t);
    run(3);
    world.place('lead', NEAR_START, t);
    world.addEnemy('static', 999, 2);
    run(13); // 3..15
    expect(results.every((r) => r.attacks.length === 0)).toBe(true);
  });

  it('idle volume lets placed towers play quietly without attacking', () => {
    const t = quiet((x) => (x.engage.idle = -12));
    const { world, run, results } = setup(t);
    world.place('arp', NEAR_START, t);
    run(32);
    const idle = results.slice(16).flatMap((r) => r.hits.filter((h) => h.instrument === 'arp'));
    expect(idle).toHaveLength(8);
    expect(idle[0]!.gain).toBeLessThan(1);
    expect(results.every((r) => r.attacks.length === 0)).toBe(true);
  });

  it('several towers of one type: one sound, separate attacks', () => {
    const t = quiet();
    const { world, run, results } = setup(t);
    world.place('arp', NEAR_START, t);
    world.place('arp', { col: 2, row: 1 }, t);
    run(17);
    world.addEnemy('static', 999, 2);
    run(2);
    const r = results[18]!;
    expect(r.hits.filter((h) => h.instrument === 'arp')).toHaveLength(1);
    expect(r.attacks).toHaveLength(2);
  });
});

describe('attacks', () => {
  it('attacks only land on the tower pattern steps', () => {
    const t = quiet();
    const { world, run, results } = setup(t);
    world.place('lead', NEAR_START, t);
    run(16);
    world.addEnemy('static', 9999, 2).stunLeft = 999; // parked in range
    run(16);
    const steps = results.filter((r) => r.attacks.length).map((r) => r.step % 16);
    expect(steps).toEqual([0, 7, 10]);
  });

  it('single target hits the enemy furthest along; area hits everyone in range', () => {
    const t = quiet();
    const { world, run, results } = setup(t);
    world.place('lead', NEAR_START, t);
    world.place('chords', { col: 2, row: 1 }, t);
    run(16);
    const a = world.addEnemy('static', 9999, 2.2);
    const b = world.addEnemy('static', 9999, 2.8);
    a.stunLeft = b.stunLeft = 999;
    run(16);
    const lead = results.flatMap((r) => r.attacks).filter((x) => x.type === 'lead');
    expect(lead.every((x) => x.targets.length === 1 && x.targets[0] === b.id)).toBe(true);
    const chords = results.flatMap((r) => r.attacks).filter((x) => x.type === 'chords');
    expect(chords.length).toBeGreaterThan(0);
    expect(chords.every((x) => x.targets.length === 2)).toBe(true);
  });

  it('chords stun and bass slows', () => {
    const t = quiet();
    const { world, run } = setup(t);
    world.place('chords', NEAR_START, t);
    run(16);
    const e = world.addEnemy('static', 9999, 2);
    run(4); // chords hit on step 3 of the bar (19)
    expect(e.stunLeft).toBeGreaterThan(0);

    const t2 = quiet();
    const s2 = setup(t2);
    s2.world.place('bass', NEAR_START, t2);
    s2.run(16);
    const f = s2.world.addEnemy('static', 9999, 2);
    s2.run(3); // bass hits on step 2 of the bar (18)
    expect(f.slowLeft).toBeGreaterThan(0);
    expect(f.slowAmount).toBeCloseTo(t2.bassTower.slow);
  });

  it('a tower out of range never fires', () => {
    const t = quiet();
    const { world, run, results } = setup(t);
    world.place('lead', FAR, t);
    run(16);
    world.addEnemy('static', 9999, 2).stunLeft = 999;
    run(32);
    expect(results.every((r) => r.attacks.length === 0)).toBe(true);
  });
});

describe('full wave', () => {
  it('a default wave spawns, walks and either dies or leaks; nothing gets lost', () => {
    const t = JSON.parse(JSON.stringify(DEFAULT_TUNING)) as Tuning;
    const { world, run } = setup(t);
    run(16 * 40);
    const w1 = t.waves.countBase;
    const spawnedSoFar = world.killed + world.leaked + world.enemies.size;
    expect(spawnedSoFar).toBeGreaterThanOrEqual(w1);
    expect(world.leaked).toBeGreaterThanOrEqual(w1); // no towers: wave 1 all leaks
  });
});
