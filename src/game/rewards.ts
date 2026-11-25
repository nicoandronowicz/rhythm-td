/**
 * Pick-1-of-3 rewards, as data. Every reward changes the game and the track at the same time.
 * Rewards add to `Mods`, which the world and the audio engine read.
 */

import type { Tuning } from '../config/tuning';
import type { LevelDef } from './levels';
import { TOWER_TYPES, type TowerType } from './towers';

export interface Mods {
  /** Swing added on top of the track's. */
  swing: number;
  /** Damage bonus per tower type (0.1 = +10%). */
  damage: Record<TowerType, number>;
  /** Range bonus for every tower (0.15 = +15%). */
  range: number;
  /** Extra money per kill. */
  bounty: number;
  /** Added to the Sidechain combo's boost. */
  sidechainBoost: number;
  /** Added to Call & response crit chance. */
  critChance: number;
  /** Extra stun steps per tower type. */
  stun: Record<TowerType, number>;
  /** Tower types playing their alternate part. */
  variants: Set<TowerType>;
  /** Sound flavours: extra drive on bass and lead, stereo width, extra chord reverb, deeper pump (dB). */
  drive: number;
  width: number;
  chordsRoom: number;
  pump: number;
}

export function emptyMods(): Mods {
  const zero = () => Object.fromEntries(TOWER_TYPES.map((t) => [t, 0])) as Record<TowerType, number>;
  return {
    swing: 0,
    damage: zero(),
    range: 0,
    bounty: 0,
    sidechainBoost: 0,
    critChance: 0,
    stun: zero(),
    variants: new Set(),
    drive: 0,
    width: 0,
    chordsRoom: 0,
    pump: 0,
  };
}

export type RewardId =
  | 'shuffle'
  | 'saturation'
  | 'wide'
  | 'tipjar'
  | 'heavySidechain'
  | 'longTail'
  | 'hotHands'
  | 'rollingBass'
  | 'offbeatOrgan'
  | 'gallopArp'
  | 'answerPhrase'
  | 'patchCable';

export interface RewardContext {
  level: LevelDef;
}

export interface RewardDef {
  id: RewardId;
  name: string;
  /** What it does in the game. */
  game: string;
  /** What it does to the track. */
  sound: string;
  color: number;
  /** Can only be taken once. */
  unique: boolean;
  available(ctx: RewardContext): boolean;
  apply(mods: Mods, t: Readonly<Tuning>): void;
}

const has = (ctx: RewardContext, tower: TowerType) => ctx.level.towers.includes(tower);

export const REWARDS: readonly RewardDef[] = [
  {
    id: 'shuffle',
    name: 'Shuffle',
    game: 'All towers +10% damage',
    sound: 'The groove swings harder',
    color: 0xffc94d,
    unique: false,
    available: () => true,
    apply: (m, t) => {
      m.swing += t.rewards.shuffleSwing;
      for (const ty of TOWER_TYPES) m.damage[ty] += t.rewards.shuffleDamage;
    },
  },
  {
    id: 'saturation',
    name: 'Saturation',
    game: 'Bass and Lead +25% damage',
    sound: 'Bass and lead get gritty',
    color: 0xff7a59,
    unique: false,
    available: (c) => has(c, 'bass') || has(c, 'lead'),
    apply: (m, t) => {
      m.damage.bass += t.rewards.saturationDamage;
      m.damage.lead += t.rewards.saturationDamage;
      m.drive += 0.25;
    },
  },
  {
    id: 'wide',
    name: 'Wide mix',
    game: 'All towers +15% range',
    sound: 'The mix opens up in stereo',
    color: 0x4de1ff,
    unique: false,
    available: () => true,
    apply: (m, t) => {
      m.range += t.rewards.wideRange;
      m.width += 0.5;
    },
  },
  {
    id: 'tipjar',
    name: 'Tip jar',
    game: '+$3 for every kill',
    sound: 'The crowd gets into it',
    color: 0x5dffa8,
    unique: false,
    available: () => true,
    apply: (m, t) => {
      m.bounty += t.rewards.tipJar;
    },
  },
  {
    id: 'heavySidechain',
    name: 'Heavy sidechain',
    game: 'Sidechain combo hits even harder',
    sound: 'Chords and bass pump deeper',
    color: 0xd8a0ff,
    unique: true,
    available: (c) => c.level.features.combos,
    apply: (m, t) => {
      m.sidechainBoost += t.rewards.sidechainBoost;
      m.pump -= 4;
    },
  },
  {
    id: 'longTail',
    name: 'Long tail',
    game: 'Chords stun longer',
    sound: 'Chord stabs ring out into the reverb',
    color: 0xffe28a,
    unique: true,
    available: (c) => has(c, 'chords'),
    apply: (m, t) => {
      m.stun.chords += t.rewards.longTailStun;
      m.chordsRoom += 6;
    },
  },
  {
    id: 'hotHands',
    name: 'Hot hands',
    game: 'Call & response: +20% crit chance',
    sound: 'The lead pushes harder',
    color: 0xff9ec7,
    unique: true,
    available: (c) => c.level.features.combos,
    apply: (m, t) => {
      m.critChance += t.rewards.hotHands;
    },
  },
  {
    id: 'rollingBass',
    name: 'Rolling bass',
    game: 'Bass plays a busier part: more hits',
    sound: 'A rolling, syncopated bassline',
    color: 0xa970ff,
    unique: true,
    available: (c) => has(c, 'bass'),
    apply: (m) => void m.variants.add('bass'),
  },
  {
    id: 'offbeatOrgan',
    name: 'Offbeat organ',
    game: 'Chords stab on every offbeat',
    sound: 'Classic offbeat house chords',
    color: 0xffc94d,
    unique: true,
    available: (c) => has(c, 'chords'),
    apply: (m) => void m.variants.add('chords'),
  },
  {
    id: 'gallopArp',
    name: 'Gallop arp',
    game: 'Arp plays a galloping part: more hits',
    sound: 'A driving, galloping arpeggio',
    color: 0x4de1ff,
    unique: true,
    available: (c) => has(c, 'arp'),
    apply: (m) => void m.variants.add('arp'),
  },
  {
    id: 'answerPhrase',
    name: 'Answer phrase',
    game: 'Lead plays a longer phrase: more hits',
    sound: 'The hook answers itself',
    color: 0xff4d6d,
    unique: true,
    available: (c) => has(c, 'lead'),
    apply: (m) => void m.variants.add('lead'),
  },
  {
    id: 'patchCable',
    name: 'Patch cable',
    game: 'Repair every wreck and give the core one drum hit back',
    sound: 'Lost layers come back',
    color: 0x9dffd8,
    unique: false,
    available: (c) => c.level.features.enemiesAttack,
    // Handled by the world (it touches towers and the core, not mods).
    apply: () => {},
  },
];

export function rewardById(id: RewardId): RewardDef {
  return REWARDS.find((r) => r.id === id)!;
}

/** Three different rewards that fit the level and aren't used-up uniques. */
export function offerRewards(rng: () => number, taken: readonly RewardId[], ctx: RewardContext, count = 3): RewardId[] {
  const pool = REWARDS.filter((r) => r.available(ctx) && !(r.unique && taken.includes(r.id))).map((r) => r.id);
  const out: RewardId[] = [];
  while (out.length < count && pool.length > 0) {
    const i = Math.min(pool.length - 1, Math.floor(rng() * pool.length));
    out.push(pool.splice(i, 1)[0]!);
  }
  return out;
}
