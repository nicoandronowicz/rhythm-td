/**
 * Map layout: grid size and the fixed enemy path. Pure data + helpers.
 */

export interface Cell {
  col: number;
  row: number;
}

export interface GridLayout {
  cols: number;
  rows: number;
  /** Path corners in cell coordinates. The first may sit just off the board (entry); the last is where enemies reach the core. */
  waypoints: readonly Cell[];
  /** Cells covered by the drum core. Not buildable. */
  core: { col: number; row: number; cols: number; rows: number };
}

export const PROTOTYPE_MAP: GridLayout = {
  cols: 15,
  rows: 10,
  waypoints: [
    { col: -1, row: 2 },
    { col: 3, row: 2 },
    { col: 3, row: 7 },
    { col: 7, row: 7 },
    { col: 7, row: 2 },
    { col: 11, row: 2 },
    { col: 11, row: 7 },
    { col: 13, row: 7 },
  ],
  core: { col: 13, row: 6, cols: 2, rows: 3 },
};

export function isCoreCell(layout: GridLayout, c: Cell): boolean {
  const k = layout.core;
  return c.col >= k.col && c.col < k.col + k.cols && c.row >= k.row && c.row < k.row + k.rows;
}

export function cellKey(c: Cell): string {
  return `${c.col},${c.row}`;
}

export function inBounds(layout: GridLayout, c: Cell): boolean {
  return c.col >= 0 && c.row >= 0 && c.col < layout.cols && c.row < layout.rows;
}

/** Every on-board cell the path crosses, in walking order, without duplicates. */
export function pathCells(layout: GridLayout): Cell[] {
  const out: Cell[] = [];
  const seen = new Set<string>();
  const push = (c: Cell) => {
    const k = cellKey(c);
    if (inBounds(layout, c) && !seen.has(k)) {
      seen.add(k);
      out.push(c);
    }
  };
  for (let i = 0; i < layout.waypoints.length - 1; i++) {
    const a = layout.waypoints[i]!;
    const b = layout.waypoints[i + 1]!;
    if (a.col !== b.col && a.row !== b.row) {
      throw new Error(`Path segment ${i} is diagonal; paths must be straight lines between corners`);
    }
    const dc = Math.sign(b.col - a.col);
    const dr = Math.sign(b.row - a.row);
    let c = { ...a };
    push(c);
    while (c.col !== b.col || c.row !== b.row) {
      c = { col: c.col + dc, row: c.row + dr };
      push(c);
    }
  }
  return out;
}
