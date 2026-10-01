/**
 * Dev-only: render the groove offline and measure it (levels, spectrum, laptop-speaker share).
 * Not part of the game bundle. Load from the browser console:
 *   const m = await import('/src/dev/offline.ts'); await m.analyze(['kick','clap','hats','bass'])
 */

import * as Tone from 'tone';
import { DEFAULT_TUNING, type Tuning } from '../config/tuning';
import { createVoices } from '../audio/engine';
import { Mixer } from '../audio/mixer';
import { velocityFor } from '../game/sequencer';
import { DRUM_DEFS, type DrumType } from '../game/core';
import { INSTRUMENTS, type InstrumentId } from '../game/instruments';
import { TOWER_DEFS, type TowerType } from '../game/towers';
import { hitIndexAt } from '../game/world';
import { stepAt, type Pattern } from '../music/patterns';
import { sixteenthSeconds, stepToPosition, swingOffset, type SwingGrid } from '../music/timing';

function patternOf(id: InstrumentId): Pattern {
  return id in DRUM_DEFS ? DRUM_DEFS[id as DrumType].pattern : TOWER_DEFS[id as TowerType].patterns.base;
}

/** Render instruments playing their base patterns continuously. */
export async function render(layers: InstrumentId[], bars = 4, t: Tuning = DEFAULT_TUNING): Promise<AudioBuffer> {
  const bpm = t.transport.bpm;
  const seconds = (bars * 16 * sixteenthSeconds(bpm)) + 1;
  const buf = await Tone.Offline(async ({ transport }) => {
    const mixer = new Mixer(t);
    const voices = createVoices(t);
    for (const id of INSTRUMENTS) voices[id].output.connect(mixer.layers[id].input);
    await mixer.ready();
    transport.bpm.value = bpm;
    let step = 0;
    transport.scheduleRepeat((time) => {
      const pos = stepToPosition(step);
      const swing = swingOffset(step, t.transport.swing, t.transport.swingGrid as SwingGrid, bpm);
      for (const id of layers) {
        const pattern = patternOf(id);
        const kind = stepAt(pattern, pos.stepInBar);
        if (!kind) continue;
        voices[id].trigger(
          time + swing,
          {
            kind,
            velocity: velocityFor(kind, t.velocity),
            bar: pos.bar,
            step,
            sixteenth: sixteenthSeconds(bpm),
            hitIndex: hitIndexAt(pattern, pos.stepInBar),
          },
          t,
        );
      }
      step++;
    }, '16n', 0, bars * 16 * sixteenthSeconds(bpm) - 0.001);
    transport.start(0);
  }, seconds, 2, 48000);
  return buf.get() as AudioBuffer;
}

const BANDS: [string, number, number][] = [
  ['sub <60', 20, 60],
  ['low 60-150', 60, 150],
  ['lowmid 150-400', 150, 400],
  ['mid 400-2k', 400, 2000],
  ['presence 2k-6k', 2000, 6000],
  ['air 6k+', 6000, 20000],
];

function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j]!, re[i]!];
      [im[i], im[j]] = [im[j]!, im[i]!];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < len / 2; k++) {
        const wr = Math.cos(ang * k);
        const wi = Math.sin(ang * k);
        const a = i + k;
        const b = a + len / 2;
        const xr = re[b]! * wr - im[b]! * wi;
        const xi = re[b]! * wi + im[b]! * wr;
        re[b] = re[a]! - xr;
        im[b] = im[a]! - xi;
        re[a] = re[a]! + xr;
        im[a] = im[a]! + xi;
      }
    }
  }
}

export interface Analysis {
  peakDb: number;
  rmsDb: number;
  bands: Record<string, number>;
  /** Share of energy above 200 Hz, roughly what laptop speakers reproduce. */
  laptopShare: number;
  /** Strongest frequency below 200 Hz. */
  lowPeakHz: number;
  /** K-weighted loudness (roughly how loud it feels on headphones), dB, relative. */
  phonesDb: number;
  /** Same, through a small-speaker model (steep roll-off under ~250 Hz). */
  laptopDb: number;
  /** Loudest ~85 ms window, K-weighted: how hard a single hit lands. */
  phonesHitDb: number;
  laptopHitDb: number;
}

/** Power weighting approximating K-weighting (LUFS): low cut ~40 Hz, +4 dB shelf above ~1.5 kHz. */
function kWeight(f: number): number {
  const hp = Math.pow(f, 4) / (Math.pow(f, 4) + Math.pow(40, 4));
  const shelf = 1 + (Math.pow(10, 0.4) - 1) * ((f * f) / (f * f + 1500 * 1500));
  return hp * shelf;
}

/** Small laptop speaker: 4th-order roll-off around 250 Hz, gentle top roll-off above 12 kHz. */
function laptopWeight(f: number): number {
  const hp = Math.pow(f, 8) / (Math.pow(f, 8) + Math.pow(250, 8));
  const lp = 1 / (1 + Math.pow(f / 12000, 4));
  return kWeight(f) * hp * lp;
}

