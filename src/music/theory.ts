/**
 * The music module. The only place in the game allowed to pick a pitch.
 *
 * Everything here is pure (no Tone.js) so it can be unit tested.
 * Pitches are MIDI numbers; `midiToFreq` / `midiToName` convert for the audio layer.
 *
 * Harmony: each wave plays one 8-bar progression in A minor (2 bars per chord), chosen from a
 * curated list. Every melodic voice asks this module for notes given the current chord.
 */

export type PitchClass = 'C' | 'C#' | 'D' | 'D#' | 'E' | 'F' | 'F#' | 'G' | 'G#' | 'A' | 'A#' | 'B';

const PITCH_CLASSES: readonly PitchClass[] = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export interface Chord {
  name: string;
  /** Pitch classes, root first. */
  tones: readonly PitchClass[];
}

export interface Progression {
  name: string;
  /** One chord per 2 bars. */
  chords: readonly Chord[];
}

export const BARS_PER_CHORD = 2;

export const CHORDS = {
  Am7: { name: 'Am7', tones: ['A', 'C', 'E', 'G'] },
  Fmaj7: { name: 'Fmaj7', tones: ['F', 'A', 'C', 'E'] },
  Cmaj7: { name: 'Cmaj7', tones: ['C', 'E', 'G', 'B'] },
  G: { name: 'G', tones: ['G', 'B', 'D'] },
  Dm7: { name: 'Dm7', tones: ['D', 'F', 'A', 'C'] },
  Em7: { name: 'Em7', tones: ['E', 'G', 'B', 'D'] },
} as const satisfies Record<string, Chord>;

const { Am7, Fmaj7, Cmaj7, G, Dm7, Em7 } = CHORDS;

/** One per wave, cycling. The intro uses the first. */
export const PROGRESSIONS: readonly Progression[] = [
  { name: 'i–VI–III–VII', chords: [Am7, Fmaj7, Cmaj7, G] },
  { name: 'i–iv–VI–v', chords: [Am7, Dm7, Fmaj7, Em7] },
  { name: 'VI–VII–i', chords: [Fmaj7, G, Am7, Am7] },
  { name: 'i–v–VI–VII', chords: [Am7, Em7, Fmaj7, G] },
  { name: 'iv–i–VI–VII', chords: [Dm7, Am7, Fmaj7, G] },
];

