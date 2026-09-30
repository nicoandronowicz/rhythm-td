/**
 * Every tunable number in the game lives here.
 *
 * The tuning panel (T key) edits these live. Defaults below are what ships;
 * panel edits are saved in the browser and can be copied as JSON.
 */

export const DEFAULT_TUNING = {
  transport: {
    bpm: 124,
    /** 0 = straight, 1 = hard shuffle. */
    swing: 0,
    /** Which notes swing: 16 = every second 16th, 8 = every second 8th. */
    swingGrid: 16,
  },
  mix: {
    master: -7,
    kick: -3,
    clap: 2,
    hats: -7,
    bass: -5,
    /** Shared short room reverb, return level. */
    room: -10,
  },
  velocity: {
    normal: 0.82,
    accent: 1,
    ghost: 0.35,
    /** Random velocity wobble on hats, 0..1. Keeps them from sounding like a machine gun. */
    hatJitter: 0.12,
  },
  kick: {
    /** How far above the tuned note the pitch sweep starts, in octaves. */
    sweep: 2.8,
    /** Pitch sweep time, seconds. */
    sweepTime: 0.055,
    /** Body length, seconds. */
    decay: 0.4,
    /** Saturation, 0..1. Adds harmonics so the kick reads on laptop speakers. */
    drive: 0.6,
    /** Click transient level, dB. */
    click: -12,
  },
  clap: {
    /** Band-pass centre, Hz. */
    tone: 1250,
    /** Gap between the 3 hand hits, seconds. */
    spread: 0.009,
    /** Tail length, seconds. */
    tail: 0.2,
    /** Send into the room reverb, dB. */
    roomSend: -8,
  },
  hats: {
    /** High-pass cutoff, Hz. */
    tone: 7200,
    /** Length, seconds. */
    decay: 0.09,
    /** Metallic ring layered under the noise, dB relative. */
    metal: -14,
    /** Stereo position, -1 left .. 1 right. */
    pan: 0.18,
  },
  bass: {
    /** Filter floor, Hz. */
    cutoff: 450,
    /** Filter envelope amount, octaves above the floor. */
    envelope: 2,
    /** Filter resonance. */
    resonance: 3,
    /** Filter envelope decay, seconds. */
    pluck: 0.16,
    /** Note length, in 16ths. */
    length: 1.6,
    /** Saturation on the mid layer, 0..1. */
    drive: 0.7,
    /** Mid layer (octave up, what laptops hear), dB. */
    mid: 2,
    /** Low cut on the mid layer, Hz. Higher = leaner mid layer, more room for the sub. */
    midLowCut: 160,
    /** Sub sine on the root, dB. */
    sub: -3,
  },
};

export type Tuning = typeof DEFAULT_TUNING;
export type TuningSection = keyof Tuning;
export type TuningPath = {
  [S in TuningSection]: `${S}.${keyof Tuning[S] & string}`;
}[TuningSection];

export interface TuningField {
  path: TuningPath;
  label: string;
  min: number;
  max: number;
  step: number;
  unit?: string;
  group: string;
  /** Collapsed by default in the panel. */
  advanced?: boolean;
  /** Discrete choices instead of a slider. */
  options?: { value: number; label: string }[];
}

