/**
 * Transition effects: the things that make sections feel produced.
 *  - riser: filtered noise sweeping up over the bar before a wave (or a Lift)
 *  - impact: a sub boom and a soft noise crash on the first beat of a wave
 *  - downlifter: noise sweeping down when a wave is cleared
 * Not triggered by the world's hits; the engine calls these at transport times.
 */

import { noiseBuffer, Voice, type HitContext } from '../voice';
import type { Tuning } from '../../config/tuning';

export class FxVoice extends Voice {
  trigger(_time: number, _hit: HitContext, _t: Readonly<Tuning>): void {}

  riser(time: number, seconds: number): void {
    const ctx = this.ctx();
    const src = this.noise(time, seconds + 0.1);
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.Q.value = 3;
    band.frequency.setValueAtTime(350, time);
    band.frequency.exponentialRampToValueAtTime(9000, time + seconds);
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.0001, time);
    amp.gain.exponentialRampToValueAtTime(0.55, time + seconds);
    amp.gain.setValueAtTime(0, time + seconds + 0.005);
    src.connect(band).connect(amp);
    this.into(amp, this.output);
  }

  impact(time: number): void {
    const ctx = this.ctx();
    const boom = ctx.createOscillator();
    boom.type = 'sine';
    boom.frequency.setValueAtTime(72, time);
    boom.frequency.exponentialRampToValueAtTime(30, time + 0.7);
    const boomAmp = ctx.createGain();
    boomAmp.gain.setValueAtTime(0, time);
    boomAmp.gain.linearRampToValueAtTime(0.7, time + 0.005);
    boomAmp.gain.setTargetAtTime(0, time + 0.02, 0.28);
    boom.connect(boomAmp);
    this.into(boomAmp, this.output);
    boom.start(time);
    boom.stop(time + 1.8);

    const src = this.noise(time, 2);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(5000, time);
    lp.frequency.exponentialRampToValueAtTime(600, time + 1.5);
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.35, time);
    amp.gain.setTargetAtTime(0, time + 0.01, 0.35);
    src.connect(lp).connect(amp);
    this.into(amp, this.output);
  }

  downlifter(time: number, seconds: number): void {
    const ctx = this.ctx();
    const src = this.noise(time, seconds + 0.1);
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.Q.value = 2.5;
    band.frequency.setValueAtTime(7000, time);
    band.frequency.exponentialRampToValueAtTime(250, time + seconds);
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.4, time);
    amp.gain.exponentialRampToValueAtTime(0.0001, time + seconds);
    src.connect(band).connect(amp);
    this.into(amp, this.output);
  }

  private noise(time: number, seconds: number): AudioBufferSourceNode {
    const ctx = this.ctx();
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx);
    src.loop = true;
    src.start(time, Math.random() * 0.5);
    src.stop(time + seconds);
    return src;
  }
}
