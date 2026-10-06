/**
 * The drum core: the beat you defend. Base drums always play; perks are extra percussion you buy.
 * DRUM_ORDER is the drop-out order (first to go first); losing the kick ends the run.
 */

import { parsePattern, type Pattern } from '../music/patterns';

export type BaseDrum = 'kick' | 'clap' | 'hats';
export type PerkDrum = 'shaker' | 'rim' | 'openhat';
export type DrumType = BaseDrum | PerkDrum;

export interface DrumDef {
  type: DrumType;
  name: string;
  color: number;
  pattern: Pattern;
}

export const DRUM_DEFS: Record<DrumType, DrumDef> = {
  openhat: { type: 'openhat', name: 'Open hat', color: 0xc8f6ff, pattern: parsePattern('..x...x...x...x.') },
  rim: { type: 'rim', name: 'Rim', color: 0xffb37a, pattern: parsePattern('...x..x.x.....x.') },
  shaker: { type: 'shaker', name: 'Shaker', color: 0xd7ffb0, pattern: parsePattern('gxXxgxXxgxXxgxXx') },
  hats: { type: 'hats', name: 'Hats', color: 0x9fe8ff, pattern: parsePattern('..x...x...x...x.') },
  clap: { type: 'clap', name: 'Clap', color: 0xfff0b0, pattern: parsePattern('....x.......x...') },
  kick: { type: 'kick', name: 'Kick', color: 0xffffff, pattern: parsePattern('x...x...x...x...') },
};

export const BASE_DRUMS: readonly BaseDrum[] = ['hats', 'clap', 'kick'];
export const PERK_DRUMS: readonly PerkDrum[] = ['shaker', 'rim', 'openhat'];

/** Drop-out order: perks first (last bought style: open hat, rim, shaker), then hats, clap, kick. */
export const DRUM_ORDER: readonly DrumType[] = ['openhat', 'rim', 'shaker', 'hats', 'clap', 'kick'];

export function isPerk(d: DrumType): d is PerkDrum {
  return (PERK_DRUMS as readonly string[]).includes(d);
}
