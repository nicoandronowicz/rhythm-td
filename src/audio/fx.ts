/**
 * Transitions, the moments that make an arrangement sound produced:
 *  - build: noise riser + a snare roll that speeds up (8ths -> 16ths -> 32nds) + a reversed cymbal
 *    swelling into the downbeat
 *  - impact: sub boom + a cymbal crash on the first beat of a wave or a Lift
 *  - downlifter: noise sweeping down when a wave is cleared
 * The engine calls these at transport times.
 */

import * as Tone from 'tone';
import { group, reverseOf } from './bank';

let noiseBuf: AudioBuffer | null = null;
function noise(ctx: BaseAudioContext): AudioBuffer {
  if (!noiseBuf || noiseBuf.sampleRate !== ctx.sampleRate) {
    noiseBuf = ctx.createBuffer(2, ctx.sampleRate * 2, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = noiseBuf.getChannelData(c);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
  }
  return noiseBuf;
}

export class TransitionFx {
  readonly output = new Tone.Gain(1);
  private readonly ctx = Tone.getContext().rawContext as unknown as BaseAudioContext;

  private into(node: AudioNode): void {
    Tone.connect(node as unknown as Tone.OutputNode, this.output);
  }

  private noiseSrc(time: number, seconds: number): AudioBufferSourceNode {
    const src = this.ctx.createBufferSource();
    src.buffer = noise(this.ctx);
    src.loop = true;
    src.start(time, Math.random());
    src.stop(time + seconds);
    return src;
  }

  /** Build-up over `seconds` ending on the next downbeat. `step` is seconds per 16th. */
  build(time: number, seconds: number, step: number, roll = true): void {
    const ctx = this.ctx;
    const end = time + seconds;
    // Riser.
    const src = this.noiseSrc(time, seconds + 0.05);
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.Q.value = 2.2;
    band.frequency.setValueAtTime(300, time);
    band.frequency.exponentialRampToValueAtTime(9500, end);
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.0001, time);
    amp.gain.exponentialRampToValueAtTime(0.5, end - 0.01);
    amp.gain.linearRampToValueAtTime(0, end);
    src.connect(band).connect(amp);
    this.into(amp);

    // Snare roll speeding up, getting louder and brighter.
    if (roll) {
      let t = time;
      while (t < end - 0.005) {
        const k = (t - time) / seconds;
        const gap = k < 0.5 ? step * 2 : k < 0.8 ? step : step / 2;
        this.snareTick(t, 0.08 + 0.42 * k * k, 900 + 2600 * k);
        t += gap;
      }
    }

    // Reversed cymbal swelling into the downbeat.
    const hats = group('hihat');
    const open = hats?.arts.get('open')?.[0];
    if (open) {
      const rev = reverseOf(open);
      const s = ctx.createBufferSource();
      s.buffer = rev;
      s.playbackRate.value = 0.75;
      const dur = rev.duration / 0.75;
      const g = ctx.createGain();
      g.gain.value = 0.55;
      s.connect(g);
      this.into(g);
      s.start(Math.max(time, end - dur));
    }
  }

  private snareTick(t: number, level: number, tone: number): void {
    const ctx = this.ctx;
    const src = this.noiseSrc(t, 0.12);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = tone;
    bp.Q.value = 0.8;
    const a = ctx.createGain();
    a.gain.setValueAtTime(0, t);
    a.gain.linearRampToValueAtTime(level, t + 0.001);
    a.gain.setTargetAtTime(0, t + 0.002, 0.025);
    src.connect(bp).connect(a);
    this.into(a);
    const body = ctx.createOscillator();
    body.type = 'triangle';
    body.frequency.setValueAtTime(260, t);
    body.frequency.exponentialRampToValueAtTime(180, t + 0.03);
    const ba = ctx.createGain();
    ba.gain.setValueAtTime(level * 0.5, t);
    ba.gain.setTargetAtTime(0, t, 0.02);
    body.connect(ba);
    this.into(ba);
    body.start(t);
    body.stop(t + 0.12);
  }

  impact(time: number, big = true): void {
    const ctx = this.ctx;
    const boom = ctx.createOscillator();
    boom.frequency.setValueAtTime(78, time);
    boom.frequency.exponentialRampToValueAtTime(32, time + 0.8);
    const ba = ctx.createGain();
    ba.gain.setValueAtTime(0, time);
    ba.gain.linearRampToValueAtTime(big ? 0.75 : 0.45, time + 0.004);
    ba.gain.setTargetAtTime(0, time + 0.02, 0.3);
    boom.connect(ba);
    this.into(ba);
    boom.start(time);
    boom.stop(time + 2);
    // Crash: the open hat sample slowed down, plus a noise wash.
    const open = group('hihat')?.arts.get('open')?.[1] ?? group('hihat')?.arts.get('open')?.[0];
    if (open) {
      const s = ctx.createBufferSource();
      s.buffer = open;
      s.playbackRate.value = 0.62;
      const g = ctx.createGain();
      g.gain.value = big ? 0.6 : 0.35;
      s.connect(g);
      this.into(g);
      s.start(time);
    }
    const src = this.noiseSrc(time, 2.4);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(6500, time);
    lp.frequency.exponentialRampToValueAtTime(500, time + 2);
    const a = ctx.createGain();
    a.gain.setValueAtTime(big ? 0.28 : 0.15, time);
    a.gain.setTargetAtTime(0, time + 0.01, 0.45);
    src.connect(lp).connect(a);
    this.into(a);
  }

  downlifter(time: number, seconds: number): void {
    const ctx = this.ctx;
    const src = this.noiseSrc(time, seconds + 0.1);
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.Q.value = 2.5;
    band.frequency.setValueAtTime(7000, time);
    band.frequency.exponentialRampToValueAtTime(220, time + seconds);
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.35, time);
    amp.gain.exponentialRampToValueAtTime(0.0001, time + seconds);
    src.connect(band).connect(amp);
    this.into(amp);
  }

  /** A short burst of crackle riding on an attacked tower's hit (Static). */
  crackle(time: number, level: number, dest: Tone.ToneAudioNode): void {
    const ctx = this.ctx;
    const src = this.noiseSrc(time, 0.08);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1800;
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0, time);
    for (let i = 0; i < 4; i++) {
      const at = time + i * 0.011 + Math.random() * 0.006;
      amp.gain.setValueAtTime(level * (0.5 + Math.random() * 0.5), at);
      amp.gain.setTargetAtTime(0, at + 0.001, 0.004);
    }
    src.connect(hp).connect(amp);
    Tone.connect(amp as unknown as Tone.OutputNode, dest);
  }
}
