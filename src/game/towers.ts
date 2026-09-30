/**
 * Tower definitions as data. Adding a tower = adding an entry here plus a voice in audio/instruments.
 */

import { parsePattern, type Pattern } from '../music/patterns';

export type TowerType = 'kick' | 'clap' | 'hats' | 'bass';

export type TowerShape = 'circle' | 'square' | 'triangle' | 'diamond';

export interface TowerDef {
  type: TowerType;
  name: string;
  role: string;
  color: number;
  shape: TowerShape;
  hotkey: string;
  patterns: {
    base: Pattern;
    upgraded: Pattern;
  };
}

export const TOWER_DEFS: Record<TowerType, TowerDef> = {
  kick: {
    type: 'kick',
    name: 'Kick',
    role: 'Heavy single hit, short range',
    color: 0xff4d6d,
    shape: 'circle',
    hotkey: '1',
    patterns: {
      base: parsePattern('x...x...x...x...'),
      upgraded: parsePattern('X...X...X...X.g.'),
    },
  },
  clap: {
    type: 'clap',
    name: 'Clap',
    role: 'Area pulse, short stun',
    color: 0xffc94d,
    shape: 'square',
    hotkey: '2',
    patterns: {
      base: parsePattern('....x.......x...'),
      upgraded: parsePattern('....x.......x..g'),
    },
  },
  hats: {
    type: 'hats',
    name: 'Hats',
    role: 'Fast light hits, long range',
    color: 0x4de1ff,
    shape: 'triangle',
    hotkey: '3',
    patterns: {
      base: parsePattern('..x...x...x...x.'),
      upgraded: parsePattern('ggXgggXgggXgggXg'),
    },
  },
  bass: {
    type: 'bass',
    name: 'Bass',
    role: 'Slows enemies on a stretch of path',
    color: 0xa970ff,
    shape: 'diamond',
    hotkey: '4',
    patterns: {
      base: parsePattern('..x...x...x...x.'),
      upgraded: parsePattern('..x..ox...x..ox.'),
    },
  },
};

export const TOWER_TYPES: readonly TowerType[] = ['kick', 'clap', 'hats', 'bass'];
