/**
 * The board: which towers are where, and which layers are playing.
 *
 * Pure game state, advanced by the transport's 16th tick via `onStep`.
 * Rule: layers only change on a bar start. Placing a tower queues it; it goes live on the next bar.
 * Removing the last tower of a type keeps its layer playing until the next bar, then it drops out.
 * A destroyed tower stays on the board as a wreck until it is repaired (queued again) or removed.
 */

import { isBarStart } from '../music/timing';
import { cellKey, inBounds, pathCells, type Cell, type GridLayout } from './grid';
import { TOWER_TYPES, type TowerType } from './towers';

export type TowerState = 'queued' | 'live' | 'wreck';

export interface Tower {
  readonly id: number;
  readonly type: TowerType;
  col: number;
  row: number;
  state: TowerState;
  hp: number;
  maxHp: number;
  /** Noise and crush from Static attacks, 0..1. */
  staticLevel: number;
  /** Muffling from Muffler attacks, 0..1. */
  muffleLevel: number;
}

export interface BarChange {
  step: number;
  /** Towers that went from queued to live on this bar. */
  entered: Tower[];
  layersOn: TowerType[];
  layersOff: TowerType[];
}

export class Board {
  private towers = new Map<number, Tower>();
  private nextId = 1;
  private pathKeys: Set<string>;
  private active = new Set<TowerType>();

  constructor(readonly layout: GridLayout) {
    this.pathKeys = new Set(pathCells(layout).map(cellKey));
  }

  get activeLayers(): ReadonlySet<TowerType> {
    return this.active;
  }

  isLayerActive(type: TowerType): boolean {
    return this.active.has(type);
  }

  all(): Tower[] {
    return [...this.towers.values()];
  }

  get(id: number): Tower | undefined {
    return this.towers.get(id);
  }

  towerAt(cell: Cell): Tower | undefined {
    for (const t of this.towers.values()) {
      if (t.col === cell.col && t.row === cell.row) return t;
    }
    return undefined;
  }

  isPath(cell: Cell): boolean {
    return this.pathKeys.has(cellKey(cell));
  }

  /** Buildable: on the board, not on the path, not occupied (ignoring `ignoreId`, for moves). */
  canPlace(cell: Cell, ignoreId?: number): boolean {
    if (!inBounds(this.layout, cell) || this.isPath(cell)) return false;
    const occupant = this.towerAt(cell);
    return !occupant || occupant.id === ignoreId;
  }

  place(type: TowerType, cell: Cell, hp = 1): Tower | null {
    if (!this.canPlace(cell)) return null;
    const tower: Tower = {
      id: this.nextId++,
      type,
      col: cell.col,
      row: cell.row,
      state: 'queued',
      hp,
      maxHp: hp,
      staticLevel: 0,
      muffleLevel: 0,
    };
    this.towers.set(tower.id, tower);
    return tower;
  }

  /** Moving never changes what plays: a live tower stays live, a queued one stays queued. */
  move(id: number, cell: Cell): boolean {
    const t = this.towers.get(id);
    if (!t || !this.canPlace(cell, id)) return false;
    t.col = cell.col;
    t.row = cell.row;
    return true;
  }

  /** Destroyed: silent and harmless until repaired. */
  wreck(id: number): void {
    const t = this.towers.get(id);
    if (!t) return;
    t.state = 'wreck';
    t.hp = 0;
    t.staticLevel = 0;
    t.muffleLevel = 0;
  }

  /** A repaired wreck comes back with full health on the next bar. */
  repair(id: number): boolean {
    const t = this.towers.get(id);
    if (!t || t.state !== 'wreck') return false;
    t.state = 'queued';
    t.hp = t.maxHp;
    return true;
  }

  remove(id: number): Tower | null {
    const t = this.towers.get(id);
    if (!t) return null;
    this.towers.delete(id);
    return t;
  }

  /** Called for every 16th step, in order. Returns what changed if this step starts a bar. */
  onStep(step: number): BarChange | null {
    if (!isBarStart(step)) return null;
    const entered: Tower[] = [];
    for (const t of this.towers.values()) {
      if (t.state === 'queued') {
        t.state = 'live';
        entered.push(t);
      }
    }
    const next = new Set<TowerType>();
    for (const t of this.towers.values()) if (t.state !== 'wreck') next.add(t.type);
    const layersOn = TOWER_TYPES.filter((ty) => next.has(ty) && !this.active.has(ty));
    const layersOff = TOWER_TYPES.filter((ty) => !next.has(ty) && this.active.has(ty));
    this.active = next;
    return { step, entered, layersOn, layersOff };
  }
}
