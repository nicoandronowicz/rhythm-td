/**
 * Decides which layers hit on a step. Pure: the audio engine turns the result into sound,
 * the scene turns it into pulses.
 */

import { stepAt, type HitKind, type Pattern } from '../music/patterns';
import { stepToPosition } from '../music/timing';
import { TOWER_DEFS, TOWER_TYPES, type TowerType } from './towers';

export interface Hit {
  type: TowerType;
  kind: HitKind;
}

export type PatternFor = (type: TowerType) => Pattern;

export const basePatterns: PatternFor = (type) => TOWER_DEFS[type].patterns.base;

export function hitsForStep(step: number, active: ReadonlySet<TowerType>, patternFor: PatternFor = basePatterns): Hit[] {
  const { stepInBar } = stepToPosition(step);
  const hits: Hit[] = [];
  for (const type of TOWER_TYPES) {
    if (!active.has(type)) continue;
    const kind = stepAt(patternFor(type), stepInBar);
    if (kind) hits.push({ type, kind });
  }
  return hits;
}

export interface VelocityTuning {
  normal: number;
  accent: number;
  ghost: number;
}

export function velocityFor(kind: HitKind, v: VelocityTuning): number {
  switch (kind) {
    case 'accent':
      return v.accent;
    case 'ghost':
      return v.ghost;
    case 'normal':
    case 'octave':
      return v.normal;
  }
}
