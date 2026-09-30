/**
 * 16-step pattern notation, pure and testable.
 *
 *   .  rest
 *   x  normal hit
 *   X  accented hit
 *   g  ghost hit (quiet)
 *   o  hit an octave up (bass)
 *
 * Velocities for each kind live in tuning, not here.
 */

export const STEPS_PER_BAR = 16;

export type HitKind = 'normal' | 'accent' | 'ghost' | 'octave';

export type Step = HitKind | null;

export type Pattern = readonly Step[];

const CHAR_TO_KIND: Record<string, Step> = {
  '.': null,
  x: 'normal',
  X: 'accent',
  g: 'ghost',
  o: 'octave',
};

export function parsePattern(source: string): Pattern {
  if (source.length !== STEPS_PER_BAR) {
    throw new Error(`Pattern "${source}" must have ${STEPS_PER_BAR} steps, has ${source.length}`);
  }
  return [...source].map((ch, i) => {
    if (!(ch in CHAR_TO_KIND)) {
      throw new Error(`Pattern "${source}" has unknown symbol "${ch}" at step ${i + 1}`);
    }
    return CHAR_TO_KIND[ch]!;
  });
}

/** 0-based step indices that have a hit. */
export function hitSteps(pattern: Pattern): number[] {
  const out: number[] = [];
  pattern.forEach((s, i) => {
    if (s !== null) out.push(i);
  });
  return out;
}

export function stepAt(pattern: Pattern, stepInBar: number): Step {
  return pattern[((stepInBar % STEPS_PER_BAR) + STEPS_PER_BAR) % STEPS_PER_BAR] ?? null;
}
