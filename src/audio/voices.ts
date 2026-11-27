/**
 * Instrument voices, one class per patch type. Each hit builds a small native Web Audio graph,
 * scheduled at the exact time it was given, that frees itself when it ends.
 *
 *   sampler  - the CC0 samples (piano, mallets, strings, hand percussion...)
 *   synth    - oscillator stacks with unison, sub, noise, filter and envelopes (pads, plucks, basses, leads)
 *   fm       - two-operator FM (electric pianos, bells, organs)
 *   drum     - synthesized drums (kick, clap, hats, snare, toms, rim)
 *   formant  - a voice-like synth through vowel filters (vocal chops)
 */

import * as Tone from 'tone';
import { midiToFreq } from '../music/harmony';
import { group, nearest, reverseOf } from './bank';
import { driveCurve } from './curves';
import type { DrumPatch, Env, FmPatch, FormantPatch, Patch, SamplerPatch, SynthPatch, Wave } from './patch';

export interface PlayEvent {
  /** Audio time the note starts. */
  time: number;
  notes: readonly number[];
  /** Seconds the note is held (before release). */
  hold: number;
  vel: number;
  mod: number;
  art?: string;
  slide?: boolean;
  strum?: number;
  /** Extra stereo width from rewards, 0..1. */
  width: number;
  /** A distant (idle) layer: render it cheaply (one oscillator per layer, no detuned copies). */
  lite?: boolean;
}

export abstract class PatchVoice {
  readonly output = new Tone.Gain(1);
  protected readonly ctx = Tone.getContext().rawContext as unknown as BaseAudioContext;
  abstract play(e: PlayEvent): void;
  /** Sample groups this voice needs loaded. */
  banks(): string[] {
    return [];
  }
  protected into(node: AudioNode, dest: Tone.ToneAudioNode = this.output): void {
    Tone.connect(node as unknown as Tone.OutputNode, dest);
  }
  dispose(): void {
    this.output.dispose();
  }
}

/** Shape a gain param as an ADSR held for `hold` seconds. Returns when the sound is gone. */
function adsr(p: AudioParam, env: Env, peak: number, time: number, hold: number): number {
  const a = Math.max(0.001, env.a);
  p.setValueAtTime(0, time);
  p.linearRampToValueAtTime(peak, time + a);
  if (hold > a) p.setTargetAtTime(peak * env.s, time + a, Math.max(0.001, env.d) / 3);
  const off = time + Math.max(hold, a);
  p.setTargetAtTime(0, off, Math.max(0.005, env.r) / 4);
  return off + Math.max(0.02, env.r) * 1.6;
}

