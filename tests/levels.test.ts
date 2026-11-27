import { describe, expect, it } from 'vitest';
import { Coach } from '../src/game/coach';
import { cellKey, inBounds, isCoreCell, pathCells } from '../src/game/grid';
import { LEVELS } from '../src/game/levels';

describe('level maps', () => {
  for (const level of LEVELS) {
    it(`${level.name}: path is continuous, never touches itself, and ends at the core`, () => {
      const m = level.map;
      const cells = pathCells(m);
      for (let i = 1; i < cells.length; i++) {
        const a = cells[i - 1]!;
        const b = cells[i]!;
        expect(Math.abs(a.col - b.col) + Math.abs(a.row - b.row)).toBe(1);
      }
      const index = new Map(cells.map((c, i) => [cellKey(c), i]));
      for (const [i, c] of cells.entries()) {
        for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const j = index.get(cellKey({ col: c.col + dc!, row: c.row + dr! }));
          if (j !== undefined) expect(Math.abs(j - i)).toBe(1);
        }
        expect(isCoreCell(m, c)).toBe(false);
      }
      const last = m.waypoints[m.waypoints.length - 1]!;
      expect(isCoreCell(m, { col: last.col + 1, row: last.row })).toBe(true);
      const k = m.core;
      expect(inBounds(m, { col: k.col, row: k.row })).toBe(true);
      expect(inBounds(m, { col: k.col + k.cols - 1, row: k.row + k.rows - 1 })).toBe(true);
    });
  }

  it('levels teach in order: each adds towers or mechanics, Endless has everything', () => {
    expect(LEVELS.map((l) => l.number)).toEqual(LEVELS.map((_, i) => i + 1));
    // Chapters come in order, training first, Endless last.
    const chapters = LEVELS.map((l) => (l.chapter === 0 ? 99 : l.chapter));
    expect([...chapters].sort((a, b) => a - b)).toEqual(chapters);
    for (const l of LEVELS.filter((x) => x.chapter > 1)) expect(Object.values(l.features).every(Boolean), l.id).toBe(true);
    expect(LEVELS[0]!.towers).toEqual(['bass']);
    const last = LEVELS[LEVELS.length - 1]!;
    expect(Object.values(last.features).every(Boolean)).toBe(true);
    for (let i = 1; i < LEVELS.length; i++) {
      expect(LEVELS[i]!.towers.length).toBeGreaterThanOrEqual(LEVELS[i - 1]!.towers.length);
    }
  });
});

describe('coach', () => {
  it('shows tips in order, each once, and clears a tip when its "until" happens', () => {
    const coach = new Coach([
      { on: 'start', text: 'a' },
      { on: 'start', text: 'b', until: 'placed' },
      { on: 'placed', text: 'c' },
    ]);
    coach.fire('start');
    expect(coach.current?.text).toBe('a');
    coach.dismiss();
    expect(coach.current?.text).toBe('b');
    coach.fire('placed');
    expect(coach.current?.text).toBe('c');
    coach.fire('start');
    expect(coach.current?.text).toBe('c');
    coach.dismiss();
    expect(coach.current).toBeNull();
  });

  it('a new tip replaces one that has no "until"', () => {
    const coach = new Coach([
      { on: 'start', text: 'a' },
      { on: 'wave:1', text: 'b' },
    ]);
    coach.fire('start');
    coach.fire('wave:1');
    expect(coach.current?.text).toBe('b');
  });
});
