/**
 * Path geometry in cell units. Positions are cell centres: cell (c, r) has its centre at (c + 0.5, r + 0.5).
 * An enemy's place on the path is its distance travelled from the entry, in cells.
 */

import type { GridLayout } from './grid';

export interface Point {
  x: number;
  y: number;
}

export class PathGeometry {
  readonly points: Point[];
  readonly length: number;
  private readonly cumulative: number[];

  constructor(layout: GridLayout) {
    this.points = layout.waypoints.map((w) => ({ x: w.col + 0.5, y: w.row + 0.5 }));
    this.cumulative = [0];
    for (let i = 1; i < this.points.length; i++) {
      const a = this.points[i - 1]!;
      const b = this.points[i]!;
      this.cumulative.push(this.cumulative[i - 1]! + Math.hypot(b.x - a.x, b.y - a.y));
    }
    this.length = this.cumulative[this.cumulative.length - 1]!;
  }

  /** Point at a distance along the path, clamped to its ends. */
  pointAt(distance: number): Point {
    const d = Math.min(Math.max(distance, 0), this.length);
    for (let i = 1; i < this.points.length; i++) {
      if (d <= this.cumulative[i]! || i === this.points.length - 1) {
        const a = this.points[i - 1]!;
        const b = this.points[i]!;
        const seg = this.cumulative[i]! - this.cumulative[i - 1]!;
        const f = seg === 0 ? 0 : (d - this.cumulative[i - 1]!) / seg;
        return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
      }
    }
    return this.points[0]!;
  }
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
