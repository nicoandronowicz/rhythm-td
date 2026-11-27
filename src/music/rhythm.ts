/**
 * Rhythm notation for any meter, pure and testable.
 *
 * One string per bar, one character per 16th (spaces are ignored, use them to group beats):
 *
 *   .  rest
 *   -  tie: the previous hit holds through this step
 *   anything else: a hit, named by that character. What the character means is up to the part
 *   (drum articulations, bass roles like R/O/5/A, accents). By default: X accent, x normal, g ghost.
 *
 * A rhythm is a list of bars that cycles, so 2- and 4-bar patterns are as easy as 1-bar ones.
 */

export interface Hit {
  /** Step inside the bar. */
  step: number;
  /** The character that made it. */
  sym: string;
  /** Length in steps, ties included (at least 1). */
  len: number;
  /** Which hit of the bar this is, 0-based. */
  index: number;
}

export interface Rhythm {
  stepsPerBar: number;
  bars: readonly (readonly Hit[])[];
  /** step -> hit lookup per bar. */
  readonly lookup: readonly (readonly (Hit | null)[])[];
}

export function parseBar(src: string, stepsPerBar: number): Hit[] {
  const chars = [...src.replace(/\s+/g, '')];
  if (chars.length !== stepsPerBar) {
    throw new Error(`Bar "${src}" has ${chars.length} steps, expected ${stepsPerBar}`);
  }
  const hits: Hit[] = [];
  chars.forEach((ch, i) => {
    if (ch === '.') return;
    if (ch === '-') {
      const last = hits[hits.length - 1];
      if (!last) throw new Error(`Bar "${src}" starts with a tie`);
      if (last.step + last.len === i) last.len++;
      return;
    }
    hits.push({ step: i, sym: ch, len: 1, index: hits.length });
  });
  return hits;
}

export function rhythm(stepsPerBar: number, ...bars: string[]): Rhythm {
  if (bars.length === 0) throw new Error('A rhythm needs at least one bar');
  const parsed = bars.map((b) => parseBar(b, stepsPerBar));
  const lookup = parsed.map((hits) => {
    const row: (Hit | null)[] = new Array(stepsPerBar).fill(null);
    for (const h of hits) row[h.step] = h;
    return row;
  });
  return { stepsPerBar, bars: parsed, lookup };
}

/** The hit starting at this step of the given bar (bars cycle), or null. */
export function hitAt(r: Rhythm, bar: number, stepInBar: number): Hit | null {
  const n = r.bars.length;
  const row = r.lookup[((bar % n) + n) % n]!;
  return row[stepInBar] ?? null;
}

/** Hits in one bar of the cycle. */
export function barHits(r: Rhythm, bar: number): readonly Hit[] {
  const n = r.bars.length;
  return r.bars[((bar % n) + n) % n]!;
}

/** Number of hits over the whole cycle, per bar on average. */
export function density(r: Rhythm): number {
  return r.bars.reduce((s, b) => s + b.length, 0) / r.bars.length;
}

/** Default velocity of a symbol: X accent, g ghost, anything else normal. */
export function defaultVelocity(sym: string): number {
  if (sym === 'X') return 1;
  if (sym === 'g') return 0.38;
  if (sym === sym.toUpperCase() && sym !== sym.toLowerCase()) return 1;
  return 0.78;
}
