/**
 * Chapter 3, "Seven Rivers": organic 7/8, D dorian, 112 BPM. No kick drum at all.
 *
 * The bar is seven eighths (14 sixteenths) grouped 2+2+3. The foundation is a low frame drum; cajon,
 * shaker and hand drums play around it. Kalimba chords strum, a marimba runs a 3-note cycle against
 * the 7-hit bar (it only realigns every 3 bars), a flute sings the melody and bowed vibraphone holds
 * the harmony underneath.
 */

import { rhythm } from '../rhythm';
import type { SongDef } from '../song';

const R = (...bars: string[]) => rhythm(14, ...bars);

const S1_MELODY = '5:4 3:4 1:6 | 2:2 3:2 5:4 7:6 | 8:6 7:2 5:6 | 5:14 | 6:4 5:4 4:6 | 5:2 4:2 5:4 6:6 | 8:4 7:4 6:6 | 5:14';
const S1_ANSWER = '7:4 6:4 5:6 | 3:2 5:2 7:4 9:6 | 8:6 7:2 5:6 | 5:14 | 9:4 8:4 6:6 | 5:2 6:2 8:4 4:6 | 7:6 6:2 5:6 | 5:14';
const S1_CHORDS: readonly (readonly [string, number])[] = [['Dm9', 4], ['G9', 4], ['Fmaj7', 4], ['Em7', 2], ['Am7', 2]];

