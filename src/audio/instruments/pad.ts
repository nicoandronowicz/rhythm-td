/**
 * The core's pad: an open chord voicing played by three detuned saws per note, spread across the
 * stereo field, through a soft low-pass that drifts slowly. Fades in, holds for the chord, and
 * releases into the next one, so the harmony is always there under the track.
 */

import type { Tuning } from '../../config/tuning';
import { midiToFreq, padVoicing } from '../../music/theory';
import { Voice, type HitContext } from '../voice';

const RELEASE = 1.4;

export class PadVoice extends Voice {
  trigger(time: number, hit: HitContext, t: Readonly<Tuning>): void {
    const ctx = this.ctx();
    const p = t.pad;
    const bars = hit.sustainBars ?? 2;
    const hold = bars * 16 * hit.sixteenth;
    const end = time + hold + RELEASE * 2;
    const width = Math.min(1, 0.55 + (hit.width ?? 0) * 0.4);

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 0.7;
    lp.frequency.value = p.tone;
    // A slow drift on the filter, so the pad breathes.
    const drift = ctx.createOscillator();
    drift.frequency.value = 0.11 + Math.random() * 0.06;
    const driftDepth = ctx.createGain();
    driftDepth.gain.value = p.tone * 0.25;
    drift.connect(driftDepth).connect(lp.frequency);

    const amp = ctx.createGain();
    const level = hit.velocity * 0.55;
    amp.gain.setValueAtTime(0, time);
    amp.gain.linearRampToValueAtTime(level, time + Math.max(0.05, p.attack));
    amp.gain.setValueAtTime(level, time + hold);
    amp.gain.setTargetAtTime(0, time + hold, RELEASE / 3);
    lp.connect(amp);
    this.into(amp, this.output);

    const oscs: OscillatorNode[] = [drift];
    for (const note of padVoicing(hit.chord)) {
      const f = midiToFreq(note);
      [-1, 0, 1].forEach((k) => {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = f;
        o.detune.value = k * p.spread + (Math.random() - 0.5) * 3;
        const pan = ctx.createStereoPanner();
        pan.pan.value = k * width;
        const g = ctx.createGain();
        g.gain.value = k === 0 ? 0.5 : 0.35;
        o.connect(g).connect(pan).connect(lp);
        oscs.push(o);
      });
    }
    for (const o of oscs) {
      o.start(time);
      o.stop(end);
    }
  }
}
