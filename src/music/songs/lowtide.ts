/**
 * Chapter 4, "Low Tide": liquid drum & bass, E minor, 172 BPM.
 *
 * A broken two-step beat (kick on 1 and the "and" of 3, snare on 2 and 4 with ghosts), long reese
 * bass notes, grand piano chords, a violin section singing the melody, cellos underneath and a
 * vibraphone arpeggio. Fast, but the harmony moves slowly: 4-bar chords over a 172 BPM groove.
 */

import { rhythm } from '../rhythm';
import type { SongDef } from '../song';

const R = (...bars: string[]) => rhythm(16, ...bars);

const S1_MELODY = '5:8 3:4 5:4 | 7:6 6:2 5:8 | 3:8 5:4 9:4 | 8:16 | 9:8 7:4 5:4 | 4:6 5:2 7:8 | 9:8 11:4 12:4 | 12:16';
const S1_ANSWER = '12:8 10:4 8:4 | 9:6 10:2 12:8 | 14:8 12:4 10:4 | 12:16 | 11:8 13:4 15:4 | 14:6 13:2 12:8 | 11:8 9:4 7:4 | 9:16';
const S1_CHORDS: readonly (readonly [string, number])[] = [['Cmaj9', 4], ['Bm7', 4], ['Em9', 4], ['Am9', 2], ['D6', 2]];

