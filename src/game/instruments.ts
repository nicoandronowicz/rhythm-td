/** Everything that makes a sound: the core's drums plus the tower layers. One mixer channel each. */

import { DRUM_ORDER, type DrumType } from './core';
import { TOWER_TYPES, type TowerType } from './towers';

export type InstrumentId = DrumType | TowerType;

export const INSTRUMENTS: readonly InstrumentId[] = [...DRUM_ORDER, ...TOWER_TYPES];
