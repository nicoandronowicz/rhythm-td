/** Everything that makes a sound: the core's drums plus the tower layers. One mixer channel each. */

import { DRUM_ORDER, type DrumType } from './core';
import { TOWER_TYPES, type TowerType } from './towers';

/** The pad belongs to the core: a quiet chord bed that follows the harmony. */
export type CoreSound = 'pad';

export type InstrumentId = DrumType | TowerType | CoreSound;

export const INSTRUMENTS: readonly InstrumentId[] = [...DRUM_ORDER, 'pad', ...TOWER_TYPES];

/** Instruments routed through the core bus (they rest between waves). */
export function isCoreInstrument(id: InstrumentId): boolean {
  return id === 'pad' || (DRUM_ORDER as readonly string[]).includes(id);
}
