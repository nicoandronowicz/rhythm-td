/**
 * Harmony: keys, modes, chord symbols, voicings and voice leading. Pure, no audio.
 *
 * This (with melody.ts and compose.ts) is the music module: the only code that decides a pitch.
 * Pitches are MIDI numbers; pitch classes are 0..11 (C = 0).
 */

export type Mode = 'ionian' | 'dorian' | 'phrygian' | 'lydian' | 'mixolydian' | 'aeolian' | 'harmonicMinor';

export const MODES: Record<Mode, readonly number[]> = {
  ionian: [0, 2, 4, 5, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  aeolian: [0, 2, 3, 5, 7, 8, 10],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
};

export interface Key {
  /** Tonic pitch class, 0..11. */
  root: number;
  mode: Mode;
}

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const LETTER: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export const pc = (midi: number): number => ((midi % 12) + 12) % 12;

export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function midiToName(midi: number): string {
  return `${NAMES[pc(midi)]}${Math.floor(midi / 12) - 1}`;
}

/** "F#" -> 6, "Bb" -> 10. */
export function parsePitchClass(s: string): number {
  const letter = LETTER[s[0]!.toUpperCase()];
  if (letter === undefined) throw new Error(`Bad note "${s}"`);
  let p = letter;
  for (const ch of s.slice(1)) {
    if (ch === '#') p++;
    else if (ch === 'b') p--;
    else throw new Error(`Bad note "${s}"`);
  }
  return pc(p);
}

export function parseKey(s: string): Key {
  // "F minor", "D dorian", "C# aeolian"
  const [note, mode = 'aeolian'] = s.trim().split(/\s+/);
  const m = mode === 'minor' ? 'aeolian' : mode === 'major' ? 'ionian' : (mode as Mode);
  if (!(m in MODES)) throw new Error(`Bad mode "${mode}"`);
  return { root: parsePitchClass(note!), mode: m };
}

/** Pitch classes of the key's scale, tonic first. */
export function scalePcs(key: Key): number[] {
  return MODES[key.mode].map((i) => pc(key.root + i));
}

export function inScale(key: Key, midi: number): boolean {
  return scalePcs(key).includes(pc(midi));
}

/**
 * The n-th scale degree (1 = tonic, 8 = tonic an octave up, 0 = the 7th below, -1 the 6th below...)
 * counted from the tonic at or above `base`.
 */
export function degreeToMidi(key: Key, degree: number, base: number): number {
  const steps = MODES[key.mode];
  const tonic = base + pc(key.root - base);
  const d = degree - 1;
  const oct = Math.floor(d / 7);
  const idx = ((d % 7) + 7) % 7;
  return tonic + oct * 12 + steps[idx]!;
}

// ---------- chords ----------

export interface Chord {
  /** The symbol as written, e.g. "Fm9" or "Ab/C". */
  name: string;
  root: number;
  /** Intervals above the root, root (0) first, ascending. */
  intervals: readonly number[];
  /** Bass pitch class (differs from root for slash chords). */
  bass: number;
}

const QUALITIES: Record<string, readonly number[]> = {
  '': [0, 4, 7],
  maj: [0, 4, 7],
  m: [0, 3, 7],
  min: [0, 3, 7],
  '5': [0, 7],
  '6': [0, 4, 7, 9],
  m6: [0, 3, 7, 9],
  '7': [0, 4, 7, 10],
  maj7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10],
  mmaj7: [0, 3, 7, 11],
  m7b5: [0, 3, 6, 10],
  dim: [0, 3, 6],
  dim7: [0, 3, 6, 9],
  aug: [0, 4, 8],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  '7sus4': [0, 5, 7, 10],
  add9: [0, 4, 7, 14],
  madd9: [0, 3, 7, 14],
  '9': [0, 4, 7, 10, 14],
  maj9: [0, 4, 7, 11, 14],
  m9: [0, 3, 7, 10, 14],
  m11: [0, 3, 7, 10, 14, 17],
  maj7s11: [0, 4, 7, 11, 18],
  '69': [0, 4, 7, 9, 14],
  m6add9: [0, 3, 7, 9, 14],
  '13': [0, 4, 7, 10, 14, 21],
  '7b9': [0, 4, 7, 10, 13],
};

