/** Hit-kind to velocity mapping. */

import type { HitKind } from '../music/patterns';

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
