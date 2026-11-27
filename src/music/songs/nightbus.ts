/**
 * Chapter 2, "Night Bus": UK garage / 2-step, C minor, 132 BPM, heavy shuffle.
 *
 * No four-on-the-floor: the kick skips beats 2 and 4 and lands on the "and" of 3; a real snare holds
 * the backbeat with ghost notes. Electric-piano stabs, vocal chops in a 3-3-2 rhythm, a sliding sub,
 * and a bell melody. The foundation (last to drop) is the 2-step kick.
 */

import { rhythm } from '../rhythm';
import type { SongDef } from '../song';

const R = (...bars: string[]) => rhythm(16, ...bars);

const S1_MELODY =
  'r:4 5:2 r:1 5:1 r:2 3:2 5:2 7:2 | r:4 9:3 8:3 7:2 r:4 | 8:2 r:1 8:1 r:2 6:2 r:2 8:3 10:3 | r:4 12:3 10:3 8:2 r:4 | ' +
  '11:2 r:1 11:1 r:2 8:2 r:2 10:3 11:3 | r:4 12:3 11:3 10:2 r:4 | 12:3 11:3 9:2 8:8 | #7:4 9:4 11:4 12:4';
const S1_ANSWER =
  'r:4 5:2 r:1 5:1 r:2 3:2 5:2 7:2 | r:4 9:3 10:3 9:2 r:4 | 8:2 r:1 8:1 r:2 6:2 r:2 8:3 10:3 | r:4 12:6 13:6 | ' +
  '13:2 r:1 13:1 r:2 12:2 r:2 11:3 10:3 | 11:8 r:8 | 9:4 11:4 12:8 | #7:8 r:8';
const S1_CHORDS: readonly (readonly [string, number])[] = [['Cm9', 2], ['Abmaj7', 2], ['Fm9', 2], ['G7sus4', 1], ['G7b9', 1]];

