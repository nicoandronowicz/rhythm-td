/**
 * Chapter 1, "Afterhours": progressive house, F minor, 122 BPM.
 *
 * Long-form on purpose: chords move every 4 bars (2 in the driving section), every section has an
 * 8-bar hook and an 8-bar answer, the arp runs a 5-note cycle against straight 8ths (it lines up again
 * only every 5 bars), its filter opens over each 16-bar wave, and section 4 lifts the key a whole step.
 */

import { rhythm } from '../rhythm';
import type { SongDef } from '../song';

const R = (...bars: string[]) => rhythm(16, ...bars);

const S1_MELODY =
  'r:2 5:2 r:1 5:1 4:2 3:6 r:2 | r:4 3:2 4:2 5:3 7:5 | r:2 5:2 r:1 5:1 4:2 3:4 2:2 r:2 | 1:8 r:8 | ' +
  'r:2 5:2 r:1 5:1 6:2 5:6 r:2 | r:4 3:2 5:2 8:3 7:5 | r:2 7:2 r:1 7:1 6:2 5:4 3:2 r:2 | 5:12 r:4';
const S1_ANSWER =
  'r:2 7:2 r:1 7:1 5:2 3:6 r:2 | r:4 5:2 7:2 9:3 8:5 | r:2 7:2 r:1 7:1 5:2 3:4 5:2 r:2 | 7:12 r:4 | ' +
  'r:2 9:2 r:1 9:1 8:2 7:6 r:2 | r:4 7:2 9:2 11:3 12:5 | r:2 12:2 r:1 12:1 11:2 9:4 7:2 r:2 | r:2 4:2 ~5:12';

