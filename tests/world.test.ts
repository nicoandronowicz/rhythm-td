import { describe, expect, it } from 'vitest';
import { DEFAULT_TUNING, type Tuning } from '../src/config/tuning';
import { Board } from '../src/game/board';
import { PROTOTYPE_MAP, type Cell } from '../src/game/grid';
import { TOWER_TYPES } from '../src/game/towers';
import { ALL_FEATURES, World, type StepResult } from '../src/game/world';
import { TEST_SONG } from './testSong';

/** Tuning with no waves, so tests control every enemy. */
function quiet(edit: (t: Tuning) => void = () => {}): Tuning {
  const t = JSON.parse(JSON.stringify(DEFAULT_TUNING)) as Tuning;
  t.waves.firstDelayBars = 1000;
  t.economy.startMoney = 10000;
  edit(t);
  return t;
}

function setup(t: Tuning, rng: () => number = () => 0.5) {
  const world = new World(new Board(PROTOTYPE_MAP), t, rng, { towers: TOWER_TYPES, features: ALL_FEATURES, song: TEST_SONG });
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
    const at = (s: number) => results[s]!.notes.map((h) => h.layer).filter((i) => i !== 'pad').sort();
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
    expect(results.every((r) => !r.notes.some((h) => h.layer === 'arp'))).toBe(true);
    expect(results.every((r) => r.attacks.length === 0)).toBe(true);
  });

  it('starts on its next pattern step when an enemy is in range', () => {
    const t = quiet((x) => (x.engage.idle = -60));
    const { world, run, results } = setup(t);
    world.place('arp', NEAR_START, t);
    run(17); // live from step 16
    world.addEnemy('static', 999, 2); // right beside the tower
    run(3); // steps 17, 18, 19
    const arpSteps = results.filter((r) => r.notes.some((h) => h.layer === 'arp')).map((r) => r.step);
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
    const arpSteps = results.filter((r) => r.notes.some((h) => h.layer === 'arp')).map((r) => r.step);
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
    const arpSteps = results.filter((r) => r.notes.some((h) => h.layer === 'arp')).map((r) => r.step);
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
    const idle = results.slice(16).flatMap((r) => r.notes.filter((h) => h.layer === 'arp'));
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
    expect(r.notes.filter((h) => h.layer === 'arp')).toHaveLength(1);
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
    expect(results.slice(17).some((x) => x.notes.some((h) => h.layer === 'arp'))).toBe(false);
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
    expect(world.coreHp).toMatchObject({ hats: 1, clap: 2, kick: 2 });
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
    expect(results.slice(1).some((r) => r.notes.some((h) => h.layer === 'hats'))).toBe(false);
    expect(results.slice(1).some((r) => r.notes.some((h) => h.layer === 'kick'))).toBe(true);
    world.addEnemy('static', 999, world.path.length - 0.01);
    world.addEnemy('static', 999, world.path.length - 0.01);
    run(1);
    expect(world.gameOver).toBe(true);
    const e = world.addEnemy('static', 999, 3);
    const after = run(16);
    expect(after.notes).toEqual([]);
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
    expect(at(3)).toMatchObject({ section: 0, barInSection: 0, wave: 1 });
    expect(at(3).chord.name).toBe('Am7');
    expect(at(5).chord.name).toBe('Fmaj7');
    // Wave 2 switches to the second progression.
    expect(at(7)).toMatchObject({ section: 1, barInSection: 0, wave: 2 });
    expect(at(9).chord.name).toBe('Dm7');
    expect(at(11)).toMatchObject({ section: 2, barInSection: 0, wave: 3 });
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

describe('upgrades', () => {
  it('cost money, join on the next bar, and switch to the upgraded pattern', () => {
    const t = quiet((x) => (x.engage.idle = -60));
    const { world, run, results } = setup(t);
    const r = world.place('arp', NEAR_START, t);
    if (!r.ok) throw new Error();
    run(20);
    const money = world.money;
    expect(world.upgrade(r.tower.id, t).ok).toBe(true);
    expect(world.money).toBe(money - t.arpTower.upgradeCost);
    expect(r.tower.upgraded).toBe(false);
    run(12); // to step 31
    expect(r.tower.upgraded).toBe(false);
    run(1); // step 32: bar start
    expect(r.tower.upgraded).toBe(true);
    world.addEnemy('static', 1e9, 1.9).stunLeft = 999;
    run(16); // 33..48
    const arpSteps = results.filter((x) => x.step > 32 && x.step < 48 && x.notes.some((h) => h.layer === 'arp')).map((x) => x.step);
    expect(arpSteps.length).toBeGreaterThan(8); // 16ths, not 8ths
    const attacks = results.filter((x) => x.step > 32 && x.step < 48 && x.attacks.length).length;
    expect(attacks).toBe(arpSteps.length);
  });

  it('upgraded towers hit harder and reach further; you cannot upgrade twice', () => {
    const t = quiet();
    const { world, run } = setup(t);
    const r = world.place('lead', NEAR_START, t);
    if (!r.ok) throw new Error();
    const base = world.rangeOf(r.tower, t);
    world.upgrade(r.tower.id, t);
    expect(world.upgrade(r.tower.id, t)).toEqual({ ok: false, reason: 'done' });
    run(1);
    expect(world.rangeOf(r.tower, t)).toBeCloseTo(base + t.leadTower.upgradeRange);
    const e = world.addEnemy('static', 1e9, 1.9);
    e.stunLeft = 999;
    run(16);
    const hits = 4; // upgraded lead: x......x..x...x.
    expect(1e9 - e.hp).toBeCloseTo(hits * t.leadTower.damage * t.leadTower.upgradeDamage);
  });

  it('removing an upgraded tower refunds part of the upgrade too', () => {
    const t = quiet();
    const { world } = setup(t);
    const r = world.place('bass', NEAR_START, t);
    if (!r.ok) throw new Error();
    world.upgrade(r.tower.id, t);
    const money = world.money;
    const refund = world.remove(r.tower.id, t)!;
    expect(refund).toBe(Math.floor((t.bassTower.cost + t.bassTower.upgradeCost) * t.economy.refund));
    expect(world.money).toBe(money + refund);
  });
});

describe('core perks', () => {
  it('a bought perk joins on the next bar, plays its part and adds a drum of health', () => {
    const t = quiet();
    const { world, run, results } = setup(t);
    run(5);
    expect(world.buyPerk('shaker', t).ok).toBe(true);
    expect(world.buyPerk('shaker', t)).toEqual({ ok: false, reason: 'playing' });
    run(11); // to step 15
    expect(results.some((r) => r.notes.some((h) => h.layer === 'shaker'))).toBe(false);
    run(16);
    expect(results.slice(16).filter((r) => r.notes.some((h) => h.layer === 'shaker'))).toHaveLength(16);
    const per = t.core.hpPerDrum;
    expect(world.coreHealth(t)).toEqual({ left: per * 4, total: per * 4 });
  });

  it('perks drop out first, before the hats, and can be bought again', () => {
    const t = quiet((x) => (x.core.hpPerDrum = 1));
    const { world, run } = setup(t);
    world.buyPerk('rim', t);
    run(1);
    world.addEnemy('static', 999, world.path.length - 0.01);
    expect(run(1).leaks[0]!.dropped).toBe('rim');
    expect(world.coreHp.hats).toBe(1);
    expect(world.buyPerk('rim', t).ok).toBe(true);
    run(16);
    expect(world.hasPerk('rim')).toBe(true);
  });

  it('costs money', () => {
    const t = quiet((x) => (x.economy.startMoney = 10));
    const { world } = setup(t);
    expect(world.buyPerk('openhat', t)).toEqual({ ok: false, reason: 'money' });
  });
});

describe('combos in play', () => {
  it('Sidechain: bass hits harder right after a kick, and the layers pump', () => {
    const t = quiet();
    const { world, run, results } = setup(t);
    world.place('bass', NEAR_START, t);
    world.place('chords', { col: 2, row: 2 }, t);
    run(16);
    world.addEnemy('static', 1e9, 1.9).stunLeft = 999;
    run(16);
    const bassAttacks = results.flatMap((r) => r.attacks.filter((a) => a.type === 'bass'));
    expect(bassAttacks.length).toBeGreaterThan(0);
    expect(bassAttacks.every((a) => a.sidechain)).toBe(true); // bass plays the 8th after every kick
    expect(results[20]!.pump.has('chords')).toBe(true);
  });

  it('Call & response: the lead crits when the dice say so, never without the arp', () => {
    const t = quiet();
    const lucky = setup(t, () => 0);
    lucky.world.place('lead', NEAR_START, t);
    lucky.world.place('arp', { col: 2, row: 2 }, t);
    lucky.run(16);
    lucky.world.addEnemy('static', 1e9, 1.9).stunLeft = 999;
    lucky.run(16);
    const leadHits = lucky.results.flatMap((r) => r.attacks.filter((a) => a.type === 'lead'));
    expect(leadHits.length).toBeGreaterThan(0);
    expect(leadHits.every((a) => a.crit)).toBe(true);

    const alone = setup(t, () => 0);
    alone.world.place('lead', NEAR_START, t);
    alone.run(16);
    alone.world.addEnemy('static', 1e9, 1.9).stunLeft = 999;
    alone.run(16);
    expect(alone.results.flatMap((r) => r.attacks).some((a) => a.crit)).toBe(false);
  });

  it('Full band extends range', () => {
    const t = quiet();
    const { world, run } = setup(t);
    const b = world.place('bass', { col: 5, row: 9 }, t);
    world.place('chords', { col: 6, row: 9 }, t);
    world.place('arp', { col: 7, row: 9 }, t);
    if (!b.ok) throw new Error();
    run(1);
    expect(world.combos.byTower.get(b.tower.id)?.has('fullBand')).toBe(true);
    expect(world.rangeOf(b.tower, t)).toBeCloseTo(t.bassTower.range * (1 + t.combos.fullBandRange));
  });
});

describe('pad and arrangement', () => {
  it('the pad plays a chord at the start of every 2-bar chord, held for 2 bars', () => {
    const t = quiet();
    const { run, results } = setup(t);
    run(16 * 6);
    const padSteps = results.filter((r) => r.notes.some((h) => h.layer === 'pad')).map((r) => r.step);
    expect(padSteps).toEqual([0, 32, 64]);
    expect(results[0]!.notes.find((h) => h.layer === 'pad')!.len).toBe(32);
  });

  it('turnaround on the last bar of a phrase while the core is active: the kick drops its last beat', () => {
    const t = quiet();
    const { world, run, results } = setup(t);
    world.addEnemy('static', 1e9, 1).stunLeft = 1e9; // keeps the core active
    run(16 * 8);
    const kickInBar = (bar: number) =>
      results.slice(bar * 16, bar * 16 + 16).filter((r) => r.notes.some((h) => h.layer === 'kick')).length;
    expect(kickInBar(6)).toBe(4);
    expect(kickInBar(7)).toBe(3);
  });

  it('no turnaround while the core rests', () => {
    const t = quiet();
    const { run, results } = setup(t);
    run(16 * 8);
    expect(results.slice(112, 128).filter((r) => r.notes.some((h) => h.layer === 'kick')).length).toBe(4);
  });

  it('the bass plays a passing note on its last hit before a chord change', () => {
    const t = quiet();
    const { world, run, results } = setup(t);
    world.place('bass', NEAR_START, t);
    world.addEnemy('static', 1e9, 1.9).stunLeft = 1e9;
    run(16 * 4);
    // An approach note sits a half or whole step under the next chord's bass note (Am7 -> Fmaj7: E into F).
    const approaches = results.flatMap((r) =>
      r.notes
        .filter((h) => h.layer === 'bass' && h.notes.length && r.harmony.chord.name !== r.harmony.next.name && r.harmony.barsLeft === 1)
        .filter((h) => [1, 2].includes((r.harmony.next.bass - h.notes[0]! + 120) % 12))
        .map(() => r.step),
    );
    // Chords change every 2 bars: bar 1 -> 2 is a change (step 30), bar 3 -> 4 is a change (step 62).
    expect(approaches).toEqual([30, 62]);
  });

  it('a riser leads into each wave and an impact lands on its first beat', () => {
    const t = JSON.parse(JSON.stringify(DEFAULT_TUNING)) as Tuning;
    t.waves.firstDelayBars = 3;
    const { run, results } = setup(t);
    run(16 * 4);
    const riser = results.findIndex((r) => r.events.some((e) => e.kind === 'build'));
    expect(riser).toBe(32);
    expect(results[48]!.events.some((e) => e.kind === 'impact')).toBe(true);
  });
});

describe('levels', () => {
  it('only the level\'s towers can be built, and locked mechanics refuse', async () => {
    const { levelById } = await import('../src/game/levels');
    const { rulesFor } = await import('../src/game/world');
    const { tuningForLevel } = await import('../src/config/levelTuning');
    const level = levelById('level1');
    const t = tuningForLevel(DEFAULT_TUNING, level);
    const world = new World(new Board(level.map), t, () => 0.5, rulesFor(level, TEST_SONG));
    expect(world.place('lead', { col: 2, row: 3 }, t)).toEqual({ ok: false, reason: 'locked' });
    const r = world.place('bass', { col: 2, row: 3 }, t);
    expect(r.ok).toBe(true);
    if (r.ok) expect(world.upgrade(r.tower.id, t)).toEqual({ ok: false, reason: 'locked' });
    expect(world.buyPerk('shaker', t)).toEqual({ ok: false, reason: 'locked' });
  });

  it('a level is won when its last wave is cleared, and no further wave starts', async () => {
    const t = quiet((x) => {
      x.waves.firstDelayBars = 0;
      x.waves.toWin = 2;
      x.waves.countBase = 1;
      x.waves.countGrowth = 0;
    });
    const { world, run } = setup(t);
    for (let i = 0; i < 16 * 60 && !world.victory; i++) {
      run(1);
      world.enemies.clear(); // instant kills
    }
    expect(world.victory).toBe(true);
    expect(world.wavesSurvived).toBe(2);
    run(16 * 40);
    expect(world.waves.status(0).wave).toBe(2);
  });

  it('levels without enemy attacks never damage towers', async () => {
    const { levelById } = await import('../src/game/levels');
    const { tuningForLevel } = await import('../src/config/levelTuning');
    const t = tuningForLevel(DEFAULT_TUNING, levelById('level2'));
    expect(t.static.damage).toBe(0);
    expect(t.static.effect).toBe(0);
    expect(t.waves.mufflerFromWave).toBeGreaterThan(100);
    expect(t.waves.toWin).toBe(DEFAULT_TUNING.level2.waves);
  });
});

describe('rewards', () => {
  function clearOneWave(t: Tuning) {
    const s = setup(t, () => 0);
    for (let i = 0; i < 16 * 30 && !s.world.rewardOffer; i++) {
      s.run(1);
      s.world.enemies.clear();
    }
    return s;
  }

  it('a cleared wave offers three different rewards', () => {
    const t = quiet((x) => {
      x.waves.firstDelayBars = 0;
      x.waves.countBase = 1;
    });
    const { world, results } = clearOneWave(t);
    expect(world.rewardOffer).toHaveLength(3);
    expect(new Set(world.rewardOffer).size).toBe(3);
    expect(results.some((r) => r.triggers.includes('rewardOffer'))).toBe(true);
  });

  it('a picked reward applies on the next bar and changes the numbers', () => {
    const t = quiet((x) => {
      x.waves.firstDelayBars = 0;
      x.waves.countBase = 1;
    });
    const { world, run } = clearOneWave(t);
    const r = world.place('lead', NEAR_START, t);
    if (!r.ok) throw new Error();
    world.rewardOffer = ['wide', 'tipjar', 'shuffle'];
    const before = world.rangeOf(r.tower, t);
    expect(world.chooseReward('wide')).toBe(true);
    expect(world.rewardOffer).toBeNull();
    run(16);
    expect(world.rangeOf(r.tower, t)).toBeCloseTo(before * (1 + t.rewards.wideRange));
    expect(world.rewardsTaken).toEqual(['wide']);
  });

  it('alternate parts: a variant reward changes the pattern a tower plays and attacks on', () => {
    const t = quiet();
    const { world, run, results } = setup(t);
    const r = world.place('chords', NEAR_START, t);
    if (!r.ok) throw new Error();
    world.mods.variants.add('chords');
    world.addEnemy('static', 1e9, 1.9).stunLeft = 1e9;
    run(32);
    const steps = results.slice(16).filter((x) => x.attacks.some((a) => a.type === 'chords')).map((x) => x.step % 16);
    expect(steps).toEqual([2, 6, 10, 14]);
  });

  it('unique rewards are not offered twice', async () => {
    const { offerRewards, REWARDS } = await import('../src/game/rewards');
    const { levelById } = await import('../src/game/levels');
    const taken = REWARDS.filter((x) => x.unique).map((x) => x.id);
    for (let i = 0; i < 20; i++) {
      const offer = offerRewards(Math.random, taken, { level: levelById('endless') });
      for (const id of offer) expect(taken).not.toContain(id);
    }
  });
});

describe('lift', () => {
  it('kills fill the meter; a full meter can be spent and starts on the next phrase, hitting harder', () => {
    const t = quiet((x) => (x.lift.perKill = 0.5));
    const { world, run, results } = setup(t);
    world.place('lead', NEAR_START, t);
    run(16);
    expect(world.requestLift()).toBe(false);
    for (let i = 0; i < 2; i++) world.addEnemy('static', 1, 1.9).stunLeft = 99;
    run(16);
    expect(world.hype).toBe(1);
    expect(results.some((r) => r.triggers.includes('liftReady'))).toBe(true);
    expect(world.requestLift()).toBe(true);
    run(16 * 7); // through bar 8 (step 127)
    expect(results.slice(0, 128).some((r) => r.lifted)).toBe(false);
    run(1); // step 128: phrase start
    expect(results[128]!.lifted).toBe(true);
    expect(world.hype).toBe(0);
    const e = world.addEnemy('static', 1e9, 1.9);
    e.stunLeft = 1e9;
    run(16);
    expect(1e9 - e.hp).toBeCloseTo(3 * t.leadTower.damage * t.lift.damage);
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
