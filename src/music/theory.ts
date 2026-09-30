/**
 * The music module. The only place in the game allowed to pick a pitch.
 *
 * Everything here is pure (no Tone.js) so it can be unit tested.
 * Pitches are MIDI numbers; `midiToFreq` / `midiToName` convert for the audio layer.
 */

export type PitchClass = 'C' | 'C#' | 'D' | 'D#' | 'E' | 'F' | 'F#' | 'G' | 'G#' | 'A' | 'A#' | 'B';

const PITCH_CLASSES: readonly PitchClass[] = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export interface Chord {
  name: string;
  /** Pitch classes, root first. */
  tones: readonly PitchClass[];
}

export interface ProgressionStep {
  chord: Chord;
  bars: number;
}

export interface MusicSpec {
  key: PitchClass;
  scaleName: string;
  progression: readonly ProgressionStep[];
  /** Kill notes and future melodic material. */
  melodyScale: readonly PitchClass[];
  /** Lowest and highest MIDI note the bass root may sit on. Keeps voice leading tight. */
  bassRange: readonly [number, number];
  /** Pitch the kick is tuned to. */
  kickNote: number;
}

export const AM7: Chord = { name: 'Am7', tones: ['A', 'C', 'E', 'G'] };
export const FMAJ7: Chord = { name: 'Fmaj7', tones: ['F', 'A', 'C', 'E'] };

/** Prototype spec: A minor, Am7 / Fmaj7 every 2 bars, A minor pentatonic for melody. */
export const PROTOTYPE_SPEC: MusicSpec = {
  key: 'A',
  scaleName: 'A minor',
  progression: [
    { chord: AM7, bars: 2 },
    { chord: FMAJ7, bars: 2 },
  ],
  melodyScale: ['A', 'C', 'D', 'E', 'G'],
  // E1 (28) up to D#2 (39): A sits at A1 (33), F at F1 (29).
  bassRange: [28, 39],
  // A1, 55 Hz.
  kickNote: 33,
};

export function pitchClassIndex(pc: PitchClass): number {
  return PITCH_CLASSES.indexOf(pc);
}

export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function midiToName(midi: number): string {
  const pc = PITCH_CLASSES[((midi % 12) + 12) % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${pc}${octave}`;
}

function progressionLength(spec: MusicSpec): number {
  return spec.progression.reduce((sum, s) => sum + s.bars, 0);
}

/** Chord playing in a given bar (0-based, any bar number including negative). */
export function chordAtBar(bar: number, spec: MusicSpec = PROTOTYPE_SPEC): Chord {
  const len = progressionLength(spec);
  let pos = ((bar % len) + len) % len;
  for (const step of spec.progression) {
    if (pos < step.bars) return step.chord;
    pos -= step.bars;
  }
  // Unreachable with a non-empty progression.
  throw new Error('Empty progression');
}

/** Lowest MIDI note of pitch class `pc` at or above `min`. */
function placeInRange(pc: PitchClass, min: number): number {
  const idx = pitchClassIndex(pc);
  const offset = (((idx - min) % 12) + 12) % 12;
  return min + offset;
}

/** Bass root for a bar, placed inside the bass range. */
export function bassRootAtBar(bar: number, spec: MusicSpec = PROTOTYPE_SPEC): number {
  const root = chordAtBar(bar, spec).tones[0]!;
  return placeInRange(root, spec.bassRange[0]);
}

/** Bass note for a pattern step: the root, or the root an octave up. */
export function bassNote(bar: number, octaveUp: boolean, spec: MusicSpec = PROTOTYPE_SPEC): number {
  return bassRootAtBar(bar, spec) + (octaveUp ? 12 : 0);
}

/**
 * Pitches for the two bass layers on a hit: the sub on the root, and the mid layer an octave
 * above it (small speakers can't play the root, so the ear rebuilds it from the mid layer).
 */
export function bassLayerNotes(bar: number, octaveUp: boolean, spec: MusicSpec = PROTOTYPE_SPEC): { sub: number; mid: number } {
  const sub = bassNote(bar, octaveUp, spec);
  return { sub, mid: sub + 12 };
}

export function kickNote(spec: MusicSpec = PROTOTYPE_SPEC): number {
  return spec.kickNote;
}

/** Melody scale notes inside [min, max], ascending. Used for kill notes. */
export function melodyNotesInRange(min: number, max: number, spec: MusicSpec = PROTOTYPE_SPEC): number[] {
  const allowed = new Set(spec.melodyScale.map(pitchClassIndex));
  const out: number[] = [];
  for (let m = min; m <= max; m++) {
    if (allowed.has(((m % 12) + 12) % 12)) out.push(m);
  }
  return out;
}

export function isInMelodyScale(midi: number, spec: MusicSpec = PROTOTYPE_SPEC): boolean {
  return spec.melodyScale.map(pitchClassIndex).includes(((midi % 12) + 12) % 12);
}
