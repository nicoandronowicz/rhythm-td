/**
 * Instrument designs as data. A song maps patch ids to these; the engine builds one voice per patch.
 */

export interface Env {
  /** Seconds. */
  a: number;
  d: number;
  /** Sustain level 0..1. */
  s: number;
  r: number;
}

export interface SamplerPatch {
  type: 'sampler';
  /** Sample group in public/samples/manifest.json. */
  bank: string;
  gain?: number;
  /** Fade in / fade out, seconds. Notes are cut at their length plus release. */
  attack?: number;
  release?: number;
  /** Ring out the whole sample instead of stopping at the note length (mallets, piano, drums). */
  ring?: boolean;
  /** Low-pass: cutoff (Hz) at mod 0 and at mod 1; velocity opens it further. */
  cutoff?: readonly [number, number];
  /** High-pass, Hz. */
  highpass?: number;
  /** Random detune per hit, cents (round-robin feel). */
  drift?: number;
  /** Stereo: pan alternates +-spread per note (chords, strums). */
  spread?: number;
  /** Semitones. */
  transpose?: number;
  /** Play the sample reversed (swells). */
  reverse?: boolean;
}

export type Wave = 'sine' | 'triangle' | 'sawtooth' | 'square' | 'pulse' | 'organ' | 'warm';

export interface OscDef {
  wave: Wave;
  /** Unison voices. */
  voices?: number;
  /** Total detune spread across the unison, cents. */
  detune?: number;
  /** Stereo width of the unison, 0..1. */
  spread?: number;
  /** Octave shift. */
  octave?: number;
  /** Fine shift, semitones (e.g. +7 for a fifth layer). */
  semi?: number;
  level?: number;
}

export interface SynthPatch {
  type: 'synth';
  osc: readonly OscDef[];
  /** Sine sub an octave down, level. */
  sub?: number;
  /** White noise layer, level (breath, air). */
  noise?: number;
  filter: {
    type?: 'lowpass' | 'bandpass' | 'highpass';
    /** Base cutoff, Hz (at mod 0). */
    cutoff: number;
    /** Octaves the cutoff rises at mod 1 (slow sweeps). */
    mod?: number;
    q?: number;
    /** Envelope amount, octaves above the base. */
    env?: number;
    /** How much the cutoff follows the note (1 = fully). */
    keytrack?: number;
    /** Velocity -> cutoff, octaves. */
    vel?: number;
  };
  amp: Env;
  fenv?: Env;
  /** Pitch drop at the start, semitones and seconds (plucks, toms). */
  pitchEnv?: { semis: number; time: number };
  /** Portamento on slides, seconds. */
  glide?: number;
  vibrato?: { rate: number; cents: number; delay: number };
  /** Soft saturation after the filter, 0..1. */
  drive?: number;
  gain?: number;
}

export interface FmPatch {
  type: 'fm';
  /** Modulator frequency ratio, and an optional second modulator (bells). */
  ratio: number;
  ratio2?: number;
  /** Modulation index at the start, its sustain fraction, and its decay (seconds). */
  index: number;
  indexSustain?: number;
  indexDecay: number;
  index2?: number;
  amp: Env;
  /** Tremolo (Rhodes/organ wobble). */
  tremolo?: { rate: number; depth: number };
  /** Detuned second carrier for width, cents. */
  chorus?: number;
  cutoff?: number;
  gain?: number;
}

export type DrumKind = 'kick' | 'clap' | 'hat' | 'snare' | 'tom' | 'rim' | 'noiseHit';

export interface DrumPatch {
  type: 'drum';
  kind: DrumKind;
  /** Kick/tom: body pitch (Hz) and how far it sweeps down from (multiplier). */
  pitch?: number;
  sweep?: number;
  /** Seconds. */
  decay?: number;
  /** Click/transient level. */
  click?: number;
  /** Saturation 0..1. */
  drive?: number;
  /** Noise colour for hats/claps/snares: band centre Hz. */
  tone?: number;
  gain?: number;
  /** Articulations change decay: name -> multiplier (e.g. open hat). */
  arts?: Readonly<Record<string, number>>;
}

export interface FormantPatch {
  type: 'formant';
  /** Vowels cycled per hit ('a', 'e', 'i', 'o', 'u'). */
  vowels: readonly string[];
  amp: Env;
  glide?: number;
  vibrato?: { rate: number; cents: number; delay: number };
  /** Breath noise level. */
  breath?: number;
  gain?: number;
}

export type Patch = SamplerPatch | SynthPatch | FmPatch | DrumPatch | FormantPatch;