export const LOWTIDE: SongDef = {
  id: 'lowtide',
  title: 'Low Tide',
  style: 'Liquid drum & bass · E minor · 172',
  bpm: 172,
  stepsPerBar: 16,
  beats: [4, 4, 4, 4],
  swing: 0.08,
  key: 'E minor',
  intro: { chords: [['Cmaj9', 8], ['Em9', 8]] },
  sections: [
    { chords: S1_CHORDS, melody: S1_MELODY, answer: S1_ANSWER },
    {
      chords: [['Gmaj7', 4], ['F#m7b5', 2], ['B7b9', 2], ['Em9', 4], ['Cmaj9', 4]],
      melody: '5:8 7:4 9:4 | 10:16 | 9:8 7:4 5:4 | 7:16 | 6:8 4:4 2:4 | 4:16 | #7:8 9:4 11:4 | 6:16',
      answer: '5:8 8:4 10:4 | 12:16 | 9:8 10:4 12:4 | 14:16 | 13:8 12:4 10:4 | 12:8 9:8 | 8:8 7:4 5:4 | 5:16',
    },
    {
      chords: [['Am9', 4], ['Cmaj9', 4], ['Gmaj7/B', 4], ['Em9', 4]],
      melody: '4:8 6:4 8:4 | 12:16 | 10:8 8:4 6:4 | 5:16 | 6:8 8:4 10:4 | 12:16 | 13:8 12:4 10:4 | 12:16',
      answer: '12:8 10:4 9:4 | 7:16 | 5:8 7:4 9:4 | 10:16 | 10:8 8:4 7:4 | 5:16 | 3:8 5:4 7:4 | 8:16',
    },
    { chords: S1_CHORDS, melody: S1_MELODY, answer: S1_ANSWER, shift: 2 },
  ],

  core: [
    {
      id: 'tamb',
      name: 'Tambourine',
      color: 0xffe08a,
      perk: { tier: 3 },
      patch: 'tamb',
      notes: { kind: 'drum' },
      rhythm: R('..x. .... ..x. ..x.'),
      symbols: { x: { art: 'hit', vel: 0.45 } },
      pan: -0.4,
      loose: 0.04,
    },
    {
      id: 'ride',
      name: 'Ride',
      color: 0xc8f6ff,
      perk: { tier: 2 },
      patch: 'ride',
      notes: { kind: 'drum' },
      rhythm: R('..x. ..x. ..x. ..x.'),
      pan: 0.3,
    },
    {
      id: 'shaker',
      name: 'Shaker',
      color: 0xd7ffb0,
      perk: { tier: 1 },
      patch: 'shaker',
      notes: { kind: 'drum' },
      rhythm: R('dxXx dxXx dxXx dxXx'),
      symbols: { X: { art: 'slap', vel: 0.5 }, x: { art: 'up', vel: 0.32 }, d: { art: 'down', vel: 0.26 } },
      pan: 0.4,
      loose: 0.05,
    },
    {
      id: 'hats',
      name: 'Hats',
      color: 0x9fe8ff,
      patch: 'hihat',
      notes: { kind: 'drum' },
      rhythm: R('x.s. x.sx x.s. x.s.'),
      deco: [{ from: 0.62, rhythm: R('.g.g .g.. .g.g .g.g'), vel: 0.6 }],
      lift: R('xsxs xsxs xsxs xsxs'),
      symbols: { x: { art: 'closed', vel: 0.66 }, s: { art: 'soft', vel: 0.42 }, g: { art: 'tight', vel: 0.4 } },
      pan: 0.22,
      loose: 0.03,
    },
    {
      id: 'snare',
      name: 'Snare',
      color: 0xfff0b0,
      patch: 'snare',
      notes: { kind: 'drum' },
      rhythm: R('.... X... .... X...', '.... X..g .... X.g.'),
      fill: { every: 8, rhythm: R('.... X..g ..g. XgXX') },
      symbols: { X: { art: 'hard', vel: 0.95 }, g: { art: 'ghost', vel: 0.4 } },
      late: 0.03,
    },
    {
      id: 'kick',
      name: 'Kick',
      color: 0xffffff,
      patch: 'kick',
      notes: { kind: 'drum' },
      rhythm: R('X... .... ..X. ....', 'X... .... ..X. .X..'),
      fill: { every: 8, rhythm: R('X... .... .... ....') },
      pump: true,
      breakdown: 'drop',
    },
  ],

  pad: {
    name: 'Cellos',
    patch: 'cellos',
    notes: { kind: 'pad', voicing: { style: 'open', low: 36, high: 64 } },
  },

  parts: {
    bass: {
      name: 'Reese',
      patch: 'reese',
      notes: { kind: 'bass', low: 28 },
      rhythm: R('R--- ---. ..R- -.O-', 'R--- ---. ..R- -.A-'),
      upgraded: R('R--- -.R- ..R- -.O-', 'R--- -.R- ..R- -.A-'),
      variant: R('R-.R -.R- R-.R -.O-', 'R-.R -.R- R-.R -.A-'),
      symbols: { R: { vel: 0.85 }, O: { vel: 0.72 }, A: { vel: 0.72 } },
      sweep: { bars: 8, shape: 'wave', min: 0.1, max: 0.8 },
    },
    chords: {
      name: 'Piano',
      patch: 'piano',
      notes: { kind: 'chord', voicing: { style: 'rootless', low: 55, high: 79 }, strum: 0.012 },
      rhythm: R('x--- ---- ---- ----', '...x ..x. .... ....'),
      upgraded: R('x--- ..x- ..x- ....', '...x ..x. ..x. ...x'),
      variant: R('x.x. ..x. x.x. ..x.'),
    },
    arp: {
      name: 'Vibes',
      patch: 'vibes',
      notes: { kind: 'arp', low: 64, count: 7, order: [0, 2, 4, 6, 4, 2], orders: [[0, 2, 4, 6, 4, 2], [6, 4, 3, 1, 2], [0, 3, 1, 4, 2, 5]] },
      rhythm: R('x.x. x.x. x.x. x.x.'),
      upgraded: R('xxxx xxxx xxxx xxxx'),
      variant: R('x.xx .xx. x.xx .xx.'),
      sweep: { bars: 16, shape: 'rise', min: 0.2, max: 1 },
    },
    lead: {
      name: 'Strings',
      patch: 'violins',
      notes: { kind: 'melody', base: 64, snap: true },
    },
  },

  patches: {
    kick: { type: 'drum', kind: 'kick', pitch: 41.2, sweep: 7, decay: 0.38, click: 0.55, drive: 0.5, gain: 1 },
    snare: { type: 'sampler', bank: 'snare', gain: 1, ring: true, highpass: 140 },
    hihat: { type: 'sampler', bank: 'hihat', gain: 0.8, ring: true, highpass: 700, drift: 25 },
    shaker: { type: 'sampler', bank: 'shaker', gain: 0.7, ring: true, highpass: 400 },
    ride: { type: 'drum', kind: 'hat', pitch: 420, decay: 0.32, tone: 5200, gain: 0.55, arts: {} },
    tamb: { type: 'sampler', bank: 'tamb', gain: 0.7, ring: true, highpass: 500 },
    cellos: { type: 'sampler', bank: 'cellos', gain: 0.8, attack: 0.6, release: 1.4, spread: 0.4 },
    reese: {
      type: 'synth',
      osc: [{ wave: 'sawtooth', voices: 2, detune: 22, spread: 0.3 }],
      sub: 0.6,
      filter: { cutoff: 220, mod: 1.6, q: 1.6, env: 1, keytrack: 0.4 },
      fenv: { a: 0.08, d: 0.6, s: 0.5, r: 0.2 },
      amp: { a: 0.01, d: 0.4, s: 0.85, r: 0.12 },
      drive: 0.4,
      gain: 0.62,
    },
    piano: { type: 'sampler', bank: 'piano', gain: 1.1, ring: false, release: 0.6, spread: 0.35, cutoff: [2200, 12000] },
    vibes: { type: 'sampler', bank: 'vibes', gain: 0.85, ring: true, drift: 4 },
    violins: { type: 'sampler', bank: 'violins', gain: 0.9, attack: 0.12, release: 0.6 },
  },

  mix: {
    levels: { kick: -3, snare: -3, hats: -9, shaker: -12, ride: -15, tamb: -13, pad: -10, bass: -7, chords: -5, arp: -10, lead: -5 },
    sends: {
      snare: { room: -10, hall: -18 },
      hats: { room: -24 },
      ride: { hall: -24 },
      tamb: { room: -18 },
      pad: { hall: -10 },
      chords: { hall: -8, delay: -18 },
      arp: { hall: -14, delay: -10 },
      lead: { hall: -6, delay: -18 },
    },
    delay: { steps: 3, feedback: 0.34 },
    hall: 4.5,
    pump: { depth: -3, release: 3 },
  },

  atmosphere: { noise: -56, crackle: -58, tape: 0.3 },
};
