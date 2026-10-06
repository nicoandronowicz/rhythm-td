/**
 * Rim/perc perk: an 808-style rim, two short tuned tones plus a click. Tuned by the music module
 * (the key's fifth), so it sits on every chord.
 */

import type { Tuning } from '../../config/tuning';
import { midiToFreq, percNote } from '../../music/theory';
import { noiseBuffer, Voice, type HitContext } from '../voice';

export class RimVoice extends Voice {
  trigger(time: number, hit: HitContext, t: Readonly<Tuning>): void {
    const ctx = this.ctx();
    const decay = t.rim.decay;
    const v = hit.velocity;
    const f = midiToFreq(percNote());
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0, time);
    amp.gain.linearRampToValueAtTime(v * 0.6, time + 0.001);
    amp.gain.setTargetAtTime(0, time + 0.002, decay / 4);
    for (const [mult, type] of [
      [1, 'triangle'],
      [0.5, 'sine'],
    ] as const) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f * mult;
      o.connect(amp);
      o.start(time);
      o.stop(time + decay * 2 + 0.02);
    }
    const click = ctx.createBufferSource();
    click.buffer = noiseBuffer(ctx);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 4000;
    const clickAmp = ctx.createGain();
    clickAmp.gain.setValueAtTime(v * 0.5, time);
    clickAmp.gain.setTargetAtTime(0, time + 0.0005, 0.003);
    click.connect(hp).connect(clickAmp).connect(amp);
    click.start(time, Math.random() * 0.5);
    click.stop(time + 0.03);
    this.into(amp, this.output);
  }
}
