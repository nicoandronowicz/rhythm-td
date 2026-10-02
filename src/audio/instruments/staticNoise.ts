/**
 * Static damage you can hear: a short burst of crackly, band-limited noise riding on each hit of an
 * attacked tower. Level is set by how much Static the tower has taken, capped by tuning.
 */

import { noiseBuffer, Voice, type HitContext } from '../voice';
import type { Tuning } from '../../config/tuning';

export class StaticNoiseVoice extends Voice {
  trigger(time: number, hit: HitContext, _t: Readonly<Tuning>): void {
    const ctx = this.ctx();
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1800;
    const amp = ctx.createGain();
    const v = hit.velocity;
    // Crackle: a few uneven spikes, not a smooth hiss.
    amp.gain.setValueAtTime(0, time);
    for (let i = 0; i < 4; i++) {
      const at = time + i * 0.011 + Math.random() * 0.006;
      amp.gain.setValueAtTime(v * (0.5 + Math.random() * 0.5), at);
      amp.gain.setTargetAtTime(0, at + 0.001, 0.004);
    }
    src.connect(hp).connect(amp);
    this.into(amp, this.output);
    src.start(time, Math.random() * 0.5);
    src.stop(time + 0.08);
  }
}
