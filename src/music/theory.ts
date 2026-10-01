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
  /** Lowest note a chord stab's root may sit on. */
  voicingFloor: number;
  /** Lowest note the arp starts from. */
  arpFloor: number;
  /**
   * Lead hook: one row per bar of a 4-bar phrase, one MIDI note per hit in the bar.
   * Curated from the melody scale; extra entries are used by upgraded patterns.
   */
  leadMotif: readonly (readonly number[])[];
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
  // F3: Am7 voices as A3 C4 E4 G4, Fmaj7 as F3 A3 C4 E4 (common tones stay put).
  voicingFloor: 53,
  // E4: the arp climbs from A4 on Am7 and F4 on Fmaj7.
  arpFloor: 64,
  leadMotif: [
    [76, 74, 72, 69], // Am7: E5 D5 C5 (A4)
    [69, 72, 74, 76], // Am7: A4 C5 D5 (E5)
    [76, 79, 76, 72], // Fmaj7: E5 G5 E5 (C5)
    [74, 72, 69, 67], // Fmaj7: D5 C5 A4 (G4)
  ],
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

/** Chord tones stacked upward from the root, root placed at or above `floor`. */
function stackChord(bar: number, floor: number, spec: MusicSpec): number[] {
  const tones = chordAtBar(bar, spec).tones;
  const out: number[] = [];
  let prev = placeInRange(tones[0]!, floor);
  out.push(prev);
  for (const pc of tones.slice(1)) {
    const n = placeInRange(pc, prev + 1);
    out.push(n);
    prev = n;
  }
  return out;
}

/** Notes of a chord stab for a bar, ascending. */
export function chordVoicing(bar: number, spec: MusicSpec = PROTOTYPE_SPEC): number[] {
  return stackChord(bar, spec.voicingFloor, spec);
}

/** Arp note for the n-th hit of a bar: chord tones going up over two octaves, then round again. */
export function arpNote(bar: number, hitIndex: number, spec: MusicSpec = PROTOTYPE_SPEC): number {
  const tones = stackChord(bar, spec.arpFloor, spec);
  const cycle = tones.length * 2;
  const i = ((hitIndex % cycle) + cycle) % cycle;
  return tones[i % tones.length]! + 12 * Math.floor(i / tones.length);
}

/** Lead note for the n-th hit of a bar, from the curated hook. */
export function leadNote(bar: number, hitIndex: number, spec: MusicSpec = PROTOTYPE_SPEC): number {
  const rows = spec.leadMotif.length;
  const row = spec.leadMotif[((bar % rows) + rows) % rows]!;
  return row[Math.min(Math.max(hitIndex, 0), row.length - 1)]!;
}

/** Melody scale notes inside [min, max], ascending. */
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
