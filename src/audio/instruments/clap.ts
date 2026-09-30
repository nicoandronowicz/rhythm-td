/**
 * 909-style clap: band-passed noise hit three times a few ms apart (the "hands"),
 * then a longer decaying tail. A thinner, higher band on top adds snap.
 */

import type { Tuning } from '../../config/tuning';
import { noiseBuffer, Voice, type HitContext } from '../voice';

/** Relative level of each of the three hand hits. */
const HANDS = [0.85, 0.7, 0.8];

export class ClapVoice extends Voice {
  constructor() {
    super();
  }

  trigger(time: number, hit: HitContext, t: Readonly<Tuning>): void {
    const ctx = this.ctx();
    const c = t.clap;
    const v = hit.velocity;

    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx);

    const low = ctx.createBiquadFilter();
    low.type = 'highpass';
    low.frequency.value = 450;

    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = c.tone;
    band.Q.value = 1.1;

    const snap = ctx.createBiquadFilter();
    snap.type = 'bandpass';
    snap.frequency.value = c.tone * 2.3;
    snap.Q.value = 1.4;
    const snapLevel = ctx.createGain();
    snapLevel.gain.value = 0.45;

    const vca = ctx.createGain();
    const g = vca.gain;
    g.setValueAtTime(0, time);
    let at = time;
    HANDS.forEach((level, i) => {
      // Slightly uneven gaps sound like hands, not a machine.
      at = time + i * c.spread * (1 + (Math.random() - 0.5) * 0.25);
      g.setValueAtTime(v * level, at);
      g.setTargetAtTime(0, at + 0.0004, c.spread * 0.28);
    });
    const tailAt = at + c.spread;
    g.setValueAtTime(v * 0.72, tailAt);
    g.setTargetAtTime(0, tailAt + 0.0004, c.tail / 4.6);

    src.connect(low);
    low.connect(band).connect(vca);
    low.connect(snap).connect(snapLevel).connect(vca);
    // Bandpass loses a lot of level; bring it back up.
    const makeup = ctx.createGain();
    makeup.gain.value = 3.2;
    vca.connect(makeup);
    this.into(makeup, this.output);

    src.start(time, Math.random() * 0.4);
    src.stop(tailAt + c.tail * 1.6);
  }
}
