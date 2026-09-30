/**
 * Hats: white noise plus the classic 808 six-square-oscillator "metal", high-passed, short envelope.
 * Velocity wobbles a little each hit so the offbeats breathe.
 */

import type { Tuning } from '../../config/tuning';
import { dbToGain, noiseBuffer, Voice, type HitContext } from '../voice';

/** TR-808 cymbal/hat oscillator frequencies, Hz. Unpitched by design (they're inharmonic). */
const METAL_FREQS = [205.3, 304.4, 369.6, 522.7, 540, 800];

export class HatsVoice extends Voice {
  constructor() {
    super();
  }

  trigger(time: number, hit: HitContext, t: Readonly<Tuning>): void {
    const ctx = this.ctx();
    const h = t.hats;
    const jitter = t.velocity.hatJitter;
    const v = hit.velocity * (1 - jitter * Math.random());
    const end = time + h.decay * 1.8 + 0.01;

    const sum = ctx.createGain();

    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer(ctx);
    const noiseLevel = ctx.createGain();
    noiseLevel.gain.value = 0.7;
    noise.connect(noiseLevel).connect(sum);
    noise.start(time, Math.random() * 0.5);
    noise.stop(end);

    const metalLevel = ctx.createGain();
    metalLevel.gain.value = dbToGain(h.metal) * 1.5;
    metalLevel.connect(sum);
    for (const f of METAL_FREQS) {
      const o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = f * 2;
      o.connect(metalLevel);
      o.start(time);
      o.stop(end);
    }

    const shape = ctx.createBiquadFilter();
    shape.type = 'bandpass';
    shape.frequency.value = 10500;
    shape.Q.value = 0.6;

    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = h.tone;
    hp.Q.value = 0.9;

    const vca = ctx.createGain();
    vca.gain.setValueAtTime(0, time);
    vca.gain.linearRampToValueAtTime(v * 2.4, time + 0.0012);
    vca.gain.setTargetAtTime(0, time + 0.0012, h.decay / 4.6);

    sum.connect(shape).connect(hp).connect(vca);
    this.into(vca, this.output);
  }
}
