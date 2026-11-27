/**
 * Tower definitions as data: the four gameplay roles. Stats live in tuning; what each role plays
 * (patterns, notes, sound) comes from the song (music/songs). Combat behaviour comes from the stats, not code.
 */

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
  },
  chords: {
    type: 'chords',
    name: 'Chords',
    role: 'Area hit, short stun',
    color: 0xffc94d,
    shape: 'square',
    hotkey: '2',
    target: 'area',
  },
  arp: {
    type: 'arp',
    name: 'Arp',
    role: 'Fast light hits, long range',
    color: 0x4de1ff,
    shape: 'triangle',
    hotkey: '3',
    target: 'single',
  },
  lead: {
    type: 'lead',
    name: 'Lead',
    role: 'Heavy single hit, short range',
    color: 0xff4d6d,
    shape: 'circle',
    hotkey: '4',
    target: 'single',
  },
};

export const TOWER_TYPES: readonly TowerType[] = ['bass', 'chords', 'arp', 'lead'];
