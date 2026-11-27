/**
 * A song is everything a chapter sounds like, as data: tempo and meter, key, the harmony and melodies
 * of each section, the core's foundation layers (your health), what each tower plays, and the
 * instruments (patches) that play it. The composer (compose.ts) turns a song plus the game state into
 * notes; the audio engine only plays them.
 */

import type { Patch } from '../audio/patch';
import type { TowerType } from '../game/towers';
import type { VoicingOpts } from './harmony';
import type { Rhythm } from './rhythm';

export type SongId = 'afterhours' | 'nightbus' | 'sevenrivers' | 'lowtide';

/** How a part turns rhythm hits into pitches. */
export type NoteRule =
  /** Unpitched: the symbol picks the articulation (see `symbols`). */
  | { kind: 'drum' }
  /** The symbol is a bass role (R root, O octave, 5, 3, 7, L low fifth, A approach, N neighbour). */
  | { kind: 'bass'; low: number }
  /** A voiced chord on every hit, with voice leading from the previous one. */
  | { kind: 'chord'; voicing: VoicingOpts; /** Strum: seconds between notes, low to high. */ strum?: number }
  /**
   * An arpeggio: each hit plays the next entry of `order` (indices into the chord ladder). The order
   * runs across bar lines, so a 3- or 5-note order against 16ths is a polyrhythm.
   */
  | { kind: 'arp'; low: number; count: number; order: readonly number[]; /** New order each wave, cycling. */ orders?: readonly (readonly number[])[] }
  /** The section's composed melody (degrees in the key), from this base octave. */
  | { kind: 'melody'; base: number; /** Strong-beat notes that clash with the chord move to the nearest chord tone. */ snap?: boolean }
  /** A held chord on every hit, voiced wide. */
  | { kind: 'pad'; voicing: VoicingOpts };

export interface SymbolDef {
  /** Drum articulation (sample name) or synth variant. */
  art?: string;
  vel?: number;
}

export interface PartDef {
  /** What the player sees, e.g. "Rolling bass". */
  name: string;
  /** Patch id in the song's `patches`. */
  patch: string;
  notes: NoteRule;
  /** Main hits (not used by melody and pad parts, which follow the melody / the chord changes). */
  rhythm?: Rhythm;
  /** Tower parts: the upgraded part and the alternate part a reward unlocks. */
  upgraded?: Rhythm;
  variant?: Rhythm;
  /**
   * The last bar of every `every`-bar phrase plays this instead (fills, turnarounds).
   * Only when the track is in full flow (core active).
   */
  fill?: { every: number; rhythm: Rhythm };
  /** Extra decoration that only plays at or above an energy level. Never attacks. */
  deco?: readonly { from: number; rhythm: Rhythm; vel?: number }[];
  /** Pattern while the track is lifted. */
  lift?: Rhythm;
  /** Symbol meanings (articulation, velocity). Defaults: X accent, x normal, g ghost. */
  symbols?: Readonly<Record<string, SymbolDef>>;
  /**
   * Slow movement over the section: the `mod` value (0..1) each note carries, e.g. a filter opening
   * over 16 bars. 'rise' goes 0 -> 1 over `bars`; 'wave' swells up and down.
   */
  sweep?: { bars: number; shape: 'rise' | 'wave'; min: number; max: number };
  /** Micro-timing in fractions of a step (positive = late). Clap a touch behind, hats pushed. */
  late?: number;
  /** Random timing spread in fractions of a step. */
  loose?: number;
}

export interface CoreLayerDef extends PartDef {
  id: string;
  color: number;
  /** Bought with money (a perk) instead of always playing. The tier sets the price (tuning: core.perkNCost). */
  perk?: { tier: 1 | 2 | 3 };
  /** The whole mix ducks on its hits (sidechain). */
  pump?: boolean;
  /** Sits out breakdowns (the core resting or building): the kick drops so its return lands. */
  breakdown?: 'drop';
  /** Stereo position, -1..1. */
  pan?: number;
}

export interface SectionDef {
  /** Chord symbols with their length in bars; cycles over the section. */
  chords: readonly (readonly [string, number])[];
  /** Melody for the lead (see melody.ts), cycles. */
  melody?: string;
  /** Answer phrase the lead plays every other time through (variation). */
  answer?: string;
  /** Transpose the whole section, semitones (a key lift). */
  shift?: number;
}

export interface SongMix {
  /** Fader per layer id (core layer ids, 'pad', tower roles), dB. */
  levels: Readonly<Record<string, number>>;
  /** Sends per layer id, dB: room (short), hall (long), delay. */
  sends: Readonly<Record<string, { room?: number; hall?: number; delay?: number }>>;
  /** Delay time in 16ths (3 = dotted 8th) and feedback. */
  delay: { steps: number; feedback: number };
  /** Hall reverb length, seconds. */
  hall: number;
  /** Sidechain depth on pump hits, dB, and release in steps. */
  pump: { depth: number; release: number };
}

export interface SongDef {
  id: SongId;
  title: string;
  /** One line about the style, for the menu. */
  style: string;
  bpm: number;
  stepsPerBar: number;
  /** How the bar groups into beats, in steps (4/4: [4,4,4,4]; 7/8: [4,4,6]). Drives accents and visuals. */
  beats: readonly number[];
  swing: number;
  key: string;
  /** Wave n plays section (n-1) mod length; the intro plays `intro`. */
  sections: readonly SectionDef[];
  intro: SectionDef;
  /** Foundation, in drop-out order: the first entry drops first, the last one is the end of the run. */
  core: readonly CoreLayerDef[];
  pad: PartDef;
  parts: Readonly<Record<TowerType, PartDef>>;
  patches: Readonly<Record<string, Patch>>;
  mix: SongMix;
  /** Ambience under everything: noise colour/level, vinyl, and an optional texture bed. */
  atmosphere: { noise: number; crackle: number; tape: number };
}