export const SEVENRIVERS: SongDef = {
  id: 'sevenrivers',
  title: 'Seven Rivers',
  style: 'Organic 7/8, no kick · D dorian · 112',
  bpm: 112,
  stepsPerBar: 14,
  beats: [4, 4, 6],
  swing: 0.1,
  key: 'D dorian',
  intro: { chords: [['Dm9', 8]] },
  sections: [
    { chords: S1_CHORDS, melody: S1_MELODY, answer: S1_ANSWER },
    {
      chords: [['Cmaj7', 2], ['G/B', 2], ['Am7', 2], ['Dm9', 2]],
      melody: '2:4 5:4 7:6 | 9:8 7:6 | 6:4 5:4 4:6 | 2:8 4:6 | 5:4 7:4 8:6 | 9:8 8:6 | 8:4 7:4 5:6 | 1:14',
      answer: '2:4 5:4 7:6 | 9:4 10:4 9:6 | 6:4 8:4 11:6 | 10:14 | 12:4 10:4 9:6 | 8:8 7:6 | 7:4 8:4 9:6 | 8:14',
    },
    {
      chords: [['Gsus2', 4], ['Dm9/F', 4], ['Em7', 4], ['Am7', 4]],
      melody: '4:6 5:4 8:4 | 9:14 | 8:4 5:4 4:6 | 5:14 | 3:6 5:4 8:4 | 9:14 | 10:4 9:4 8:6 | 5:14',
      answer: '9:6 8:4 6:4 | 5:14 | 6:4 8:4 9:6 | 11:14 | 12:6 10:4 9:4 | 8:14 | 7:4 9:4 12:6 | 12:14',
    },
    { chords: S1_CHORDS, melody: S1_MELODY, answer: S1_ANSWER, shift: 2 },
  ],

  core: [
    {
      id: 'darbuka',
      name: 'Darbuka',
      color: 0xffa3c7,
      perk: { tier: 3 },
      patch: 'darbuka',
      notes: { kind: 'drum' },
      rhythm: R('d.tk d.tk d.tktk', 'd.tk d.t. d.tkt.'),
      symbols: { d: { art: 'doum', vel: 0.6 }, t: { art: 'tek', vel: 0.45 }, k: { art: 'ka', vel: 0.32 } },
      pan: 0.38,
      loose: 0.06,
    },
    {
      id: 'conga',
      name: 'Congas',
      color: 0xffb37a,
      perk: { tier: 2 },
      patch: 'conga',
      notes: { kind: 'drum' },
      rhythm: R('...o ..s. o..s.l', '...o ..s. o.ss.l'),
      symbols: { o: { art: 'open', vel: 0.6 }, s: { art: 'slap', vel: 0.62 }, l: { art: 'low', vel: 0.66 } },
      pan: -0.36,
      loose: 0.05,
    },
    {
      id: 'bongo',
      name: 'Bongos',
      color: 0xd7ffb0,
      perk: { tier: 1 },
      patch: 'bongo',
      notes: { kind: 'drum' },
      rhythm: R('h.Lm ..hL h.L.hm'),
      symbols: { h: { art: 'high', vel: 0.5 }, L: { art: 'low', vel: 0.55 }, m: { art: 'highMute', vel: 0.38 } },
      pan: 0.22,
      loose: 0.07,
    },
    {
      id: 'shaker',
      name: 'Shaker',
      color: 0x9fe8ff,
      patch: 'shaker',
      notes: { kind: 'drum' },
      rhythm: R('X.x. X.x. X.x.x.'),
      deco: [{ from: 0.62, rhythm: R('.d.d .d.d .d.d.d'), vel: 0.7 }],
      lift: R('XdxdXdxdXdxdxd'),
      symbols: { X: { art: 'slap', vel: 0.55 }, x: { art: 'up', vel: 0.34 }, d: { art: 'down', vel: 0.26 } },
      pan: -0.2,
      loose: 0.05,
    },
    {
      id: 'cajon',
      name: 'Cajon',
      color: 0xfff0b0,
      patch: 'cajon',
      notes: { kind: 'drum' },
      rhythm: R('..t. S..t ..S.t.', '..t. S..t .tS.tt'),
      fill: { every: 8, rhythm: R('..t. S..t S.StSS') },
      symbols: { S: { art: 'slap', vel: 0.9 }, t: { art: 'tip', vel: 0.45 }, b: { art: 'bass', vel: 0.8 } },
      late: 0.04,
    },
    {
      id: 'frame',
      name: 'Frame drum',
      color: 0xffffff,
      patch: 'frame',
      notes: { kind: 'drum' },
      rhythm: R('L..m L... L..h..', 'L... L..m L.h.h.'),
      fill: { every: 8, rhythm: R('L... L... L.....') },
      symbols: { L: { art: 'low', vel: 0.95 }, m: { art: 'lowMute', vel: 0.5 }, h: { art: 'high', vel: 0.55 } },
      pump: true,
      breakdown: 'drop',
    },
  ],

  pad: {
    name: 'Bowed vibes',
    patch: 'bowed',
    notes: { kind: 'pad', voicing: { style: 'open', low: 50, high: 79 } },
  },

  parts: {
    bass: {
      name: 'Round bass',
      patch: 'bass',
      notes: { kind: 'bass', low: 38 },
      rhythm: R('R... O.R. 5..R..', 'R... O.R. 7..A..'),
      upgraded: R('R..R O.R. 5..R.5', 'R..R O.R. 7.5A..'),
      variant: R('R.R. O.R. 5.R.R.', 'R.R. O.R. 7.R.A.'),
      symbols: { R: { vel: 0.82 }, O: { vel: 0.68 }, '5': { vel: 0.72 }, '7': { vel: 0.7 }, A: { vel: 0.7 } },
    },
    chords: {
      name: 'Kalimba',
      patch: 'kalimba',
      notes: { kind: 'chord', voicing: { style: 'close', low: 60, high: 84 }, strum: 0.028 },
      rhythm: R('x... ..x. x...x.'),
      upgraded: R('x..x ..x. x.x.x.'),
      variant: R('..x. ..x. ..x..x'),
    },
    arp: {
      name: 'Marimba',
      patch: 'marimba',
      notes: { kind: 'arp', low: 62, count: 7, order: [0, 2, 4], orders: [[0, 2, 4], [4, 2, 0, 3], [0, 3, 5, 2, 4]] },
      rhythm: R('x.x. x.x. x.x.x.'),
      upgraded: R('xxxx xxxx xxxxxx'),
      variant: R('xxx. xxx. xx.xx.'),
      sweep: { bars: 8, shape: 'wave', min: 0.3, max: 1 },
    },
    lead: {
      name: 'Flute',
      patch: 'flute',
      notes: { kind: 'melody', base: 62, snap: true },
    },
  },

  patches: {
    frame: { type: 'sampler', bank: 'frame', gain: 1.1, ring: true },
    cajon: { type: 'sampler', bank: 'cajon', gain: 0.95, ring: true },
    shaker: { type: 'sampler', bank: 'shaker', gain: 0.75, ring: true, highpass: 300 },
    bongo: { type: 'sampler', bank: 'bongo', gain: 0.85, ring: true, drift: 10 },
    conga: { type: 'sampler', bank: 'conga', gain: 0.85, ring: true, drift: 8 },
    darbuka: { type: 'sampler', bank: 'darbuka', gain: 0.8, ring: true, drift: 8 },
    bowed: { type: 'sampler', bank: 'bowed', gain: 0.75, attack: 0.9, release: 1.6, spread: 0.5 },
    bass: {
      type: 'synth',
      osc: [
        { wave: 'triangle', voices: 1 },
        { wave: 'sine', voices: 1, octave: -1, level: 0.6 },
      ],
      filter: { cutoff: 700, q: 0.7, env: 0.6, keytrack: 0.3 },
      fenv: { a: 0.01, d: 0.3, s: 0.4, r: 0.15 },
      amp: { a: 0.012, d: 0.4, s: 0.7, r: 0.16 },
      glide: 0.09,
      drive: 0.15,
      gain: 0.65,
    },
    kalimba: { type: 'sampler', bank: 'kalimba', gain: 1, ring: true, spread: 0.5, drift: 6 },
    marimba: { type: 'sampler', bank: 'marimba', gain: 0.9, ring: true, drift: 5, cutoff: [2500, 12000] },
    flute: { type: 'sampler', bank: 'flute', gain: 0.95, attack: 0.05, release: 0.35 },
  },

  mix: {
    levels: { frame: -2, cajon: -4, shaker: -10, bongo: -9, conga: -9, darbuka: -12, pad: -11, bass: -7, chords: -6, arp: -8, lead: -5 },
    sends: {
      cajon: { room: -12 },
      bongo: { room: -14 },
      conga: { room: -14, hall: -22 },
      darbuka: { room: -16 },
      shaker: { room: -20 },
      pad: { hall: -9 },
      chords: { hall: -10, delay: -16 },
      arp: { hall: -12, delay: -13 },
      lead: { hall: -8, delay: -14 },
    },
    delay: { steps: 3, feedback: 0.3 },
    hall: 3.6,
    pump: { depth: -2, release: 4 },
  },

  atmosphere: { noise: -62, crackle: -72, tape: 0.2 },
};