let noiseBuf: AudioBuffer | null = null;
function noise(ctx: BaseAudioContext): AudioBuffer {
  if (!noiseBuf || noiseBuf.sampleRate !== ctx.sampleRate) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

const waves = new WeakMap<BaseAudioContext, Map<string, PeriodicWave>>();
function periodic(ctx: BaseAudioContext, wave: Wave): PeriodicWave | null {
  if (wave !== 'pulse' && wave !== 'organ' && wave !== 'warm') return null;
  let m = waves.get(ctx);
  if (!m) waves.set(ctx, (m = new Map()));
  let w = m.get(wave);
  if (!w) {
    const n = 64;
    const real = new Float32Array(n);
    const imag = new Float32Array(n);
    for (let k = 1; k < n; k++) {
      if (wave === 'pulse') imag[k] = (2 / (k * Math.PI)) * Math.sin((k * Math.PI) / 4) * 1.4;
      else if (wave === 'warm') imag[k] = (k % 2 ? 1 : 0.6) / Math.pow(k, 1.35);
      else imag[k] = [0, 1, 0.75, 0.55, 0.6, 0, 0.35, 0, 0.3][k] ?? 0; // organ drawbars
    }
    w = ctx.createPeriodicWave(real, imag);
    m.set(wave, w);
  }
  return w;
}

function setWave(o: OscillatorNode, ctx: BaseAudioContext, wave: Wave): void {
  const p = periodic(ctx, wave);
  if (p) o.setPeriodicWave(p);
  else o.type = wave as OscillatorType;
}

// ---------------------------------------------------------------- sampler

export class SamplerVoice extends PatchVoice {
  private rr = 0;
  constructor(private readonly p: SamplerPatch) {
    super();
  }
  override banks(): string[] {
    return [this.p.bank];
  }
  play(e: PlayEvent): void {
    const g = group(this.p.bank);
    if (!g) return;
    const ctx = this.ctx;
    const p = this.p;
    const n = e.notes.length;
    const list = n ? e.notes : [0];
    list.forEach((midi, i) => {
      let buffer: AudioBuffer | undefined;
      let rate = 1;
      if (g.kind === 'pitched') {
        const hit = nearest(g, midi + (p.transpose ?? 0));
        if (!hit) return;
        buffer = hit.buffer;
        rate = hit.rate;
      } else {
        const variants = g.arts.get(e.art ?? '') ?? g.arts.values().next().value;
        if (!variants?.length) return;
        buffer = variants[this.rr++ % variants.length];
      }
      if (!buffer) return;
      if (p.reverse) buffer = reverseOf(buffer);
      const t = e.time + (e.strum ?? 0) * i;
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      // Round-robin feel: a few cents of random tuning per hit (folded into the rate; not every context has detune on buffer sources).
      if (p.drift) rate *= Math.pow(2, ((Math.random() - 0.5) * 2 * p.drift) / 1200);
      src.playbackRate.value = rate;
      let node: AudioNode = src;
      if (p.cutoff) {
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.Q.value = 0.5;
        const [lo, hi] = p.cutoff;
        lp.frequency.value = Math.min(20000, lo * Math.pow(hi / lo, Math.min(1, e.mod * 0.75 + e.vel * 0.35)));
        node.connect(lp);
        node = lp;
      }
      if (p.highpass) {
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = p.highpass;
        node.connect(hp);
        node = hp;
      }
      const amp = ctx.createGain();
      const level = Math.pow(e.vel, 1.4) * (p.gain ?? 1) / Math.sqrt(Math.max(1, n * 0.7));
      const dur = buffer.duration / rate;
      const attack = p.attack ?? 0.002;
      const release = p.release ?? 0.08;
      const end = p.ring ? t + dur : Math.min(t + dur, t + e.hold + release);
      amp.gain.setValueAtTime(0, t);
      amp.gain.linearRampToValueAtTime(level, t + attack);
      if (!p.ring) {
        amp.gain.setValueAtTime(level, Math.max(t + attack, end - release));
        amp.gain.linearRampToValueAtTime(0, end);
      }
      node.connect(amp);
      let out: AudioNode = amp;
      const spread = (p.spread ?? 0) * (1 + e.width * 0.5);
      if (spread > 0 && n > 1) {
        const pan = ctx.createStereoPanner();
        pan.pan.value = Math.max(-1, Math.min(1, ((i / (n - 1)) * 2 - 1) * spread));
        amp.connect(pan);
        out = pan;
      }
      this.into(out);
      src.start(t);
      src.stop(end + 0.01);
    });
  }
}

// ---------------------------------------------------------------- synth

export class SynthVoice extends PatchVoice {
  private readonly shaper: Tone.WaveShaper | null;
  private last = new Map<number, number>();
  private lastFreq: number | null = null;
  constructor(private readonly p: SynthPatch) {
    super();
    if (p.drive) {
      this.shaper = new Tone.WaveShaper(driveCurve(p.drive), 2048);
      this.shaper.oversample = '2x';
      this.shaper.connect(this.output);
    } else this.shaper = null;
  }
  play(e: PlayEvent): void {
    const ctx = this.ctx;
    const p = this.p;
    const dest = this.shaper ?? this.output;
    const n = e.notes.length;
    e.notes.forEach((midi, ni) => {
      const t = e.time + (e.strum ?? 0) * ni;
      const f = midiToFreq(midi);
      const amp = ctx.createGain();
      const peak = Math.pow(e.vel, 1.2) * (p.gain ?? 0.5) / Math.sqrt(n);
      const end = adsr(amp.gain, p.amp, peak, t, e.hold);

      const filter = ctx.createBiquadFilter();
      filter.type = p.filter.type ?? 'lowpass';
      filter.Q.value = p.filter.q ?? 0.7;
      const key = Math.pow(f / 261.6, p.filter.keytrack ?? 0.3);
      const base = Math.min(18000, p.filter.cutoff * key * Math.pow(2, (p.filter.mod ?? 0) * e.mod + (p.filter.vel ?? 0.5) * (e.vel - 0.7)));
      const fe = p.fenv;
      if (fe && p.filter.env) {
        const top = Math.min(19000, base * Math.pow(2, p.filter.env));
        const sus = Math.min(19000, base * Math.pow(2, p.filter.env * fe.s));
        filter.frequency.setValueAtTime(base, t);
        filter.frequency.linearRampToValueAtTime(top, t + Math.max(0.001, fe.a));
        filter.frequency.setTargetAtTime(sus, t + Math.max(0.001, fe.a), Math.max(0.002, fe.d) / 3);
        filter.frequency.setTargetAtTime(base, t + Math.max(e.hold, fe.a), Math.max(0.005, fe.r) / 3);
      } else filter.frequency.value = base;
      filter.connect(amp);
      this.into(amp, dest);

      const nodes: AudioScheduledSourceNode[] = [];
      const prevF = e.slide ? (this.last.get(ni) ?? this.lastFreq) : null;
      const setFreq = (param: AudioParam, freq: number) => {
        if (prevF && p.glide) {
          param.setValueAtTime(prevF * (freq / f), t);
          param.exponentialRampToValueAtTime(freq, t + p.glide);
        } else if (p.pitchEnv) {
          param.setValueAtTime(freq * Math.pow(2, p.pitchEnv.semis / 12), t);
          param.exponentialRampToValueAtTime(freq, t + p.pitchEnv.time);
        } else param.setValueAtTime(freq, t);
      };
      let vib: GainNode | null = null;
      if (p.vibrato) {
        const lfo = ctx.createOscillator();
        lfo.frequency.value = p.vibrato.rate;
        vib = ctx.createGain();
        vib.gain.setValueAtTime(0, t);
        vib.gain.linearRampToValueAtTime(p.vibrato.cents, t + p.vibrato.delay + 0.3);
        lfo.connect(vib);
        nodes.push(lfo);
      }
      const sides = new Map<number, StereoPannerNode>();
      for (const [oi, o] of p.osc.entries()) {
        if (e.lite && oi > 0) break;
        const voices = e.lite ? 1 : Math.max(1, o.voices ?? 1);
        const level = (o.level ?? 1) / Math.sqrt(voices);
        const ratio = Math.pow(2, (o.octave ?? 0) + (o.semi ?? 0) / 12);
        for (let v = 0; v < voices; v++) {
          const pos = voices === 1 ? 0 : (v / (voices - 1)) * 2 - 1;
          const osc = ctx.createOscillator();
          setWave(osc, ctx, o.wave);
          setFreq(osc.frequency, f * ratio);
          osc.detune.value = pos * (o.detune ?? 0) * 0.5 + (Math.random() - 0.5) * 4;
          if (vib) vib.connect(osc.detune);
          const g = ctx.createGain();
          g.gain.value = level;
          const spread = Math.min(1, (o.spread ?? 0) * (1 + e.width * 0.4));
          if (spread > 0 && voices > 1 && Math.abs(pos) > 0.01) {
            // Voices left of centre share one panner, voices right share another (cheap, still wide).
            const side = Math.sign(pos) * Math.round(spread * 8) / 8;
            let pan = sides.get(side);
            if (!pan) {
              pan = ctx.createStereoPanner();
              pan.pan.value = side * 0.85;
              pan.connect(filter);
              sides.set(side, pan);
            }
            osc.connect(g).connect(pan);
          } else osc.connect(g).connect(filter);
          nodes.push(osc);
        }
      }
      if (p.sub) {
        const sub = ctx.createOscillator();
        sub.type = 'sine';
        setFreq(sub.frequency, f / 2);
        const g = ctx.createGain();
        g.gain.value = p.sub;
        // The sub skips the filter so it stays solid.
        sub.connect(g).connect(amp);
        nodes.push(sub);
      }
      if (p.noise) {
        const src = ctx.createBufferSource();
        src.buffer = noise(ctx);
        src.loop = true;
        const g = ctx.createGain();
        g.gain.value = p.noise;
        src.connect(g).connect(filter);
        nodes.push(src);
      }
      for (const nd of nodes) {
        if (nd instanceof AudioBufferSourceNode) nd.start(t, Math.random());
        else nd.start(t);
        nd.stop(end);
      }
      this.last.set(ni, f);
      this.lastFreq = f;
    });
  }
  override dispose(): void {
    this.shaper?.dispose();
    super.dispose();
  }
}

// ---------------------------------------------------------------- fm

export class FmVoice extends PatchVoice {
  constructor(private readonly p: FmPatch) {
    super();
  }
  play(e: PlayEvent): void {
    const ctx = this.ctx;
    const p = this.p;
    const n = e.notes.length;
    e.notes.forEach((midi, i) => {
      const t = e.time + (e.strum ?? 0) * i;
      const f = midiToFreq(midi);
      const amp = ctx.createGain();
      const peak = Math.pow(e.vel, 1.3) * (p.gain ?? 0.4) / Math.sqrt(n);
      const end = adsr(amp.gain, p.amp, peak, t, e.hold);
      let out: AudioNode = amp;
      if (p.cutoff) {
        const lp = ctx.createBiquadFilter();
        lp.frequency.value = p.cutoff * (0.6 + e.vel * 0.6) * (0.8 + e.mod * 0.5);
        amp.connect(lp);
        out = lp;
      }
      if (p.tremolo) {
        const trem = ctx.createGain();
        const lfo = ctx.createOscillator();
        lfo.frequency.value = p.tremolo.rate;
        const depth = ctx.createGain();
        depth.gain.value = p.tremolo.depth * 0.5;
        trem.gain.value = 1 - p.tremolo.depth * 0.5;
        lfo.connect(depth).connect(trem.gain);
        out.connect(trem);
        out = trem;
        lfo.start(t);
        lfo.stop(end);
      }
      this.into(out);
      const vIndex = 0.5 + e.vel * 0.7;
      const carriers = p.chorus && !e.lite ? [-1, 1] : [0];
      const nodes: OscillatorNode[] = [];
      for (const side of carriers) {
        const car = ctx.createOscillator();
        car.frequency.value = f;
        car.detune.value = side * (p.chorus ?? 0) * 0.5;
        const mod = ctx.createOscillator();
        mod.frequency.value = f * p.ratio;
        const depth = ctx.createGain();
        const top = f * p.index * vIndex;
        depth.gain.setValueAtTime(top, t);
        depth.gain.setTargetAtTime(top * (p.indexSustain ?? 0.1), t, Math.max(0.005, p.indexDecay) / 3);
        mod.connect(depth).connect(car.frequency);
        nodes.push(car, mod);
        if (p.ratio2) {
          const mod2 = ctx.createOscillator();
          mod2.frequency.value = f * p.ratio2;
          const d2 = ctx.createGain();
          d2.gain.setValueAtTime(f * (p.index2 ?? 1) * vIndex, t);
          d2.gain.setTargetAtTime(0, t, Math.max(0.005, p.indexDecay) / 5);
          mod2.connect(d2).connect(car.frequency);
          nodes.push(mod2);
        }
        let c: AudioNode = car;
        if (side) {
          const pan = ctx.createStereoPanner();
          pan.pan.value = side * Math.min(1, 0.5 + e.width * 0.3);
          const half = ctx.createGain();
          half.gain.value = 0.7;
          car.connect(half).connect(pan);
          c = pan;
        }
        c.connect(amp);
      }
      for (const o of nodes) {
        o.start(t);
        o.stop(end);
      }
    });
  }
}

// ---------------------------------------------------------------- drums

/** 808-style metallic partials for hats. */
const HAT_RATIOS = [1, 1.4471, 1.617, 1.9265, 2.5028, 2.6637];
const hatCache = new Map<string, AudioBuffer>();

export class DrumVoice extends PatchVoice {
  private readonly shaper: Tone.WaveShaper;
  private readonly lowCut = new Tone.Filter({ type: 'highpass', frequency: 26, rolloff: -24 });
  constructor(private readonly p: DrumPatch) {
    super();
    this.shaper = new Tone.WaveShaper(driveCurve(p.drive ?? 0), 4096);
    this.shaper.oversample = '2x';
    this.shaper.chain(this.lowCut, this.output);
  }
  play(e: PlayEvent): void {
    const p = this.p;
    const v = Math.pow(e.vel, 1.3) * (p.gain ?? 1);
    const decayMul = (e.art && p.arts?.[e.art]) || 1;
    switch (p.kind) {
      case 'kick':
        return this.kick(e.time, v, decayMul);
      case 'clap':
        return this.clap(e.time, v, decayMul);
      case 'hat':
        return this.hat(e.time, v, decayMul, e.mod);
      case 'snare':
        return this.snare(e.time, v, decayMul);
      case 'tom':
        return this.tom(e.time, v, decayMul, e.notes[0]);
      case 'rim':
        return this.rim(e.time, v);
      case 'noiseHit':
        return this.noiseHit(e.time, v, decayMul);
    }
  }
  private kick(t: number, v: number, dm: number): void {
    const ctx = this.ctx;
    const p = this.p;
    const f0 = p.pitch ?? 50;
    const decay = (p.decay ?? 0.42) * dm;
    const hold = 0.026;
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(f0 * (p.sweep ?? 6.5), t);
    osc.frequency.exponentialRampToValueAtTime(f0 * 1.6, t + 0.018);
    osc.frequency.exponentialRampToValueAtTime(f0, t + 0.07);
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(v, t + 0.0012);
    amp.gain.setValueAtTime(v, t + hold);
    amp.gain.setTargetAtTime(0, t + hold, decay / 5);
    osc.connect(amp);
    this.into(amp, this.shaper);
    osc.start(t);
    osc.stop(t + hold + decay * 1.4);
    // Click: a short band of noise for the beater.
    const click = ctx.createBufferSource();
    click.buffer = noise(ctx);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 3800;
    bp.Q.value = 0.9;
    const ca = ctx.createGain();
    ca.gain.setValueAtTime(v * (p.click ?? 0.5), t);
    ca.gain.setTargetAtTime(0, t, 0.0035);
    click.connect(bp).connect(ca);
    this.into(ca, this.lowCut);
    click.start(t, Math.random());
    click.stop(t + 0.03);
  }
  private burst(t: number, level: number, freq: number, q: number, decay: number, dest: Tone.ToneAudioNode, type: BiquadFilterType = 'bandpass'): void {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = noise(ctx);
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const a = ctx.createGain();
    a.gain.setValueAtTime(0, t);
    a.gain.linearRampToValueAtTime(level, t + 0.0008);
    a.gain.setTargetAtTime(0, t + 0.001, decay / 4);
    src.connect(f).connect(a);
    this.into(a, dest);
    src.start(t, Math.random() * 1.5);
    src.stop(t + decay * 1.5 + 0.02);
  }
  private clap(t: number, v: number, dm: number): void {
    const tone = this.p.tone ?? 1200;
    // Three quick slaps, then the room.
    [0, 0.011, 0.023].forEach((d, i) => this.burst(t + d, v * (i === 2 ? 1 : 0.75), tone * (1 + i * 0.08), 1.4, 0.012, this.shaper));
    this.burst(t + 0.03, v * 0.85, tone, 0.9, (this.p.decay ?? 0.22) * dm, this.shaper);
  }
  /** Metallic hat: six square partials plus noise, high-passed. Rendered once per sound and cached (cheap to play). */
  private hatBuffer(decay: number): AudioBuffer {
    const key = `${this.p.pitch ?? 320}|${decay.toFixed(3)}|${this.p.tone ?? 7200}`;
    let buf = hatCache.get(key);
    if (buf && buf.sampleRate === this.ctx.sampleRate) return buf;
    const sr = this.ctx.sampleRate;
    const len = Math.floor(sr * (decay * 1.8 + 0.02));
    buf = this.ctx.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    const base = this.p.pitch ?? 320;
    const tau = decay / 4;
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      let m = 0;
      for (const r of HAT_RATIOS) m += Math.sin(2 * Math.PI * base * r * t) >= 0 ? 1 : -1;
      const env = Math.min(1, t / 0.0007) * Math.exp(-t / tau);
      d[i] = (m * 0.1 + (Math.random() * 2 - 1) * 0.45) * env;
    }
    // Two passes of a one-pole high-pass at the tone frequency.
    const a = Math.exp((-2 * Math.PI * (this.p.tone ?? 7200)) / sr);
    for (let pass = 0; pass < 2; pass++) {
      let prevX = 0;
      let prevY = 0;
      for (let i = 0; i < len; i++) {
        const x = d[i]!;
        const y = a * (prevY + x - prevX);
        prevX = x;
        prevY = y;
        d[i] = y;
      }
    }
    let peak = 0;
    for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(d[i]!));
    if (peak > 0) for (let i = 0; i < len; i++) d[i]! /= peak;
    hatCache.set(key, buf);
    return buf;
  }
  private hat(t: number, v: number, dm: number, mod: number): void {
    const src = this.ctx.createBufferSource();
    src.buffer = this.hatBuffer((this.p.decay ?? 0.045) * dm);
    src.playbackRate.value = 1 + (mod - 0.5) * 0.04;
    const g = this.ctx.createGain();
    g.gain.value = v * 0.6;
    src.connect(g);
    this.into(g, this.lowCut);
    src.start(t);
  }
  private snare(t: number, v: number, dm: number): void {
    const ctx = this.ctx;
    const f = this.p.pitch ?? 190;
    for (const [mul, lvl] of [[1, 0.6], [1.7, 0.3]] as const) {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.setValueAtTime(f * mul * 1.5, t);
      o.frequency.exponentialRampToValueAtTime(f * mul, t + 0.03);
      const a = ctx.createGain();
      a.gain.setValueAtTime(v * lvl, t);
      a.gain.setTargetAtTime(0, t, 0.03 * dm);
      o.connect(a);
      this.into(a, this.shaper);
      o.start(t);
      o.stop(t + 0.3 * dm);
    }
    this.burst(t, v * 0.7, this.p.tone ?? 4200, 0.6, (this.p.decay ?? 0.16) * dm, this.shaper);
  }
  private tom(t: number, v: number, dm: number, note?: number): void {
    const ctx = this.ctx;
    const f = note ? midiToFreq(note) : (this.p.pitch ?? 110);
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(f * (this.p.sweep ?? 1.6), t);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.05);
    const a = ctx.createGain();
    a.gain.setValueAtTime(0, t);
    a.gain.linearRampToValueAtTime(v, t + 0.002);
    a.gain.setTargetAtTime(0, t + 0.01, ((this.p.decay ?? 0.3) * dm) / 4);
    o.connect(a);
    this.into(a, this.shaper);
    o.start(t);
    o.stop(t + (this.p.decay ?? 0.3) * dm * 1.6);
  }
  private rim(t: number, v: number): void {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.value = this.p.pitch ?? 1700;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = this.p.tone ?? 2200;
    bp.Q.value = 3;
    const a = ctx.createGain();
    a.gain.setValueAtTime(v * 0.6, t);
    a.gain.setTargetAtTime(0, t, 0.008);
    o.connect(bp).connect(a);
    this.into(a, this.shaper);
    o.start(t);
    o.stop(t + 0.06);
  }
  private noiseHit(t: number, v: number, dm: number): void {
    this.burst(t, v * 0.6, this.p.tone ?? 6000, 1.2, (this.p.decay ?? 0.05) * dm, this.lowCut);
  }
  override dispose(): void {
    this.shaper.dispose();
    this.lowCut.dispose();
    super.dispose();
  }
}