export const TUNING_FIELDS: readonly TuningField[] = [
  { path: 'transport.bpm', label: 'BPM', min: 90, max: 150, step: 1, group: 'Groove' },
  { path: 'transport.swing', label: 'Swing', min: 0, max: 1, step: 0.01, unit: '%', group: 'Groove' },
  {
    path: 'transport.swingGrid',
    label: 'Swing on',
    min: 8,
    max: 16,
    step: 8,
    group: 'Groove',
    options: [
      { value: 16, label: '16ths' },
      { value: 8, label: '8ths' },
    ],
  },

  { path: 'mix.master', label: 'Master', min: -40, max: 6, step: 0.5, unit: 'dB', group: 'Volume' },
  { path: 'mix.kick', label: 'Kick', min: -40, max: 6, step: 0.5, unit: 'dB', group: 'Volume' },
  { path: 'mix.clap', label: 'Clap', min: -40, max: 6, step: 0.5, unit: 'dB', group: 'Volume' },
  { path: 'mix.hats', label: 'Hats', min: -40, max: 6, step: 0.5, unit: 'dB', group: 'Volume' },
  { path: 'mix.bass', label: 'Bass', min: -40, max: 6, step: 0.5, unit: 'dB', group: 'Volume' },
  { path: 'mix.room', label: 'Room reverb', min: -40, max: 0, step: 0.5, unit: 'dB', group: 'Volume' },

  { path: 'velocity.normal', label: 'Normal hit', min: 0, max: 1, step: 0.01, group: 'Dynamics', advanced: true },
  { path: 'velocity.accent', label: 'Accent hit', min: 0, max: 1, step: 0.01, group: 'Dynamics', advanced: true },
  { path: 'velocity.ghost', label: 'Ghost hit', min: 0, max: 1, step: 0.01, group: 'Dynamics', advanced: true },
  { path: 'velocity.hatJitter', label: 'Hat wobble', min: 0, max: 0.5, step: 0.01, group: 'Dynamics', advanced: true },

  { path: 'kick.sweep', label: 'Pitch sweep', min: 0.5, max: 5, step: 0.1, unit: 'oct', group: 'Kick', advanced: true },
  { path: 'kick.sweepTime', label: 'Sweep time', min: 0.005, max: 0.15, step: 0.001, unit: 's', group: 'Kick', advanced: true },
  { path: 'kick.decay', label: 'Decay', min: 0.1, max: 1.2, step: 0.01, unit: 's', group: 'Kick', advanced: true },
  { path: 'kick.drive', label: 'Drive', min: 0, max: 1, step: 0.01, group: 'Kick', advanced: true },
  { path: 'kick.click', label: 'Click', min: -40, max: 0, step: 0.5, unit: 'dB', group: 'Kick', advanced: true },

  { path: 'clap.tone', label: 'Tone', min: 500, max: 3000, step: 10, unit: 'Hz', group: 'Clap', advanced: true },
  { path: 'clap.spread', label: 'Spread', min: 0.003, max: 0.025, step: 0.001, unit: 's', group: 'Clap', advanced: true },
  { path: 'clap.tail', label: 'Tail', min: 0.05, max: 0.5, step: 0.01, unit: 's', group: 'Clap', advanced: true },
  { path: 'clap.roomSend', label: 'Room send', min: -40, max: 0, step: 0.5, unit: 'dB', group: 'Clap', advanced: true },

  { path: 'hats.tone', label: 'Tone', min: 3000, max: 12000, step: 50, unit: 'Hz', group: 'Hats', advanced: true },
  { path: 'hats.decay', label: 'Decay', min: 0.02, max: 0.4, step: 0.005, unit: 's', group: 'Hats', advanced: true },
  { path: 'hats.metal', label: 'Metal', min: -40, max: 0, step: 0.5, unit: 'dB', group: 'Hats', advanced: true },
  { path: 'hats.pan', label: 'Pan', min: -1, max: 1, step: 0.01, group: 'Hats', advanced: true },

  { path: 'bass.cutoff', label: 'Cutoff', min: 60, max: 1000, step: 5, unit: 'Hz', group: 'Bass', advanced: true },
  { path: 'bass.envelope', label: 'Env amount', min: 0, max: 6, step: 0.1, unit: 'oct', group: 'Bass', advanced: true },
  { path: 'bass.resonance', label: 'Resonance', min: 0.5, max: 12, step: 0.1, group: 'Bass', advanced: true },
  { path: 'bass.pluck', label: 'Pluck', min: 0.03, max: 0.6, step: 0.01, unit: 's', group: 'Bass', advanced: true },
  { path: 'bass.length', label: 'Length', min: 0.5, max: 4, step: 0.1, unit: '16ths', group: 'Bass', advanced: true },
  { path: 'bass.drive', label: 'Drive', min: 0, max: 1, step: 0.01, group: 'Bass', advanced: true },
  { path: 'bass.midLowCut', label: 'Mid low cut', min: 40, max: 400, step: 5, unit: 'Hz', group: 'Bass', advanced: true },
  { path: 'bass.mid', label: 'Mid layer', min: -40, max: 6, step: 0.5, unit: 'dB', group: 'Bass', advanced: true },
  { path: 'bass.sub', label: 'Sub', min: -40, max: 6, step: 0.5, unit: 'dB', group: 'Bass', advanced: true },
];
