/**
 * Levels as data: the training levels (each teaches one thing) and Endless.
 * A level picks a map, which towers and mechanics are available, and what the coach says when.
 * Its numbers (waves to win, money, tempo, swing, enemy toughness) live in tuning, one section per level.
 */

import type { EnemyType } from './enemies';
import type { GridLayout } from './grid';
import { PROTOTYPE_MAP } from './grid';
import type { TowerType } from './towers';

export type LevelId = 'level1' | 'level2' | 'level3' | 'level4' | 'level5' | 'endless';

export interface LevelFeatures {
  upgrades: boolean;
  perks: boolean;
  combos: boolean;
  rewards: boolean;
  lift: boolean;
  /** Enemies hit towers (Static damage and noise, Muffler muffling). */
  enemiesAttack: boolean;
}

/**
 * Something that happens in a run, for the coach to react to.
 * 'wave:N' fires when wave N starts, 'cleared:N' when it's cleared.
 */
export type CoachTrigger =
  | 'start'
  | 'placed'
  | `placed:${TowerType}`
  | `wave:${number}`
  | `cleared:${number}`
  | 'firstKill'
  | 'enemyAttack'
  | 'wreck'
  | 'repaired'
  | 'upgraded'
  | 'perk'
  | 'combo'
  | 'rewardOffer'
  | 'rewardTaken'
  | 'liftReady'
  | 'lift'
  | 'leak';

export interface CoachStep {
  /** When to show it. */
  on: CoachTrigger;
  text: string;
  /** Hide it when this happens (otherwise it stays until the next step or "Got it"). */
  until?: CoachTrigger;
}

export interface LevelDef {
  id: LevelId;
  number: number;
  name: string;
  /** One line: what this level teaches. */
  teaches: string;
  map: GridLayout;
  towers: readonly TowerType[];
  enemies: readonly EnemyType[];
  features: LevelFeatures;
  coach: readonly CoachStep[];
}

const map = (cols: number, rows: number, waypoints: [number, number][], core: [number, number]): GridLayout => ({
  cols,
  rows,
  waypoints: waypoints.map(([col, row]) => ({ col, row })),
  core: { col: core[0], row: core[1], cols: 3, rows: 4 },
});

const NONE: LevelFeatures = { upgrades: false, perks: false, combos: false, rewards: false, lift: false, enemiesAttack: false };

