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

/** A buildable cell right next to the first stretch of path (row 1, cols 0-4). */
const NEAR_START: Cell = { col: 1, row: 2 };
const FAR: Cell = { col: 21, row: 0 };

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
    expect(world.place('bass', { col: 19, row: 5 }, t)).toEqual({ ok: false, reason: 'blocked' });
    expect(world.place('bass', { col: 21, row: 8 }, t)).toEqual({ ok: false, reason: 'blocked' });
    expect(world.place('bass', { col: 0, row: 1 }, t)).toEqual({ ok: false, reason: 'blocked' });
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
  it('with idle off, a placed tower is silent with no enemy in range', () => {
    const t = quiet((x) => (x.engage.idle = -60));
    const { world, run, results } = setup(t);
    world.place('arp', NEAR_START, t);
    run(48);
    expect(results.every((r) => !r.hits.some((h) => h.instrument === 'arp'))).toBe(true);
    expect(results.every((r) => r.attacks.length === 0)).toBe(true);
  });

  it('starts on its next pattern step when an enemy is in range', () => {
    const t = quiet((x) => (x.engage.idle = -60));
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
    const t = quiet((x) => (x.engage.idle = -60));
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
    const t = quiet((x) => {
      x.engage.quantize = 4;
      x.engage.idle = -60;
    });
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

  it('idle towers keep playing their part (in the distance) without attacking', () => {
    const t = quiet();
    const { world, run, results } = setup(t);
    world.place('arp', NEAR_START, t);
    run(32);
    const idle = results.slice(16).flatMap((r) => r.hits.filter((h) => h.instrument === 'arp'));
    expect(idle).toHaveLength(8);
    expect(results.slice(16).every((r) => r.layers.arp.mode === 'idle')).toBe(true);
    expect(results.every((r) => r.attacks.length === 0)).toBe(true);
  });

  it('switches from idle to fighting when an enemy comes, and reports how many are near', () => {
    const t = quiet();
    const { world, run, results } = setup(t);
    world.place('arp', NEAR_START, t);
    run(17);
    for (const p of [1.8, 2.2, 2.6]) world.addEnemy('static', 999, p).stunLeft = 999;
    run(1);
    expect(results[16]!.layers.arp.mode).toBe('idle');
    expect(results[17]!.layers.arp.mode).toBe('fighting');
    expect(results[17]!.layers.arp.enemies).toBe(3);
  });

  it('several towers of one type: one sound, separate attacks', () => {
    const t = quiet();
    const { world, run, results } = setup(t);
    world.place('arp', NEAR_START, t);
    world.place('arp', { col: 2, row: 2 }, t);
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
    world.place('chords', { col: 2, row: 2 }, t);
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

describe('enemies attack towers', () => {
  it('Static hits the nearest tower on its attack steps, hovering while it does', () => {
    const t = quiet((x) => (x.static.speed = 0));
    const { world, run, results } = setup(t);
    const r = world.place('lead', NEAR_START, t);
    if (!r.ok) throw new Error();
    run(16);
    world.addEnemy('static', 9999, 1.9);
    run(16);
    const hitSteps = results.filter((x) => x.enemyAttacks.length).map((x) => x.step);
    expect(hitSteps.length).toBeGreaterThan(0);
    for (const s of hitSteps) expect(s % t.static.attackEvery).toBe(0);
    expect(r.tower.hp).toBeLessThan(r.tower.maxHp);
    expect(r.tower.staticLevel).toBeGreaterThan(0);
  });

  it('an enemy does not move on a step it attacks', () => {
    const t = quiet();
    const { world, run } = setup(t);
    world.place('lead', NEAR_START, t);
    run(16); // next step (16) is an attack step
    const e = world.addEnemy('static', 9999, 1.9);
    run(1);
    expect(e.progress).toBe(1.9);
    run(1);
    expect(e.progress).toBeGreaterThan(1.9);
  });

  it('effects are capped at 1 and recover when the attacks stop', () => {
    const t = quiet((x) => {
      x.static.effect = 0.6;
      x.static.speed = 0;
    });
    const { world, run } = setup(t);
    const r = world.place('lead', NEAR_START, t);
    if (!r.ok) throw new Error();
    r.tower.hp = r.tower.maxHp = 1e9;
    run(16);
    const e = world.addEnemy('static', 1e9, 1.9);
    run(17);
    expect(r.tower.staticLevel).toBeLessThanOrEqual(1);
    expect(r.tower.staticLevel).toBeGreaterThan(0.5);
    world.enemies.delete(e.id);
    run(16 * t.fx.recoverBars + 1);
    expect(r.tower.staticLevel).toBe(0);
  });

  it('Muffler muffles and shrinks the range, without damage by default', () => {
    const t = quiet();
    const { world, run } = setup(t);
    const r = world.place('lead', NEAR_START, t);
    if (!r.ok) throw new Error();
    run(16);
    world.addEnemy('muffler', 9999, 1.9);
    run(8);
    expect(r.tower.hp).toBe(r.tower.maxHp);
    expect(r.tower.muffleLevel).toBeGreaterThan(0);
    expect(world.rangeOf(r.tower, t)).toBeLessThan(t.leadTower.range);
  });

  it('a destroyed tower becomes a silent wreck that nobody targets', () => {
    const t = quiet((x) => (x.static.damage = 1000));
    const { world, run, results } = setup(t);
    const r = world.place('arp', NEAR_START, t);
    if (!r.ok) throw new Error();
    run(16);
    world.addEnemy('static', 9999, 1.9);
    run(1);
    expect(r.tower.state).toBe('wreck');
    expect(results[16]!.enemyAttacks[0]!.destroyed).toBe(true);
    run(32);
    expect(results.slice(17).some((x) => x.hits.some((h) => h.instrument === 'arp'))).toBe(false);
    expect(results.slice(17).some((x) => x.enemyAttacks.length > 0)).toBe(false);
  });

  it('repairing a wreck costs half its price and brings it back on the next bar at full health', () => {
    const t = quiet((x) => (x.static.damage = 1000));
    const { world, run } = setup(t);
    const r = world.place('arp', NEAR_START, t);
    if (!r.ok) throw new Error();
    run(16);
    const e = world.addEnemy('static', 9999, 1.9);
    run(1);
    world.enemies.delete(e.id);
    const money = world.money;
    expect(world.repair(r.tower.id, t).ok).toBe(true);
    expect(world.money).toBe(money - Math.ceil(t.arpTower.cost * t.economy.repair));
    expect(r.tower.state).toBe('queued');
    run(16); // through the next bar start (step 32)
    expect(r.tower.state).toBe('live');
    expect(r.tower.hp).toBe(t.arpTower.hp);
  });

  it('removing a wreck refunds nothing', () => {
    const t = quiet((x) => (x.static.damage = 1000));
    const { world, run } = setup(t);
    const r = world.place('arp', NEAR_START, t);
    if (!r.ok) throw new Error();
    run(16);
    world.addEnemy('static', 9999, 1.9);
    run(1);
    expect(world.remove(r.tower.id, t)).toBe(0);
  });
});

describe('the core', () => {
  it('leaks knock drums out in order: hats, then clap, then kick = game over', () => {
    const t = quiet((x) => (x.core.hpPerDrum = 2));
    const { world, run, results } = setup(t);
    const leak = () => {
      world.addEnemy('static', 999, world.path.length - 0.01);
      return run(1);
    };
    leak();
    expect(world.drums).toEqual({ hats: 1, clap: 2, kick: 2 });
    expect(leak().leaks[0]!.dropped).toBe('hats');
    leak();
    expect(leak().leaks[0]!.dropped).toBe('clap');
    leak();
    expect(world.gameOver).toBe(false);
    const last = leak();
    expect(last.leaks[0]!.dropped).toBe('kick');
    expect(last.gameOver).toBe(true);
    expect(results.length).toBe(6);
  });

  it('a dropped drum stops playing; after game over everything is silent and frozen', () => {
    const t = quiet((x) => (x.core.hpPerDrum = 1));
    const { world, run, results } = setup(t);
    world.addEnemy('static', 999, world.path.length - 0.01);
    run(16);
    expect(results.slice(1).some((r) => r.hits.some((h) => h.instrument === 'hats'))).toBe(false);
    expect(results.slice(1).some((r) => r.hits.some((h) => h.instrument === 'kick'))).toBe(true);
    world.addEnemy('static', 999, world.path.length - 0.01);
    world.addEnemy('static', 999, world.path.length - 0.01);
    run(1);
    expect(world.gameOver).toBe(true);
    const e = world.addEnemy('static', 999, 3);
    const after = run(16);
    expect(after.hits).toEqual([]);
    expect(e.progress).toBe(3);
    expect(world.place('bass', FAR, t).ok).toBe(false);
  });

  it('rests between waves with nobody around, rises in the bar before a wave, active during it', () => {
    const t = JSON.parse(JSON.stringify(DEFAULT_TUNING)) as Tuning;
    t.waves.firstDelayBars = 2;
    const { world, run, results } = setup(t);
    run(16 * 3);
    expect(results[0]!.core).toBe('resting');
    expect(results[15]!.core).toBe('resting');
    expect(results[16]!.core).toBe('rising');
    expect(results[31]!.core).toBe('rising');
    expect(results[32]!.core).toBe('active');
    expect(world).toBeDefined();
  });

  it('rests as soon as a wave is cleared, even before its 16 bars are up', () => {
    const t = JSON.parse(JSON.stringify(DEFAULT_TUNING)) as Tuning;
    t.waves.firstDelayBars = 0;
    t.waves.countBase = 1;
    const { world, run } = setup(t);
    expect(run(1).core).toBe('active');
    world.enemies.clear();
    expect(run(1).core).toBe('resting');
  });

  it('stays active in a breakdown while enemies are still on the path', () => {
    const t = quiet();
    const { world, run } = setup(t);
    world.addEnemy('static', 999, 1).stunLeft = 999;
    expect(run(1).core).toBe('active');
  });
});

describe('harmony', () => {
  it('the intro plays the first progression; each wave switches to its own from its first bar', () => {
    const t = JSON.parse(JSON.stringify(DEFAULT_TUNING)) as Tuning;
    t.waves.firstDelayBars = 3;
    t.waves.lengthBars = 4;
    t.waves.breakdownBars = 0;
    const { run, results } = setup(t);
    run(16 * 12);
    const at = (bar: number) => results[bar * 16]!.harmony;
    expect(at(0).chord.name).toBe('Am7');
    expect(at(2).chord.name).toBe('Fmaj7');
    // Wave 1 plays the first progression again, from its first chord.
    expect(at(3)).toMatchObject({ progression: 0, phraseBar: 0, wave: 1 });
    expect(at(3).chord.name).toBe('Am7');
    expect(at(5).chord.name).toBe('Fmaj7');
    // Wave 2 switches to the second progression.
    expect(at(7)).toMatchObject({ progression: 1, phraseBar: 0, wave: 2 });
    expect(at(9).chord.name).toBe('Dm7');
    expect(at(11)).toMatchObject({ progression: 2, phraseBar: 0, wave: 3 });
    expect(at(11).chord.name).toBe('Fmaj7');
  });

  it('harmony only changes on bar starts', () => {
    const t = JSON.parse(JSON.stringify(DEFAULT_TUNING)) as Tuning;
    const { run, results } = setup(t);
    run(16 * 30);
    for (let i = 1; i < results.length; i++) {
      if (results[i]!.step % 16 !== 0) expect(results[i]!.harmony.chord).toBe(results[i - 1]!.harmony.chord);
    }
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