// ---------------------------------------------------------------- formant

const VOWELS: Record<string, readonly [number, number, number]> = {
  a: [800, 1150, 2900],
  e: [450, 1900, 2600],
  i: [320, 2300, 3000],
  o: [480, 820, 2800],
  u: [330, 720, 2500],
};

export class FormantVoice extends PatchVoice {
  private count = 0;
  private lastFreq: number | null = null;
  constructor(private readonly p: FormantPatch) {
    super();
  }
  play(e: PlayEvent): void {
    const ctx = this.ctx;
    const p = this.p;
    const vowel = VOWELS[e.art ?? p.vowels[this.count++ % p.vowels.length]!] ?? VOWELS.a!;
    for (const midi of e.notes) {
      const t = e.time;
      const f = midiToFreq(midi);
      const amp = ctx.createGain();
      const end = adsr(amp.gain, p.amp, Math.pow(e.vel, 1.2) * (p.gain ?? 0.6), t, e.hold);
      this.into(amp);
      const bus = ctx.createGain();
      vowel.forEach((fr, i) => {
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = fr * (1 + (e.mod - 0.5) * 0.08);
        bp.Q.value = 7 + i * 3;
        const g = ctx.createGain();
        g.gain.value = [1.6, 0.9, 0.5][i]!;
        bus.connect(bp).connect(g).connect(amp);
      });
      const nodes: AudioScheduledSourceNode[] = [];
      for (const det of e.lite ? [0] : [-6, 6]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        if (e.slide && this.lastFreq && p.glide) {
          o.frequency.setValueAtTime(this.lastFreq, t);
          o.frequency.exponentialRampToValueAtTime(f, t + p.glide);
        } else o.frequency.value = f;
        o.detune.value = det;
        if (p.vibrato) {
          const lfo = ctx.createOscillator();
          lfo.frequency.value = p.vibrato.rate;
          const vg = ctx.createGain();
          vg.gain.setValueAtTime(0, t);
          vg.gain.linearRampToValueAtTime(p.vibrato.cents, t + p.vibrato.delay + 0.2);
          lfo.connect(vg).connect(o.detune);
          nodes.push(lfo);
        }
        o.connect(bus);
        nodes.push(o);
      }
      if (p.breath) {
        const n = ctx.createBufferSource();
        n.buffer = noise(ctx);
        const g = ctx.createGain();
        g.gain.value = p.breath;
        n.connect(g).connect(bus);
        nodes.push(n);
      }
      for (const nd of nodes) {
        nd.start(t);
        nd.stop(end);
      }
      this.lastFreq = f;
    }
  }
}

export function createVoice(p: Patch): PatchVoice {
  switch (p.type) {
    case 'sampler':
      return new SamplerVoice(p);
    case 'synth':
      return new SynthVoice(p);
    case 'fm':
      return new FmVoice(p);
    case 'drum':
      return new DrumVoice(p);
    case 'formant':
      return new FormantVoice(p);
  }
}