export const NIGHTBUS: SongDef = {
  id: 'nightbus',
  title: 'Night Bus',
  style: 'UK garage, 2-step · C minor · 132',
  bpm: 132,
  stepsPerBar: 16,
  beats: [4, 4, 4, 4],
  swing: 0.34,
  key: 'C minor',
  intro: { chords: [['Cm9', 4], ['Abmaj7', 4]] },
  sections: [
    { chords: S1_CHORDS, melody: S1_MELODY, answer: S1_ANSWER },
    {
      chords: [['Ebmaj9', 2], ['Dm7b5', 2], ['Cm9', 4]],
      melody:
        'r:2 10:2 r:2 9:2 r:2 7:2 5:4 | 7:3 9:3 10:6 r:4 | r:2 11:2 r:2 10:2 r:2 8:2 6:4 | 8:3 9:3 11:6 r:4 | ' +
        'r:2 12:2 r:2 10:2 r:2 9:2 8:4 | 7:8 5:8 | r:2 3:2 5:2 7:2 9:4 8:4 | 8:16',
      answer:
        'r:2 10:2 r:2 9:2 r:2 7:2 5:4 | 7:3 9:3 12:6 r:4 | r:2 11:2 r:2 10:2 r:2 8:2 6:4 | 8:3 11:3 13:6 r:4 | ' +
        '12:3 10:3 9:2 8:8 | r:4 9:4 10:4 12:4 | 12:3 10:3 9:2 7:8 | 8:12 r:4',
    },
    {
      chords: [['Abmaj9', 2], ['Bb7sus4', 2], ['Gm7', 2], ['Cm9', 2]],
      melody:
        '8:3 10:3 12:2 r:2 10:2 8:4 | 7:8 r:8 | 7:3 10:3 11:2 r:2 10:2 7:4 | 6:8 r:8 | ' +
        '5:3 7:3 9:2 r:2 11:2 9:4 | 7:8 r:8 | 5:3 7:3 9:2 r:2 10:2 9:4 | 8:16',
      answer:
        '12:3 10:3 8:2 r:2 10:2 12:4 | 14:8 r:8 | 11:3 10:3 7:2 r:2 10:2 11:4 | 13:8 r:8 | ' +
        '12:3 11:3 9:2 r:2 7:2 5:4 | 9:8 r:8 | 10:3 9:3 7:2 r:2 5:2 3:4 | 8:16',
    },
    {
      chords: [['Fm9', 2], ['Bb9', 2], ['Ebmaj9', 2], ['Abmaj7', 1], ['G7b9', 1]],
      melody:
        'r:2 11:2 r:1 11:1 10:2 r:2 8:2 6:4 | 8:6 9:2 10:8 | r:2 11:2 r:1 11:1 10:2 r:2 9:2 7:4 | 9:6 11:2 13:8 | ' +
        'r:2 12:2 r:1 12:1 10:2 r:2 9:2 7:4 | 10:16 | 8:4 10:4 12:4 13:4 | 12:4 11:4 9:4 #7:4',
      answer:
        'r:2 11:2 r:1 11:1 10:2 r:2 8:2 6:4 | 8:6 9:2 10:8 | r:2 11:2 r:1 11:1 13:2 r:2 12:2 10:4 | 9:16 | ' +
        '12:3 10:3 9:2 7:8 | 5:8 r:8 | 6:3 8:3 10:2 12:8 | #7:8 9:8',
    },
    // Up a whole step for the climax.
    { chords: S1_CHORDS, melody: S1_MELODY, answer: S1_ANSWER, shift: 2 },
  ],

  core: [
    {
      id: 'tamb',
      name: 'Tambourine',
      color: 0xffe08a,
      perk: { tier: 1 },
      patch: 'tamb',
      notes: { kind: 'drum' },
      rhythm: R('..x. ..x. ..x. ..xs'),
      symbols: { x: { art: 'hit', vel: 0.5 }, s: { art: 'shake', vel: 0.35 } },
      pan: 0.42,
      loose: 0.05,
    },
    {
      id: 'rim',
      name: 'Log drum',
      color: 0xffb37a,
      perk: { tier: 2 },
      patch: 'logdrum',
      notes: { kind: 'drum' },
      rhythm: R('...a ..b. .... a...', '...a ..b. ..c. ...b'),
      symbols: { a: { art: 'd1', vel: 0.62 }, b: { art: 'd2', vel: 0.55 }, c: { art: 'd3', vel: 0.5 } },
      pan: -0.34,
      loose: 0.04,
    },
    {
      id: 'openhat',
      name: 'Open hat',
      color: 0xc8f6ff,
      perk: { tier: 3 },
      patch: 'hihat',
      notes: { kind: 'drum' },
      rhythm: R('..o. .... ..o. ....'),
      symbols: { o: { art: 'open', vel: 0.55 } },
      pan: 0.2,
    },
    {
      id: 'hats',
      name: 'Hats',
      color: 0x9fe8ff,
      patch: 'hihat',
      notes: { kind: 'drum' },
      rhythm: R('s.x. s.xs s.x. s.x.'),
      deco: [{ from: 0.62, rhythm: R('.t.t .t.. .t.t .t.t'), vel: 0.7 }],
      lift: R('xsxs xsxs xsxs xsxs'),
      symbols: { x: { art: 'closed', vel: 0.72 }, s: { art: 'soft', vel: 0.42 }, t: { art: 'tight', vel: 0.5 } },
      pan: 0.24,
      loose: 0.05,
    },
    {
      id: 'snare',
      name: 'Snare',
      color: 0xfff0b0,
      patch: 'snare',
      notes: { kind: 'drum' },
      rhythm: R('.... X... .... X...', '.... X... ..g. X..g'),
      fill: { every: 8, rhythm: R('.... X..g ..g. X.gX') },
      symbols: { X: { art: 'hit', vel: 0.95 }, g: { art: 'ghost', vel: 0.42 } },
      late: 0.06,
    },
    {
      id: 'kick',
      name: '2-step kick',
      color: 0xffffff,
      patch: 'kick',
      notes: { kind: 'drum' },
      rhythm: R('X... .... ..X. ....', 'X... ..x. ..X. ....'),
      fill: { every: 8, rhythm: R('X... .... .... ....') },
      pump: true,
      breakdown: 'drop',
    },
  ],

  pad: {
    name: 'Organ bed',
    patch: 'pad',
    notes: { kind: 'pad', voicing: { style: 'rootless', low: 53, high: 77 } },
    sweep: { bars: 8, shape: 'wave', min: 0.1, max: 0.6 },
  },

  parts: {
    bass: {
      name: 'Sub',
      patch: 'sub',
      notes: { kind: 'bass', low: 36 },
      rhythm: R('R-.R ..O. .R-. 5...', 'R-.R ..O. .R-. 7.A.'),
      upgraded: R('R-.R .RO. .R-. 5.O.', 'R-.R .RO. .R-. 7.A.'),
      variant: R('R.RR .RO. R.RR .5O.', 'R.RR .RO. R.RR .7A.'),
      symbols: { R: { vel: 0.85 }, O: { vel: 0.72 }, '5': { vel: 0.74 }, '7': { vel: 0.7 }, A: { vel: 0.72 } },
    },
    chords: {
      name: 'Keys',
      patch: 'keys',
      notes: { kind: 'chord', voicing: { style: 'rootless', low: 55, high: 79 } },
      rhythm: R('...x ..x. ...x .x..', '...x ..x. ..x. ....'),
      upgraded: R('...x ..x. ..xx .x..', '...x ..x. ..x. .x.x'),
      variant: R('..x. ..x. ..x. ..x.'),
      sweep: { bars: 8, shape: 'wave', min: 0.3, max: 0.9 },
    },
    arp: {
      name: 'Vocal chops',
      patch: 'vox',
      notes: { kind: 'arp', low: 67, count: 6, order: [0, 2, 1, 3, 4, 2], orders: [[0, 2, 1, 3, 4, 2], [4, 3, 2, 0, 1, 2], [0, 4, 2, 5, 3, 1]] },
      rhythm: R('x..x ..x. x..x ..x.'),
      upgraded: R('x.xx ..x. x.xx .xx.'),
      variant: R('x..x x.x. x..x x.x.'),
      sweep: { bars: 16, shape: 'rise', min: 0.2, max: 0.9 },
    },
    lead: {
      name: 'Bell',
      patch: 'bell',
      notes: { kind: 'melody', base: 60, snap: true },
    },
  },

  patches: {
    kick: { type: 'drum', kind: 'kick', pitch: 49, sweep: 7, decay: 0.32, click: 0.6, drive: 0.45, gain: 1 },
    snare: { type: 'sampler', bank: 'snare', gain: 0.95, ring: true, highpass: 120 },
    hihat: { type: 'sampler', bank: 'hihat', gain: 0.8, ring: true, highpass: 600, drift: 20 },
    logdrum: { type: 'sampler', bank: 'logdrum', gain: 0.85, ring: true, drift: 6 },
    tamb: { type: 'sampler', bank: 'tamb', gain: 0.7, ring: true, highpass: 400 },
    pad: {
      type: 'synth',
      osc: [
        { wave: 'organ', voices: 2, detune: 10, spread: 0.7 },
        { wave: 'warm', voices: 1, octave: -1, level: 0.4 },
      ],
      filter: { cutoff: 1100, mod: 1, q: 0.6, keytrack: 0.2 },
      amp: { a: 0.9, d: 1, s: 0.85, r: 1.2 },
      gain: 0.26,
    },
    sub: {
      type: 'synth',
      osc: [
        { wave: 'sine', voices: 1 },
        { wave: 'triangle', voices: 1, octave: 1, level: 0.35 },
      ],
      filter: { cutoff: 420, q: 0.8, env: 0.8, keytrack: 0.4 },
      fenv: { a: 0.004, d: 0.2, s: 0.3, r: 0.1 },
      amp: { a: 0.004, d: 0.3, s: 0.85, r: 0.07 },
      glide: 0.07,
      drive: 0.35,
      gain: 0.75,
    },
    keys: { type: 'sampler', bank: 'epiano', gain: 1.1, spread: 0.45, cutoff: [1600, 9000], release: 0.25 },
    vox: {
      type: 'formant',
      vowels: ['a', 'o', 'e', 'a', 'u'],
      amp: { a: 0.006, d: 0.16, s: 0.45, r: 0.12 },
      glide: 0.03,
      vibrato: { rate: 5.6, cents: 18, delay: 0.08 },
      breath: 0.06,
      gain: 0.5,
    },
    bell: { type: 'fm', ratio: 3.5, index: 2.4, indexSustain: 0.05, indexDecay: 0.4, amp: { a: 0.001, d: 1.1, s: 0, r: 0.6 }, chorus: 7, gain: 0.38 },
  },

  mix: {
    levels: { kick: -3, snare: -4, hats: -9, openhat: -12, rim: -10, tamb: -13, pad: -15, bass: -7, chords: -6, arp: -9, lead: -7 },
    sends: {
      snare: { room: -12, hall: -22 },
      hats: { room: -26 },
      rim: { room: -14, delay: -22 },
      tamb: { room: -18 },
      pad: { hall: -14 },
      chords: { hall: -11, delay: -18 },
      arp: { hall: -12, delay: -9 },
      lead: { hall: -8, delay: -10 },
    },
    delay: { steps: 3, feedback: 0.32 },
    hall: 2.8,
    pump: { depth: -4, release: 3 },
  },

  atmosphere: { noise: -60, crackle: -46, tape: 0.35 },
};