/** The key's scale (A natural minor) and the melody scale (A minor pentatonic). */
export const KEY_SCALE: readonly PitchClass[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
export const MELODY_SCALE: readonly PitchClass[] = ['A', 'C', 'D', 'E', 'G'];

/** E1 (28) up to D#2 (39): the bass root always sits here. */
export const BASS_RANGE: readonly [number, number] = [28, 39];
/** Chord stab roots sit between E3 and D#4. */
const VOICING_ROOT_RANGE: readonly [number, number] = [52, 63];
/** The arp climbs from the first chord tone at or above E4. */
const ARP_FLOOR = 64;
/** The lead lives between E4 and A5. */
const LEAD_RANGE: readonly [number, number] = [64, 81];
/** A1, 55 Hz. */
const KICK_NOTE = 33;
/** The rim/perc is tuned to E5, the key's fifth: it sits well on every chord. */
const PERC_NOTE = 76;

export function pitchClassIndex(pc: PitchClass): number {
  return PITCH_CLASSES.indexOf(pc);
}

function pcOf(midi: number): number {
  return ((midi % 12) + 12) % 12;
}

export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function midiToName(midi: number): string {
  const pc = PITCH_CLASSES[pcOf(midi)];
  const octave = Math.floor(midi / 12) - 1;
  return `${pc}${octave}`;
}

/** Lowest MIDI note of pitch class `pc` at or above `min`. */
function placeInRange(pc: PitchClass, min: number): number {
  const offset = (((pitchClassIndex(pc) - min) % 12) + 12) % 12;
  return min + offset;
}

// ---------- harmony timeline ----------

/** Progression a wave plays (wave 0 = the intro). */
export function progressionForWave(wave: number): number {
  return (((Math.max(wave, 1) - 1) % PROGRESSIONS.length) + PROGRESSIONS.length) % PROGRESSIONS.length;
}

export function progressionBars(progression: number): number {
  return PROGRESSIONS[progression]!.chords.length * BARS_PER_CHORD;
}

/** Chord at a bar counted from the start of the progression (wraps around). */
export function chordInProgression(progression: number, barInProgression: number): Chord {
  const p = PROGRESSIONS[progression]!;
  const len = p.chords.length * BARS_PER_CHORD;
  const bar = ((barInProgression % len) + len) % len;
  return p.chords[Math.floor(bar / BARS_PER_CHORD)]!;
}

// ---------- notes ----------

export function kickNote(): number {
  return KICK_NOTE;
}

export function percNote(): number {
  return PERC_NOTE;
}

/** Bass root, placed inside the bass range. */
export function bassRoot(chord: Chord): number {
  return placeInRange(chord.tones[0]!, BASS_RANGE[0]);
}

/**
 * Pitches for the two bass layers on a hit: the sub on the root (or its octave), and the mid layer
 * an octave above it (small speakers can't play the root, so the ear rebuilds it from the mid layer).
 */
export function bassLayerNotes(chord: Chord, octaveUp: boolean): { sub: number; mid: number } {
  const sub = bassRoot(chord) + (octaveUp ? 12 : 0);
  return { sub, mid: sub + 12 };
}

/** Chord tones stacked upward from the root. */
function stack(chord: Chord, root: number): number[] {
  const out = [root];
  let prev = root;
  for (const pc of chord.tones.slice(1)) {
    prev = placeInRange(pc, prev + 1);
    out.push(prev);
  }
  return out;
}

/** Notes of a chord stab, ascending, root position with the root between E3 and D#4. */
export function chordVoicing(chord: Chord): number[] {
  return stack(chord, placeInRange(chord.tones[0]!, VOICING_ROOT_RANGE[0]));
}

export type ArpStyle = 'up' | 'down' | 'updown' | 'broken';
export const ARP_STYLES: readonly ArpStyle[] = ['up', 'updown', 'down', 'broken'];

export function arpStyleForWave(wave: number): ArpStyle {
  return ARP_STYLES[(Math.max(wave, 1) - 1) % ARP_STYLES.length]!;
}

/** The arp's ladder: the chord over two octaves from the first chord tone at or above E4. */
function arpLadder(chord: Chord): number[] {
  const first = Math.min(...chord.tones.map((pc) => placeInRange(pc, ARP_FLOOR)));
  const ladder: number[] = [];
  for (let n = first; ladder.length < chord.tones.length * 2; n++) {
    if (chord.tones.some((pc) => pitchClassIndex(pc) === pcOf(n))) ladder.push(n);
  }
  return ladder;
}

/** Arp note for the n-th hit of a bar, walking the chord ladder in the wave's style. */
export function arpNote(chord: Chord, hitIndex: number, style: ArpStyle = 'up'): number {
  const ladder = arpLadder(chord);
  const n = ladder.length;
  const i = Math.max(0, hitIndex);
  let idx: number;
  switch (style) {
    case 'up':
      idx = i % n;
      break;
    case 'down':
      idx = n - 1 - (i % n);
      break;
    case 'updown': {
      const cycle = 2 * n - 2;
      const k = i % cycle;
      idx = k < n ? k : cycle - k;
      break;
    }
    case 'broken': {
      // 1-3-2-4 shape climbing the ladder.
      const shape = [0, 2, 1, 3];
      idx = (Math.floor(i / 4) * 2 + shape[i % 4]!) % n;
      break;
    }
  }
  return ladder[idx]!;
}

/**
 * Notes the lead may use over a chord: chord tones, plus pentatonic notes that sit at least a
 * whole step away from every chord tone (so nothing rubs).
 */
export function isSafeLeadNote(midi: number, chord: Chord): boolean {
  const pc = pcOf(midi);
  const chordPcs = chord.tones.map(pitchClassIndex);
  if (chordPcs.includes(pc)) return true;
  if (!MELODY_SCALE.map(pitchClassIndex).includes(pc)) return false;
  return chordPcs.every((c) => {
    const d = Math.abs(c - pc);
    return Math.min(d, 12 - d) >= 2;
  });
}

function leadLadder(chord: Chord): number[] {
  const out: number[] = [];
  for (let m = LEAD_RANGE[0]; m <= LEAD_RANGE[1]; m++) if (isSafeLeadNote(m, chord)) out.push(m);
  return out;
}

/**
 * Lead hooks: contour shapes over 8 bars (one row per bar, one ladder step per hit; the 4th entry is
 * for upgraded patterns). The notes come from the current chord's safe ladder, so the same shape
 * fits every progression.
 */
export const LEAD_MOTIFS: readonly (readonly (readonly number[])[])[] = [
  // Call
  [[5, 4, 3, 2], [2, 3, 4, 5], [5, 6, 5, 3], [4, 3, 2, 1], [5, 4, 3, 2], [2, 3, 4, 6], [6, 5, 4, 3], [3, 2, 1, 0]],
  // Rise
  [[2, 3, 5, 4], [3, 4, 6, 5], [4, 5, 7, 6], [5, 4, 3, 2], [2, 3, 5, 4], [3, 5, 6, 7], [7, 6, 5, 4], [4, 3, 2, 0]],
  // Bounce
  [[3, 5, 3, 6], [3, 5, 3, 4], [2, 4, 2, 5], [2, 4, 3, 1], [3, 5, 3, 6], [4, 6, 4, 7], [5, 4, 3, 4], [3, 2, 1, 2]],
  // Fall
  [[7, 5, 4, 3], [6, 4, 3, 2], [5, 3, 2, 1], [4, 3, 2, 3], [7, 5, 4, 3], [6, 5, 4, 5], [5, 4, 2, 1], [2, 1, 0, 1]],
  // Pedal
  [[4, 4, 5, 4], [4, 4, 3, 2], [4, 4, 6, 5], [4, 3, 2, 3], [4, 4, 5, 4], [4, 4, 6, 7], [5, 5, 4, 3], [3, 3, 2, 0]],
];

export function leadMotifForWave(wave: number): number {
  return (Math.max(wave, 1) - 1) % LEAD_MOTIFS.length;
}

/** Lead note for the n-th hit of a bar of the 8-bar phrase, from a hook shape over the current chord. */
export function leadNote(chord: Chord, phraseBar: number, hitIndex: number, motif = 0): number {
  const ladder = leadLadder(chord);
  const shape = LEAD_MOTIFS[((motif % LEAD_MOTIFS.length) + LEAD_MOTIFS.length) % LEAD_MOTIFS.length]!;
  const row = shape[((phraseBar % shape.length) + shape.length) % shape.length]!;
  const step = row[Math.min(Math.max(hitIndex, 0), row.length - 1)]!;
  return ladder[Math.min(step, ladder.length - 1)]!;
}

export function isInKey(midi: number): boolean {
  return KEY_SCALE.map(pitchClassIndex).includes(pcOf(midi));
}

export function isInMelodyScale(midi: number): boolean {
  return MELODY_SCALE.map(pitchClassIndex).includes(pcOf(midi));
}