/** "Fm9", "Dbmaj7", "Ab/C", "Gsus2", "C7b9". */
export function parseChord(symbol: string): Chord {
  const [main, slash] = symbol.split('/') as [string, string | undefined];
  const m = /^([A-G][#b]?)(.*)$/.exec(main);
  if (!m) throw new Error(`Bad chord "${symbol}"`);
  const root = parsePitchClass(m[1]!);
  const quality = m[2]!;
  const intervals = QUALITIES[quality];
  if (!intervals) throw new Error(`Unknown chord quality "${quality}" in "${symbol}"`);
  return { name: symbol, root, intervals, bass: slash ? parsePitchClass(slash) : root };
}

/** Pitch classes of a chord, root first. */
export function chordPcs(chord: Chord): number[] {
  return [...new Set(chord.intervals.map((i) => pc(chord.root + i)))];
}

/** Lowest MIDI note of pitch class `p` at or above `min`. */
export function placeAbove(p: number, min: number): number {
  return min + pc(p - min);
}

// ---------- voicings ----------

export type VoicingStyle =
  /** Close position, 3-4 notes inside an octave and a bit: stabs. */
  | 'close'
  /** Root left out (the bass has it), 7th/9th on top: a house-piano or Rhodes voicing. */
  | 'rootless'
  /** Wide, 5 notes over two octaves: pads and strings. */
  | 'open'
  /** 3rd and 7th only (with the 9th if there): sparse and jazzy. */
  | 'shell';

export interface VoicingOpts {
  style: VoicingStyle;
  /** Lowest allowed note. */
  low: number;
  /** Highest allowed note. */
  high: number;
}

/** Pitch-class sets a voicing style draws from (in order of importance). */
function voicingPcs(chord: Chord, style: VoicingStyle): number[] {
  const iv = chord.intervals;
  const has = (x: number) => iv.includes(x);
  const third = iv.find((i) => i === 3 || i === 4 || i === 2 || i === 5);
  const seventh = iv.find((i) => i === 10 || i === 11 || i === 9);
  const ninth = iv.find((i) => i === 14 || i === 13);
  const eleventh = iv.find((i) => i === 17 || i === 18);
  const rel: number[] = [];
  switch (style) {
    case 'shell':
      rel.push(third ?? 7, seventh ?? 7);
      if (ninth !== undefined) rel.push(ninth);
      break;
    case 'rootless':
      rel.push(third ?? 7, has(7) ? 7 : third ?? 0, seventh ?? 0, ninth ?? (seventh === undefined ? 12 : 7));
      break;
    case 'close':
      rel.push(0, third ?? 7, has(7) ? 7 : 0);
      if (seventh !== undefined) rel.push(seventh);
      else if (ninth !== undefined) rel.push(ninth);
      break;
    case 'open':
      rel.push(0, 7, third ?? 7, seventh ?? 12, ninth ?? eleventh ?? 7);
      if (eleventh !== undefined && ninth !== undefined) rel.push(eleventh);
      break;
  }
  return rel.map((r) => pc(chord.root + r));
}

/** Every way to stack the pitch classes upward (one rotation per starting note) inside the range. */
function candidates(pcs: number[], low: number, high: number, spread: boolean): number[][] {
  const out: number[][] = [];
  for (let rot = 0; rot < pcs.length; rot++) {
    const order = [...pcs.slice(rot), ...pcs.slice(0, rot)];
    for (let start = low; start < low + 12; start++) {
      if (pc(start) !== order[0]) continue;
      const notes = [start];
      for (const p of order.slice(1)) {
        const prev = notes[notes.length - 1]!;
        // Open voicings leave a gap of at least a 4th between the lowest two notes.
        const min = spread && notes.length === 1 ? prev + 5 : prev + 1;
        notes.push(placeAbove(p, min));
      }
      if (notes[notes.length - 1]! <= high) out.push(notes);
    }
  }
  return out;
}

/**
 * Voice a chord. With `prev`, picks the voicing that moves the least from it (smooth voice leading),
 * preferring a top note that holds or steps; without, picks the one centred in the range.
 */
export function voiceChord(chord: Chord, opts: VoicingOpts, prev?: readonly number[]): number[] {
  const pcs = [...new Set(voicingPcs(chord, opts.style))];
  const list = candidates(pcs, opts.low, opts.high, opts.style === 'open');
  if (list.length === 0) return pcs.map((p) => placeAbove(p, opts.low));
  const centre = (opts.low + opts.high) / 2;
  let best = list[0]!;
  let bestScore = Infinity;
  for (const v of list) {
    const mean = v.reduce((a, b) => a + b, 0) / v.length;
    let score = Math.abs(mean - centre) * 0.5;
    if (prev && prev.length) {
      // Sum of each voice's distance to the nearest previous voice, plus the top line's leap.
      score = v.reduce((s, n) => s + Math.min(...prev.map((p) => Math.abs(p - n))), 0);
      score += Math.abs(v[v.length - 1]! - prev[prev.length - 1]!) * 0.7;
      score += Math.abs(mean - centre) * 0.15;
    }
    if (score < bestScore) {
      bestScore = score;
      best = v;
    }
  }
  return best;
}

// ---------- bass ----------

/** Bass pitch for a role letter over a chord. Root sits in [low, low+11]. */
export function bassNote(role: string, chord: Chord, next: Chord, low: number): number {
  const root = placeAbove(chord.bass, low);
  switch (role.toUpperCase()) {
    case 'R':
      return root;
    case 'O':
      return root + 12;
    case '5':
      return placeAbove(pc(chord.root + 7), root);
    case '3': {
      const third = chord.intervals.find((i) => i === 3 || i === 4) ?? 7;
      return placeAbove(pc(chord.root + third), root);
    }
    case '7': {
      const seventh = chord.intervals.find((i) => i === 10 || i === 11) ?? 12;
      return placeAbove(pc(chord.root + seventh), root);
    }
    case 'L':
      // The fifth below the root: a low drop.
      return placeAbove(pc(chord.root + 7), root - 12);
    case 'A': {
      // Approach: a step below the next chord's bass (a half step if it's in the chord, else a whole step).
      const target = placeAbove(next.bass, low);
      return target - 1 >= low ? target - 1 : target + 11;
    }
    case 'N':
      // Upper neighbour: the 2nd above the root.
      return root + 2;
    default:
      return root;
  }
}

// ---------- arps ----------

/** Chord tones (with extensions) stacked upward from the first one at or above `low`, `count` notes. */
export function arpLadder(chord: Chord, low: number, count: number): number[] {
  const pcs = chordPcs(chord);
  const ladder: number[] = [];
  for (let n = low; ladder.length < count && n < low + 60; n++) if (pcs.includes(pc(n))) ladder.push(n);
  return ladder;
}

/** Is a note a chord tone (or a 9th) of the chord? */
export function isChordTone(chord: Chord, midi: number): boolean {
  return chordPcs(chord).includes(pc(midi));
}

/** Smallest interval in semitones between a note and any chord tone. */
export function distanceToChord(chord: Chord, midi: number): number {
  return Math.min(...chordPcs(chord).map((p) => Math.min(pc(midi - p), pc(p - midi))));
}

/** The nearest chord tone to a note (ties go down). */
export function nearestChordTone(chord: Chord, midi: number): number {
  for (let d = 0; d <= 6; d++) {
    if (isChordTone(chord, midi - d)) return midi - d;
    if (isChordTone(chord, midi + d)) return midi + d;
  }
  return midi;
}
