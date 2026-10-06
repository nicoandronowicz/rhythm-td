import { describe, expect, it } from 'vitest';
import type { Tower } from '../src/game/board';
import { detectCombos, touching } from '../src/game/combos';
import type { TowerType } from '../src/game/towers';

let nextId = 1;
function tower(type: TowerType, col: number, row: number, state: Tower['state'] = 'live'): Tower {
  return { id: nextId++, type, col, row, state, hp: 1, maxHp: 1, staticLevel: 0, muffleLevel: 0, upgraded: false, upgradeQueued: false };
}

describe('combos', () => {
  it('touching includes diagonals, not the same cell or two apart', () => {
    expect(touching({ col: 0, row: 0 }, { col: 1, row: 1 })).toBe(true);
    expect(touching({ col: 0, row: 0 }, { col: 0, row: 1 })).toBe(true);
    expect(touching({ col: 0, row: 0 }, { col: 2, row: 0 })).toBe(false);
    expect(touching({ col: 0, row: 0 }, { col: 0, row: 0 })).toBe(false);
  });

  it('Sidechain: bass touching chords tags both and links them', () => {
    const b = tower('bass', 0, 0);
    const c = tower('chords', 1, 1);
    const far = tower('chords', 5, 5);
    const s = detectCombos([b, c, far]);
    expect(s.byTower.get(b.id)?.has('sidechain')).toBe(true);
    expect(s.byTower.get(c.id)?.has('sidechain')).toBe(true);
    expect(s.byTower.get(far.id)).toBeUndefined();
    expect(s.links).toEqual([{ combo: 'sidechain', a: b.id, b: c.id }]);
    expect(s.active.has('sidechain')).toBe(true);
  });

  it('Call & response: lead touching arp', () => {
    const l = tower('lead', 3, 3);
    const a = tower('arp', 3, 4);
    expect(detectCombos([l, a]).byTower.get(l.id)?.has('callResponse')).toBe(true);
  });

  it('wrecks never make combos', () => {
    const b = tower('bass', 0, 0);
    const c = tower('chords', 1, 0, 'wreck');
    expect(detectCombos([b, c]).active.size).toBe(0);
  });

  it('Full band needs bass, chords and arp in one touching cluster (a chain counts)', () => {
    const b = tower('bass', 0, 0);
    const c = tower('chords', 1, 0);
    const a = tower('arp', 2, 0); // touches chords, not bass
    const s = detectCombos([b, c, a]);
    for (const t of [b, c, a]) expect(s.byTower.get(t.id)?.has('fullBand')).toBe(true);

    const apart = detectCombos([tower('bass', 0, 0), tower('chords', 1, 0), tower('arp', 5, 5)]);
    expect(apart.active.has('fullBand')).toBe(false);
  });

  it('a lead in the cluster does not join Full band', () => {
    const b = tower('bass', 0, 0);
    const l = tower('lead', 1, 0);
    const c = tower('chords', 2, 0);
    const a = tower('arp', 3, 0);
    const s = detectCombos([b, l, c, a]);
    // bass only touches the lead, so bass is not connected to chords/arp through band members
    expect(s.active.has('fullBand')).toBe(false);
  });
});
