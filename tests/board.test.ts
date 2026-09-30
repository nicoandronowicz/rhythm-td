import { describe, expect, it } from 'vitest';
import { Board } from '../src/game/board';
import { pathCells, PROTOTYPE_MAP } from '../src/game/grid';
import { hitsForStep } from '../src/game/sequencer';

/** Run the board's tick from `from` to `to` inclusive, like the transport would. */
function run(board: Board, from: number, to: number) {
  const changes = [];
  for (let s = from; s <= to; s++) {
    const c = board.onStep(s);
    if (c) changes.push(c);
  }
  return changes;
}

const FREE = { col: 0, row: 0 };
const FREE2 = { col: 1, row: 0 };

describe('grid', () => {
  it('path is continuous and on the board', () => {
    const cells = pathCells(PROTOTYPE_MAP);
    expect(cells.length).toBeGreaterThan(10);
    for (let i = 1; i < cells.length; i++) {
      const a = cells[i - 1]!;
      const b = cells[i]!;
      expect(Math.abs(a.col - b.col) + Math.abs(a.row - b.row)).toBe(1);
    }
  });
});

describe('placement', () => {
  it('cannot build on the path, off the board, or on another tower', () => {
    const b = new Board(PROTOTYPE_MAP);
    const onPath = pathCells(PROTOTYPE_MAP)[0]!;
    expect(b.place('kick', onPath)).toBeNull();
    expect(b.place('kick', { col: -1, row: 0 })).toBeNull();
    expect(b.place('kick', { col: 99, row: 0 })).toBeNull();
    expect(b.place('kick', FREE)).not.toBeNull();
    expect(b.place('clap', FREE)).toBeNull();
  });

  it('moves only to free buildable cells', () => {
    const b = new Board(PROTOTYPE_MAP);
    const t1 = b.place('kick', FREE)!;
    b.place('clap', FREE2);
    expect(b.move(t1.id, FREE2)).toBe(false);
    expect(b.move(t1.id, pathCells(PROTOTYPE_MAP)[0]!)).toBe(false);
    expect(b.move(t1.id, { col: 2, row: 0 })).toBe(true);
    expect(b.towerAt({ col: 2, row: 0 })?.id).toBe(t1.id);
    expect(b.towerAt(FREE)).toBeUndefined();
    // Moving onto its own cell is fine.
    expect(b.move(t1.id, { col: 2, row: 0 })).toBe(true);
  });
});

describe('next-bar queueing', () => {
  it('a tower placed mid-bar is queued until the next bar', () => {
    const b = new Board(PROTOTYPE_MAP);
    run(b, 0, 5);
    const t = b.place('kick', FREE)!;
    expect(t.state).toBe('queued');
    run(b, 6, 15);
    expect(t.state).toBe('queued');
    expect(b.isLayerActive('kick')).toBe(false);
    const [change] = run(b, 16, 16);
    expect(t.state).toBe('live');
    expect(b.isLayerActive('kick')).toBe(true);
    expect(change!.layersOn).toEqual(['kick']);
    expect(change!.entered.map((x) => x.id)).toEqual([t.id]);
  });

  it('a tower placed right after a downbeat waits a whole bar', () => {
    const b = new Board(PROTOTYPE_MAP);
    run(b, 0, 16);
    b.place('clap', FREE);
    run(b, 17, 31);
    expect(b.isLayerActive('clap')).toBe(false);
    run(b, 32, 32);
    expect(b.isLayerActive('clap')).toBe(true);
  });

  it('a tower placed before the first tick enters on bar 1', () => {
    const b = new Board(PROTOTYPE_MAP);
    b.place('hats', FREE);
    run(b, 0, 0);
    expect(b.isLayerActive('hats')).toBe(true);
  });

  it('never changes layers off a bar start', () => {
    const b = new Board(PROTOTYPE_MAP);
    b.place('kick', FREE);
    for (let s = 1; s < 16; s++) expect(b.onStep(s)).toBeNull();
  });

  it('removing the last tower of a type drops the layer on the next bar, not before', () => {
    const b = new Board(PROTOTYPE_MAP);
    const t = b.place('bass', FREE)!;
    run(b, 0, 20);
    b.remove(t.id);
    run(b, 21, 31);
    expect(b.isLayerActive('bass')).toBe(true);
    const [change] = run(b, 32, 32);
    expect(b.isLayerActive('bass')).toBe(false);
    expect(change!.layersOff).toEqual(['bass']);
  });

  it('a queued tower removed before its bar never plays', () => {
    const b = new Board(PROTOTYPE_MAP);
    run(b, 0, 3);
    const t = b.place('kick', FREE)!;
    b.remove(t.id);
    run(b, 4, 16);
    expect(b.isLayerActive('kick')).toBe(false);
  });

  it('two towers of one type are one layer', () => {
    const b = new Board(PROTOTYPE_MAP);
    const a = b.place('kick', FREE)!;
    b.place('kick', FREE2);
    run(b, 0, 0);
    expect([...b.activeLayers]).toEqual(['kick']);
    b.remove(a.id);
    run(b, 1, 16);
    expect(b.isLayerActive('kick')).toBe(true);
  });

  it('moving a live tower keeps its layer playing without a gap', () => {
    const b = new Board(PROTOTYPE_MAP);
    const t = b.place('hats', FREE)!;
    run(b, 0, 7);
    b.move(t.id, FREE2);
    const changes = run(b, 8, 40);
    expect(t.state).toBe('live');
    expect(changes.every((c) => c.layersOff.length === 0)).toBe(true);
  });

  it('moving a queued tower keeps it queued', () => {
    const b = new Board(PROTOTYPE_MAP);
    run(b, 0, 3);
    const t = b.place('hats', FREE)!;
    b.move(t.id, FREE2);
    expect(t.state).toBe('queued');
    run(b, 4, 16);
    expect(t.state).toBe('live');
  });
});

describe('sequencer', () => {
  it('only active layers play, on their pattern steps', () => {
    const active = new Set(['kick', 'hats'] as const);
    expect(hitsForStep(0, active).map((h) => h.type)).toEqual(['kick']);
    expect(hitsForStep(2, active).map((h) => h.type)).toEqual(['hats']);
    expect(hitsForStep(4, active).map((h) => h.type)).toEqual(['kick']);
    expect(hitsForStep(1, active)).toEqual([]);
  });

  it('full kit on step 4 is kick + clap, on step 2 is hats + bass', () => {
    const all = new Set(['kick', 'clap', 'hats', 'bass'] as const);
    expect(hitsForStep(4, all).map((h) => h.type)).toEqual(['kick', 'clap']);
    expect(hitsForStep(18, all).map((h) => h.type)).toEqual(['hats', 'bass']);
  });
});

describe('velocity', () => {
  it('maps hit kinds to tuning velocities', async () => {
    const { velocityFor } = await import('../src/game/sequencer');
    const v = { normal: 0.8, accent: 1, ghost: 0.3 };
    expect(velocityFor('normal', v)).toBe(0.8);
    expect(velocityFor('accent', v)).toBe(1);
    expect(velocityFor('ghost', v)).toBe(0.3);
    expect(velocityFor('octave', v)).toBe(0.8);
  });
});
