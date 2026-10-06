/**
 * Arp pluck: a square and a saw an octave apart through a resonant low-pass that closes fast.
 * Each hit climbs the current chord (music module), the delay send does the rest.
 */

import * as Tone from 'tone';
import type { Tuning } from '../../config/tuning';
import { arpNote, arpStyleForWave, midiToFreq } from '../../music/theory';
import { Voice, type HitContext } from '../voice';

export class ArpVoice extends Voice {
  private readonly lowCut = new Tone.Filter({ type: 'highpass', frequency: 220, rolloff: -12 });

  constructor() {
    super();
    this.lowCut.connect(this.output);
  }

  trigger(time: number, hit: HitContext, t: Readonly<Tuning>): void {
    const ctx = this.ctx();
    const a = t.arp;
    const f = midiToFreq(arpNote(hit.chord, hit.hitIndex, arpStyleForWave(hit.wave)));
    const v = hit.velocity;
    const end = time + a.decay * 2.5 + 0.03;

    const sq = ctx.createOscillator();
    sq.type = 'square';
    sq.frequency.value = f;
    const saw = ctx.createOscillator();
    saw.type = 'sawtooth';
    saw.frequency.value = f * 2;
    const sawLevel = ctx.createGain();
    sawLevel.gain.value = 0.35;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = a.resonance;
    lp.frequency.setValueAtTime(a.tone, time);
    lp.frequency.setTargetAtTime(Math.max(f * 1.5, 300), time + 0.002, a.decay / 3);

    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0, time);
    amp.gain.linearRampToValueAtTime(v * 0.55, time + 0.002);
    amp.gain.setTargetAtTime(0, time + 0.006, a.decay / 3);

    sq.connect(lp);
    saw.connect(sawLevel).connect(lp);
    lp.connect(amp);
    this.into(amp, this.lowCut);
    for (const o of [sq, saw]) {
      o.start(time);
      o.stop(end);
    }
  }

  override dispose(): void {
    this.lowCut.dispose();
    super.dispose();
  }
}