export const LEVELS: readonly LevelDef[] = [
  {
    id: 'level1',
    number: 1,
    name: 'First Groove',
    teaches: 'The core, your first tower, and how towers wake up when enemies come close.',
    map: map(16, 10, [[-1, 2], [6, 2], [6, 7], [12, 7]], [13, 5]),
    towers: ['bass'],
    enemies: ['static'],
    features: NONE,
    coach: [
      { on: 'start', text: 'This is the core. It plays the beat, and the beat is your life. Enemies walk the path to break it.' },
      { on: 'start', text: 'Press 1 (or click Bass on the right) and place it on a dark cell next to the path.', until: 'placed' },
      { on: 'placed', text: 'Hear it in the distance? Towers play softly until an enemy comes close. Then they open up and hit on their notes.' },
      { on: 'wave:1', text: 'Here they come. Listen to the bass open up as they pass, and watch it slow them down.' },
      { on: 'firstKill', text: 'Every kill pays. Spend it on another Bass further down the path, so it plays for longer.' },
      { on: 'leak', text: 'One got through and the core lost some health. Lose the kick and the music stops.' },
      { on: 'cleared:1', text: 'Wave cleared. Between waves the core rests. In the last bar it sweeps back open: the next wave is coming.' },
    ],
  },
  {
    id: 'level2',
    number: 2,
    name: 'Stabs',
    teaches: 'Chords hit everything nearby and stun. Spread towers along the path to arrange the track.',
    map: map(18, 11, [[-1, 1], [4, 1], [4, 8], [10, 8], [10, 3], [14, 3], [14, 5]], [15, 3]),
    towers: ['bass', 'chords'],
    enemies: ['static'],
    features: NONE,
    coach: [
      { on: 'start', text: 'New tower: Chords (2). Its stabs hit every enemy in range and freeze them for a moment.' },
      { on: 'placed:chords', text: 'Chords love corners: one tower can reach two stretches of path.' },
      { on: 'wave:1', text: 'Towers near the entrance play first, towers near the core play last. Where you build is how the track is arranged.' },
      { on: 'wave:2', text: 'Waves get bigger. Mix Bass (slow) and Chords (stun) so enemies stay in range longer.' },
      { on: 'leak', text: 'A leak. Hover a tower to see its range, and close the gaps along the path.' },
    ],
  },
  {
    id: 'level3',
    number: 3,
    name: 'Hook Line',
    teaches: 'Arp reaches far, Lead hits hard up close, and any tower can be upgraded.',
    map: map(18, 12, [[-1, 9], [3, 9], [3, 2], [8, 2], [8, 9], [13, 9], [13, 5], [14, 5]], [15, 3]),
    towers: ['bass', 'chords', 'arp', 'lead'],
    enemies: ['static'],
    features: { ...NONE, upgrades: true },
    coach: [
      { on: 'start', text: 'Two new towers. Arp (3): quick light hits from far away. Lead (4): one heavy hit, short range, on the enemy furthest along.' },
      { on: 'placed:lead', text: 'Leads hit hardest right next to the path. Arps can sit further back and still reach.' },
      { on: 'wave:2', text: 'Click a tower to upgrade it. From the next bar it plays a busier part, hits harder and reaches further.' },
      { on: 'upgraded', text: 'Upgraded. The badge blinks until the next bar, then you hear the new part.' },
    ],
  },
  {
    id: 'level4',
    number: 4,
    name: 'Interference',
    teaches: 'Enemies attack your sound. Repair wrecks, and buy core perks for more groove and health.',
    map: map(20, 12, [[-1, 5], [3, 5], [3, 1], [9, 1], [9, 10], [15, 10], [15, 6], [16, 6]], [17, 4]),
    towers: ['bass', 'chords', 'arp', 'lead'],
    enemies: ['static', 'muffler'],
    features: { ...NONE, upgrades: true, perks: true, enemiesAttack: true },
    coach: [
      { on: 'start', text: 'From here on, enemies fight back. Static wears towers down and adds crackle. Mufflers smother their sound and shrink their range.' },
      { on: 'enemyAttack', text: 'Hear that? A tower under attack sounds damaged. Kill the attacker fast, or its sound gets worse.' },
      { on: 'wreck', text: 'A tower broke and went silent. Click the wreck to repair it for half price; it comes back on the next bar.' },
      { on: 'wave:2', text: 'Click the core to buy perks: Shaker, Rim, Open hat. Each adds groove and one more drum of health.' },
      { on: 'perk', text: 'New percussion joins on the next bar. Perks drop out first if enemies reach the core, protecting your kick.' },
    ],
  },
  {
    id: 'level5',
    number: 5,
    name: 'Chemistry',
    teaches: 'Towers touching each other make combos. Pick rewards after each wave, and Lift the track.',
    map: map(22, 13, [[-1, 1], [5, 1], [5, 6], [2, 6], [2, 11], [10, 11], [10, 3], [15, 3], [15, 10], [18, 10], [18, 7]], [19, 5]),
    towers: ['bass', 'chords', 'arp', 'lead'],
    enemies: ['static', 'muffler'],
    features: { upgrades: true, perks: true, combos: true, rewards: true, lift: true, enemiesAttack: true },
    coach: [
      { on: 'start', text: 'Combos: put a Bass touching a Chords (Sidechain), a Lead touching an Arp (Call & response), or Bass, Chords and Arp together (Full band).' },
      { on: 'combo', text: 'Combo! Hover a tower to see its combos. Sidechain makes the chords and bass pump with the kick.' },
      { on: 'firstKill', text: 'Kills fill the LIFT meter at the top. When it is full, press L: the track lifts at the next phrase and every tower hits harder.' },
      { on: 'liftReady', text: 'Lift is ready. Press L (or click the meter) and wait for the next phrase.' },
      { on: 'rewardOffer', text: 'Wave cleared: pick one reward. Each one changes how you play and how the track sounds.' },
    ],
  },
  {
    id: 'endless',
    number: 6,
    name: 'Club Night',
    teaches: 'Everything, no end. How long can you keep the groove going?',
    map: PROTOTYPE_MAP,
    towers: ['bass', 'chords', 'arp', 'lead'],
    enemies: ['static', 'muffler'],
    features: { upgrades: true, perks: true, combos: true, rewards: true, lift: true, enemiesAttack: true },
    coach: [],
  },
];

export function levelById(id: LevelId): LevelDef {
  return LEVELS.find((l) => l.id === id)!;
}

export function nextLevel(id: LevelId): LevelDef | null {
  const i = LEVELS.findIndex((l) => l.id === id);
  return LEVELS[i + 1] ?? null;
}
