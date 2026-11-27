/**
 * Composed melodies, written as scale degrees. Pure and testable.
 *
 * Bars are separated by "|". Each token is a note or a rest with a length in 16ths:
 *
 *   5:4     the 5th degree for 4 steps
 *   1':2    the tonic an octave up        (' up, , down, as many as needed)
 *   b3:2    a flattened 3rd               (b flat, # sharp, before the degree)
 *   ~4:2    slide into this note from the previous one
 *   r:4     rest for 4 steps
 *
 * Each bar must add up to the meter's steps per bar. Degrees follow the song's key and mode,
 * so the same line works in any key.
 */

export interface MelodyNote {
  /** Step from the start of the melody. */
  step: number;
  len: number;
  /** 1-based scale degree, octave already folded in (8 = tonic an octave up). */
  degree: number;
  /** Chromatic shift in semitones. */
  accidental: number;
  slide: boolean;
}

export interface Melody {
  bars: number;
  stepsPerBar: number;
  notes: readonly MelodyNote[];
  /** step -> note starting there. */
  readonly starts: ReadonlyMap<number, MelodyNote>;
}

const TOKEN = /^(~)?([b#]*)(-?\d+)([',]*)(?::(\d+))?$|^r(?::(\d+))?$/;

export function parseMelody(src: string, stepsPerBar: number): Melody {
  const bars = src.split('|').map((b) => b.trim());
  const notes: MelodyNote[] = [];
  bars.forEach((bar, bi) => {
    let pos = 0;
    for (const tok of bar.split(/\s+/).filter(Boolean)) {
      const m = TOKEN.exec(tok);
      if (!m) throw new Error(`Bad melody token "${tok}" in bar ${bi + 1}`);
      if (tok.startsWith('r')) {
        pos += Number(m[6] ?? 1);
        continue;
      }
      const len = Number(m[5] ?? 1);
      const accidental = [...(m[2] ?? '')].reduce((a, c) => a + (c === '#' ? 1 : -1), 0);
      const octave = [...(m[4] ?? '')].reduce((a, c) => a + (c === "'" ? 1 : -1), 0);
      notes.push({ step: bi * stepsPerBar + pos, len, degree: Number(m[3]) + octave * 7, accidental, slide: m[1] === '~' });
      pos += len;
    }
    if (pos !== stepsPerBar) throw new Error(`Melody bar ${bi + 1} ("${bar}") has ${pos} steps, expected ${stepsPerBar}`);
  });
  return { bars: bars.length, stepsPerBar, notes, starts: new Map(notes.map((n) => [n.step, n])) };
}

/** The note starting at a step of the melody (it cycles), or undefined. */
export function melodyNoteAt(m: Melody, stepFromStart: number): MelodyNote | undefined {
  const len = m.bars * m.stepsPerBar;
  return m.starts.get(((stepFromStart % len) + len) % len);
}