export function measure(buf: AudioBuffer): Analysis {
  const L = buf.getChannelData(0);
  const R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L;
  const sr = buf.sampleRate;
  let peak = 0;
  let sum = 0;
  const mono = new Float64Array(L.length);
  for (let i = 0; i < L.length; i++) {
    const m = (L[i]! + R[i]!) / 2;
    mono[i] = m;
    peak = Math.max(peak, Math.abs(L[i]!), Math.abs(R[i]!));
    sum += m * m;
  }
  const N = 8192;
  const spectrum = new Float64Array(N / 2);
  let frames = 0;
  for (let start = 0; start + N <= mono.length; start += N / 2) {
    const re = new Float64Array(N);
    const im = new Float64Array(N);
    for (let i = 0; i < N; i++) re[i] = mono[start + i]! * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1)));
    fft(re, im);
    for (let k = 0; k < N / 2; k++) spectrum[k]! += re[k]! * re[k]! + im[k]! * im[k]!;
    frames++;
  }
  const hz = (k: number) => (k * sr) / N;

  // Per-hit punch: loudest short window.
  const W = 4096;
  let phonesHit = 0;
  let laptopHit = 0;
  const kw = new Float64Array(W / 2);
  const lw = new Float64Array(W / 2);
  for (let k = 1; k < W / 2; k++) {
    kw[k] = kWeight((k * sr) / W);
    lw[k] = laptopWeight((k * sr) / W);
  }
  for (let start = 0; start + W <= mono.length; start += W / 4) {
    const re = new Float64Array(W);
    const im = new Float64Array(W);
    for (let i = 0; i < W; i++) re[i] = mono[start + i]! * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (W - 1)));
    fft(re, im);
    let a = 0;
    let b = 0;
    for (let k = 1; k < W / 2; k++) {
      const p = re[k]! * re[k]! + im[k]! * im[k]!;
      a += p * kw[k]!;
      b += p * lw[k]!;
    }
    phonesHit = Math.max(phonesHit, a);
    laptopHit = Math.max(laptopHit, b);
  }
  let total = 0;
  let above200 = 0;
  let lowPeak = 0;
  let lowPeakK = 0;
  let phones = 0;
  let laptop = 0;
  const bands: Record<string, number> = {};
  for (const [name] of BANDS) bands[name] = 0;
  for (let k = 1; k < N / 2; k++) {
    const p = spectrum[k]! / Math.max(frames, 1);
    const f = hz(k);
    total += p;
    phones += p * kWeight(f);
    laptop += p * laptopWeight(f);
    if (f >= 200) above200 += p;
    if (f < 200 && p > lowPeak) {
      lowPeak = p;
      lowPeakK = k;
    }
    for (const [name, lo, hi] of BANDS) if (f >= lo && f < hi) bands[name]! += p;
  }
  for (const k of Object.keys(bands)) bands[k] = Math.round((bands[k]! / total) * 1000) / 10;
  return {
    peakDb: Math.round(20 * Math.log10(peak) * 10) / 10,
    rmsDb: Math.round(10 * Math.log10(sum / mono.length) * 10) / 10,
    bands,
    laptopShare: Math.round((above200 / total) * 1000) / 10,
    lowPeakHz: Math.round(hz(lowPeakK)),
    phonesDb: Math.round(10 * Math.log10(phones / mono.length) * 10) / 10,
    laptopDb: Math.round(10 * Math.log10(laptop / mono.length) * 10) / 10,
    phonesHitDb: Math.round(10 * Math.log10(phonesHit) * 10) / 10,
    laptopHitDb: Math.round(10 * Math.log10(laptopHit) * 10) / 10,
  };
}

export async function analyze(layers: InstrumentId[], bars = 4, t: Tuning = DEFAULT_TUNING): Promise<Analysis> {
  return measure(await render(layers, bars, t));
}

/** Every layer solo, then the full mix. Loudness is shown relative to the kick. */
export async function report(t: Tuning = DEFAULT_TUNING): Promise<string> {
  const out: Record<string, Analysis> = {};
  for (const l of INSTRUMENTS) out[l] = await analyze([l], 4, t);
  out.drums = await analyze(['kick', 'clap', 'hats'], 4, t);
  out.full = await analyze([...INSTRUMENTS], 4, t);
  const ref = out.kick!;
  const lines = Object.entries(out).map(
    ([name, a]) =>
      `${name.padEnd(5)} peak ${a.peakDb.toFixed(1).padStart(5)} | avg phones ${(a.phonesDb - ref.phonesDb).toFixed(1).padStart(5)} laptop ${(a.laptopDb - ref.phonesDb).toFixed(1).padStart(5)} | hit phones ${(a.phonesHitDb - ref.phonesHitDb).toFixed(1).padStart(5)} laptop ${(a.laptopHitDb - ref.phonesHitDb).toFixed(1).padStart(5)} | >200Hz ${a.laptopShare}% low ${a.lowPeakHz}Hz`,
  );
  return lines.join('\n');
}

/** 16-bit WAV bytes, for listening outside the game. */
export function toWav(buf: AudioBuffer): Blob {
  const ch = buf.numberOfChannels;
  const len = buf.length * ch * 2 + 44;
  const view = new DataView(new ArrayBuffer(len));
  const w = (o: number, s: string) => [...s].forEach((c, i) => view.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF');
  view.setUint32(4, len - 8, true);
  w(8, 'WAVEfmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, ch, true);
  view.setUint32(24, buf.sampleRate, true);
  view.setUint32(28, buf.sampleRate * ch * 2, true);
  view.setUint16(32, ch * 2, true);
  view.setUint16(34, 16, true);
  w(36, 'data');
  view.setUint32(40, buf.length * ch * 2, true);
  let o = 44;
  for (let i = 0; i < buf.length; i++) {
    for (let c = 0; c < ch; c++) {
      const s = Math.max(-1, Math.min(1, buf.getChannelData(c)[i]!));
      view.setInt16(o, s * 0x7fff, true);
      o += 2;
    }
  }
  return new Blob([view], { type: 'audio/wav' });
}