export const AFTERHOURS: SongDef = {
  id: 'afterhours',
  title: 'Afterhours',
  style: 'Progressive house · F minor · 122',
  bpm: 122,
  stepsPerBar: 16,
  beats: [4, 4, 4, 4],
  swing: 0.06,
  key: 'F minor',
  intro: { chords: [['Fm9', 8], ['Dbmaj9', 8]] },
  sections: [
    { chords: [['Fm9', 4], ['Dbmaj9', 4], ['Abmaj7/C', 4], ['Eb6', 4]], melody: S1_MELODY, answer: S1_ANSWER },
    {
      chords: [['Dbmaj7', 2], ['Eb', 2], ['Fm9', 4], ['Dbmaj7', 2], ['Eb', 2], ['Cm7', 2], ['Fm9', 2]],
      melody:
        '8:3 6:3 5:2 6:3 8:3 r:2 | 10:4 8:4 6:8 | 9:3 7:3 5:2 4:3 5:3 r:2 | 7:4 9:4 11:8 | ' +
        '12:3 10:3 8:2 7:4 5:4 | 8:16 | r:8 5:2 7:2 8:4 | 9:4 8:4 7:4 5:4',
      answer:
        '8:3 6:3 5:2 6:3 10:3 r:2 | 12:4 10:4 8:8 | 9:3 7:3 9:2 11:4 r:4 | 12:4 11:4 9:8 | ' +
        '9:3 7:3 5:2 4:4 r:4 | 5:8 7:8 | 8:12 r:4 | r:16',
    },
    {
      chords: [['Bbm9', 4], ['Fm9/Ab', 4], ['Dbmaj9', 4], ['C7sus4', 2], ['C7b9', 2]],
      melody:
        'r:4 4:4 6:4 8:4 | 10:6 8:2 6:8 | r:4 6:4 8:4 10:4 | 12:6 10:2 8:4 6:4 | ' +
        'r:4 5:4 7:4 8:4 | 9:6 8:2 5:8 | r:4 7:4 8:4 10:4 | 9:12 r:4',
      answer:
        "r:4 6:4 8:4 10:4 | 12:6 10:2 8:8 | r:4 10:4 12:4 14:4 | 12:12 r:4 | " +
        "9:4 8:4 12:4 11:4 | 12:16 | 12:4 #7':4 9:4 11:4 | 13:8 #7':8",
    },
    // The lift: section 1 a whole step up (G minor).
    { chords: [['Fm9', 4], ['Dbmaj9', 4], ['Abmaj7/C', 4], ['Eb6', 4]], melody: S1_MELODY, answer: S1_ANSWER, shift: 2 },
    {
      chords: [['Dbmaj9', 4], ['Abmaj7', 4], ['Ebsus4', 2], ['Eb', 2], ['Fm9', 4]],
      melody: '8:12 7:4 | 6:8 5:8 | 8:6 9:2 10:8 | 12:16 | 5:12 7:4 | 9:8 8:8 | 7:6 8:2 10:8 | 10:16',
      answer: '11:8 10:8 | 11:16 | 9:8 7:8 | 9:16 | 8:12 7:4 | 5:16 | 3:8 4:8 | 5:16',
    },
  ],

  // Drop-out order: congas first, kick last.
  core: [
    {
      id: 'conga',
      name: 'Congas',
      color: 0xffb37a,
      perk: { tier: 2 },
      patch: 'congas',
      notes: { kind: 'drum' },
      rhythm: R('..o..s.o ..l. .h.g', '..o..s.o ..l. o.s.'),
      symbols: { o: { art: 'open', vel: 0.62 }, s: { art: 'slap', vel: 0.7 }, l: { art: 'low', vel: 0.66 }, h: { art: 'high', vel: 0.58 }, g: { art: 'ghost', vel: 0.4 } },
      pan: -0.32,
      loose: 0.06,
    },
    {
      id: 'shaker',
      name: 'Shaker',
      color: 0xd7ffb0,
      perk: { tier: 1 },
      patch: 'shaker',
      notes: { kind: 'drum' },
      rhythm: R('dxXx dxXx dxXx dxXx'),
      symbols: { X: { art: 'slap', vel: 0.6 }, x: { art: 'up', vel: 0.36 }, d: { art: 'down', vel: 0.3 } },
      pan: 0.36,
      loose: 0.08,
    },
    {
      id: 'openhat',
      name: 'Open hat',
      color: 0xc8f6ff,
      perk: { tier: 3 },
      patch: 'openhat',
      notes: { kind: 'drum' },
      rhythm: R('..x. ..x. ..x. ..x.'),
      fill: { every: 8, rhythm: R('..x. ..x. ..x. .xX.') },
      pan: 0.18,
      late: 0.04,
    },
    {
      id: 'hats',
      name: 'Hats',
      color: 0x9fe8ff,
      patch: 'hats',
      notes: { kind: 'drum' },
      rhythm: R('g.X. g.X. g.X. g.X.'),
      fill: { every: 8, rhythm: R('g.X. g.X. g.X. gXgX') },
      deco: [{ from: 0.62, rhythm: R('.g.g .g.g .g.g .g.g'), vel: 0.5 }],
      lift: R('gXgX gXgX gXgX gXgX'),
      symbols: { X: { art: 'closed', vel: 0.75 }, g: { art: 'soft', vel: 0.4 } },
      pan: 0.26,
      late: 0.03,
      loose: 0.04,
    },
    {
      id: 'clap',
      name: 'Clap',
      color: 0xfff0b0,
      patch: 'clap',
      notes: { kind: 'drum' },
      rhythm: R('.... X... .... X...'),
      fill: { every: 8, rhythm: R('.... X... .... X.gX') },
      symbols: { X: { art: 'group', vel: 0.95 }, g: { art: 'solo', vel: 0.45 } },
      late: 0.08,
    },
    {
      id: 'kick',
      name: 'Kick',
      color: 0xffffff,
      patch: 'kick',
      notes: { kind: 'drum' },
      rhythm: R('X... X... X... X...'),
      // Turnaround: the kick drops the last beat of every 8-bar phrase.
      fill: { every: 8, rhythm: R('X... X... X... ....') },
      pump: true,
      breakdown: 'drop',
    },
  ],

  pad: {
    name: 'Pad',
    patch: 'pad',
    notes: { kind: 'pad', voicing: { style: 'open', low: 41, high: 79 } },
    sweep: { bars: 16, shape: 'wave', min: 0.1, max: 0.8 },
  },

  parts: {
    bass: {
      name: 'Rolling bass',
      patch: 'bass',
      notes: { kind: 'bass', low: 29 },
      rhythm: R('..R. .RR. ..R. .RO.', '..R. .RR. ..R. .5A.'),
      upgraded: R('..RR .RR. ..RR .RO.', '..RR .RR. ..RR .5A.'),
      variant: R('R.RR .R.R ..RR .RO.', 'R.RR .R.R ..R. R.A.'),
      symbols: { R: { vel: 0.82 }, O: { vel: 0.7 }, '5': { vel: 0.72 }, A: { vel: 0.72 } },
      sweep: { bars: 16, shape: 'rise', min: 0.15, max: 0.75 },
    },
    chords: {
      name: 'Stabs',
      patch: 'stab',
      notes: { kind: 'chord', voicing: { style: 'rootless', low: 55, high: 80 } },
      rhythm: R('...x .... ..x. .x..', '...x .... ..x. ....'),
      upgraded: R('...x ..x. ..x. .x..', '...x ..x. ..x. ...x'),
      variant: R('..x. ..x. ..x. ..x.'),
      sweep: { bars: 16, shape: 'wave', min: 0.15, max: 0.95 },
    },
    arp: {
      name: 'Pluck arp',
      patch: 'pluck',
      notes: { kind: 'arp', low: 65, count: 7, order: [0, 2, 4, 1, 3], orders: [[0, 2, 4, 1, 3], [0, 1, 2, 3, 4, 5, 4, 2], [4, 2, 0, 3, 1, 2], [0, 3, 6, 2, 5, 1, 4]] },
      rhythm: R('x.x. x.x. x.x. x.x.'),
      upgraded: R('xxxx xxxx xxxx xxxx'),
      variant: R('x.xx x.xx x.xx x.xx'),
      sweep: { bars: 16, shape: 'rise', min: 0.05, max: 1 },
    },
    lead: {
      name: 'Hook',
      patch: 'lead',
      notes: { kind: 'melody', base: 60, snap: true },
    },
  },

  patches: {
    kick: { type: 'drum', kind: 'kick', pitch: 43.65, sweep: 6.5, decay: 0.42, click: 0.45, drive: 0.55, gain: 0.95 },
    clap: { type: 'sampler', bank: 'clap', gain: 0.9, ring: true, highpass: 220 },
    hats: { type: 'sampler', bank: 'hihat', gain: 0.85, ring: true, highpass: 600, drift: 20 },
    openhat: { type: 'sampler', bank: 'hihat', gain: 0.7, ring: true, highpass: 500 },
    shaker: { type: 'sampler', bank: 'shaker', gain: 0.75, ring: true, highpass: 300 },
    congas: { type: 'sampler', bank: 'conga', gain: 0.85, ring: true, drift: 8 },
    pad: {
      type: 'synth',
      osc: [
        { wave: 'sawtooth', voices: 3, detune: 22, spread: 0.95 },
        { wave: 'warm', voices: 1, octave: -1, level: 0.6 },
      ],
      filter: { cutoff: 900, mod: 1.3, q: 0.5, keytrack: 0.2 },
      amp: { a: 1.4, d: 1, s: 0.9, r: 1.8 },
      gain: 0.32,
    },
    bass: {
      type: 'synth',
      osc: [{ wave: 'sawtooth', voices: 2, detune: 9, spread: 0.15 }],
      sub: 0.55,
      filter: { cutoff: 260, mod: 1.2, q: 2.2, env: 1.8, keytrack: 0.5, vel: 0.6 },
      fenv: { a: 0.002, d: 0.16, s: 0.15, r: 0.08 },
      amp: { a: 0.002, d: 0.22, s: 0.75, r: 0.05 },
      drive: 0.3,
      gain: 0.6,
    },
    stab: {
      type: 'synth',
      osc: [
        { wave: 'sawtooth', voices: 3, detune: 24, spread: 0.85 },
        { wave: 'square', voices: 1, octave: 1, level: 0.25 },
      ],
      filter: { cutoff: 700, mod: 1.6, q: 1.2, env: 2.4, keytrack: 0.3 },
      fenv: { a: 0.003, d: 0.3, s: 0.12, r: 0.25 },
      amp: { a: 0.003, d: 0.55, s: 0.25, r: 0.4 },
      gain: 0.5,
    },
    pluck: {
      type: 'synth',
      osc: [
        { wave: 'pulse', voices: 1 },
        { wave: 'sawtooth', voices: 1, level: 0.7 },
      ],
      filter: { cutoff: 500, mod: 2.6, q: 3.2, env: 2.8, keytrack: 0.4 },
      fenv: { a: 0.001, d: 0.14, s: 0, r: 0.1 },
      amp: { a: 0.001, d: 0.26, s: 0, r: 0.18 },
      gain: 0.42,
    },
    lead: {
      type: 'synth',
      osc: [
        { wave: 'sawtooth', voices: 2, detune: 14, spread: 0.45 },
        { wave: 'triangle', voices: 1, octave: 1, level: 0.35 },
      ],
      filter: { cutoff: 1300, mod: 0.6, q: 1, env: 1.3, keytrack: 0.5 },
      fenv: { a: 0.01, d: 0.45, s: 0.45, r: 0.3 },
      amp: { a: 0.012, d: 0.35, s: 0.78, r: 0.3 },
      vibrato: { rate: 5.2, cents: 14, delay: 0.25 },
      glide: 0.07,
      drive: 0.12,
      gain: 0.42,
    },
  },

  mix: {
    levels: { kick: -3, clap: -4, hats: -8, openhat: -11, shaker: -11, conga: -9, pad: -10, bass: -7, chords: -7, arp: -10, lead: -6 },
    sends: {
      clap: { room: -12, hall: -20 },
      hats: { room: -24 },
      openhat: { hall: -24 },
      conga: { room: -14, hall: -24 },
      shaker: { room: -20 },
      pad: { hall: -10 },
      chords: { hall: -7, delay: -16 },
      arp: { hall: -14, delay: -7 },
      lead: { hall: -9, delay: -13 },
    },
    delay: { steps: 3, feedback: 0.38 },
    hall: 3.6,
    pump: { depth: -7, release: 3 },
  },

  atmosphere: { noise: -66, crackle: -54, tape: 0.25 },
};
