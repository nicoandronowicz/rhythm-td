/**
 * The drum core: the beat you defend. Always plays. Drums are listed in drop-out order
 * (first to go first); losing the last one ends the run.
 */

import { parsePattern, type Pattern } from '../music/patterns';

export type DrumType = 'kick' | 'clap' | 'hats';

export interface DrumDef {
  type: DrumType;
  name: string;
  color: number;
  pattern: Pattern;
}

export const DRUM_DEFS: Record<DrumType, DrumDef> = {
  hats: { type: 'hats', name: 'Hats', color: 0x9fe8ff, pattern: parsePattern('..x...x...x...x.') },
  clap: { type: 'clap', name: 'Clap', color: 0xfff0b0, pattern: parsePattern('....x.......x...') },
  kick: { type: 'kick', name: 'Kick', color: 0xffffff, pattern: parsePattern('x...x...x...x...') },
};

/** Drop-out order: first entry goes first, the last one is the heartbeat. */
export const DRUM_ORDER: readonly DrumType[] = ['hats', 'clap', 'kick'];
