/**
 * Tower definitions as data. Adding a tower = an entry here, a stats section and a sound section
 * in tuning, and a voice in audio/instruments. Combat behaviour comes from the stats, not code.
 */

import { parsePattern, type Pattern } from '../music/patterns';

export type TowerType = 'bass' | 'chords' | 'arp' | 'lead';

export type TowerShape = 'circle' | 'square' | 'triangle' | 'diamond';

/** How a tower picks who it hits on its steps. */
export type TargetMode = 'single' | 'area';

export interface TowerDef {
  type: TowerType;
  name: string;
  role: string;
  color: number;
  shape: TowerShape;
  hotkey: string;
  target: TargetMode;
  patterns: {
    base: Pattern;
    upgraded: Pattern;
  };
}

export const TOWER_DEFS: Record<TowerType, TowerDef> = {
  bass: {
    type: 'bass',
    name: 'Bass',
    role: 'Slows everything in range',
    color: 0xa970ff,
    shape: 'diamond',
    hotkey: '1',
    target: 'area',
    patterns: {
      base: parsePattern('..x...x...x...x.'),
      upgraded: parsePattern('..x..ox...x..ox.'),
    },
  },
  chords: {
    type: 'chords',
    name: 'Chords',
    role: 'Area hit, short stun',
    color: 0xffc94d,
    shape: 'square',
    hotkey: '2',
    target: 'area',
    patterns: {
      base: parsePattern('...x......x..x..'),
      upgraded: parsePattern('...x..x...x..x..'),
    },
  },
  arp: {
    type: 'arp',
    name: 'Arp',
    role: 'Fast light hits, long range',
    color: 0x4de1ff,
    shape: 'triangle',
    hotkey: '3',
    target: 'single',
    patterns: {
      base: parsePattern('x.x.x.x.x.x.x.x.'),
      upgraded: parsePattern('xxxxxxxxxxxxxxxx'),
    },
  },
  lead: {
    type: 'lead',
    name: 'Lead',
    role: 'Heavy single hit, short range',
    color: 0xff4d6d,
    shape: 'circle',
    hotkey: '4',
    target: 'single',
    patterns: {
      base: parsePattern('x......x..x.....'),
      upgraded: parsePattern('x......x..x...x.'),
    },
  },
};

export const TOWER_TYPES: readonly TowerType[] = ['bass', 'chords', 'arp', 'lead'];
