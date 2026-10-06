/**
 * Combos by adjacency (touching, diagonals included). Defined as data; detection is pure.
 *
 *  - pair combos: a tower of one type touching a tower of the other type
 *  - group combos: a connected cluster of the listed types that contains at least one of each
 */

import type { Tower } from './board';
import type { TowerType } from './towers';

export type ComboId = 'sidechain' | 'callResponse' | 'fullBand';

export interface ComboDef {
  id: ComboId;
  name: string;
  /** Plain-language rule, shown in the game. */
  rule: string;
  kind: 'pair' | 'group';
  types: readonly TowerType[];
  color: number;
}

export const COMBO_DEFS: Record<ComboId, ComboDef> = {
  sidechain: {
    id: 'sidechain',
    name: 'Sidechain',
    rule: 'Bass next to Chords: both hit harder right after each kick, and pump with it',
    kind: 'pair',
    types: ['bass', 'chords'],
    color: 0xd8a0ff,
  },
  callResponse: {
    id: 'callResponse',
    name: 'Call & response',
    rule: 'Lead next to Arp: the lead can land critical hits',
    kind: 'pair',
    types: ['lead', 'arp'],
    color: 0xff9ec7,
  },
  fullBand: {
    id: 'fullBand',
    name: 'Full band',
    rule: 'Bass, Chords and Arp touching: all of them reach further',
    kind: 'group',
    types: ['bass', 'chords', 'arp'],
    color: 0x9dffd8,
  },
};

export const COMBO_IDS: readonly ComboId[] = ['sidechain', 'callResponse', 'fullBand'];

export interface ComboLink {
  combo: ComboId;
  a: number;
  b: number;
}

export interface ComboState {
  /** Which combos each tower is part of. */
  byTower: Map<number, Set<ComboId>>;
  /** Touching pairs that make a combo, for drawing. */
  links: ComboLink[];
  /** Combos active anywhere on the board. */
  active: Set<ComboId>;
}

export function touching(a: { col: number; row: number }, b: { col: number; row: number }): boolean {
  return Math.max(Math.abs(a.col - b.col), Math.abs(a.row - b.row)) === 1;
}

/** Only standing towers (live or about to be) count; wrecks don't. */
export function detectCombos(towers: readonly Tower[]): ComboState {
  const standing = towers.filter((t) => t.state !== 'wreck');
  const byTower = new Map<number, Set<ComboId>>();
  const links: ComboLink[] = [];
  const active = new Set<ComboId>();
  const tag = (id: number, combo: ComboId) => {
    let set = byTower.get(id);
    if (!set) byTower.set(id, (set = new Set()));
    set.add(combo);
    active.add(combo);
  };

  for (const def of Object.values(COMBO_DEFS)) {
    if (def.kind === 'pair') {
      const [ta, tb] = def.types as [TowerType, TowerType];
      for (const a of standing.filter((t) => t.type === ta)) {
        for (const b of standing.filter((t) => t.type === tb)) {
          if (!touching(a, b)) continue;
          tag(a.id, def.id);
          tag(b.id, def.id);
          links.push({ combo: def.id, a: a.id, b: b.id });
        }
      }
      continue;
    }
    // Group: connected clusters of the listed types.
    const members = standing.filter((t) => def.types.includes(t.type));
    const seen = new Set<number>();
    for (const start of members) {
      if (seen.has(start.id)) continue;
      const cluster: Tower[] = [];
      const queue = [start];
      seen.add(start.id);
      while (queue.length) {
        const t = queue.pop()!;
        cluster.push(t);
        for (const n of members) {
          if (!seen.has(n.id) && touching(t, n)) {
            seen.add(n.id);
            queue.push(n);
          }
        }
      }
      if (!def.types.every((ty) => cluster.some((t) => t.type === ty))) continue;
      for (const t of cluster) tag(t.id, def.id);
      for (let i = 0; i < cluster.length; i++) {
        for (let j = i + 1; j < cluster.length; j++) {
          if (touching(cluster[i]!, cluster[j]!)) links.push({ combo: def.id, a: cluster[i]!.id, b: cluster[j]!.id });
        }
      }
    }
  }
  return { byTower, links, active };
}
