/**
 * Pluck lead: two detuned saws plus a quiet square an octave down, through a low-pass that
 * falls from bright to warm. Plays the curated pentatonic hook from the music module.
 */

import * as Tone from 'tone';
import type { Tuning } from '../../config/tuning';
import { leadNote, midiToFreq } from '../../music/theory';
import { Voice, type HitContext } from '../voice';

export class LeadVoice extends Voice {
  private readonly lowCut = new Tone.Filter({ type: 'highpass', frequency: 200, rolloff: -12 });

  constructor() {
    super();
    this.lowCut.connect(this.output);
  }

  trigger(time: number, hit: HitContext, t: Readonly<Tuning>): void {
    const ctx = this.ctx();
    const l = t.lead;
    const f = midiToFreq(leadNote(hit.bar, hit.hitIndex));
    const v = hit.velocity;
    const end = time + l.decay * 2.5 + 0.05;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 2;
    lp.frequency.setValueAtTime(l.tone, time);
    lp.frequency.setTargetAtTime(Math.max(f * 2, 600), time + 0.004, l.decay / 2.5);

    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0, time);
    amp.gain.linearRampToValueAtTime(v * 0.5, time + 0.004);
    amp.gain.setTargetAtTime(v * 0.32, time + 0.004, 0.05);
    amp.gain.setTargetAtTime(0, time + l.decay * 0.5, l.decay / 4);

    const oscs: OscillatorNode[] = [];
    for (const cents of [-l.detune / 2, l.detune / 2]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.detune.value = cents;
      o.connect(lp);
      oscs.push(o);
    }
    const sub = ctx.createOscillator();
    sub.type = 'square';
    sub.frequency.value = f / 2;
    const subLevel = ctx.createGain();
    subLevel.gain.value = 0.25;
    sub.connect(subLevel).connect(lp);
    oscs.push(sub);

    lp.connect(amp);
    this.into(amp, this.lowCut);
    for (const o of oscs) {
      o.start(time);
      o.stop(end);
    }
  }

  override dispose(): void {
    this.lowCut.dispose();
    super.dispose();
  }
}
