/** Shaker perk: soft band-passed noise with a slow-ish attack, so the 16ths feel shaken, not ticked. */

import type { Tuning } from '../../config/tuning';
import { noiseBuffer, Voice, type HitContext } from '../voice';

export class ShakerVoice extends Voice {
  trigger(time: number, hit: HitContext, t: Readonly<Tuning>): void {
    const ctx = this.ctx();
    const s = t.shaker;
    const v = hit.velocity * (0.9 + Math.random() * 0.2);
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx);
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = s.tone;
    band.Q.value = 1.4;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 3500;
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0, time);
    amp.gain.linearRampToValueAtTime(v * 2.2, time + 0.008);
    amp.gain.setTargetAtTime(0, time + 0.008, s.decay / 3);
    src.connect(band).connect(hp).connect(amp);
    this.into(amp, this.output);
    src.start(time, Math.random() * 0.5);
    src.stop(time + s.decay * 3 + 0.02);
  }
}
