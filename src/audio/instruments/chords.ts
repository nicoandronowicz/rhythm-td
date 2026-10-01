/**
 * House chord stab: two detuned saws per chord tone through a low-pass that snaps shut,
 * with a soft organ (sine + octave) layer underneath for body. Short and percussive.
 * Notes come from the music module's voicing for the current bar.
 */

import * as Tone from 'tone';
import type { Tuning } from '../../config/tuning';
import { chordVoicing, midiToFreq } from '../../music/theory';
import { dbToGain, Voice, type HitContext } from '../voice';

export class ChordsVoice extends Voice {
  /** Keeps the stab out of the bass's way. */
  private readonly lowCut = new Tone.Filter({ type: 'highpass', frequency: 170, rolloff: -12 });

  constructor() {
    super();
    this.lowCut.connect(this.output);
  }

  trigger(time: number, hit: HitContext, t: Readonly<Tuning>): void {
    const ctx = this.ctx();
    const c = t.chords;
    const notes = chordVoicing(hit.bar);
    const v = hit.velocity;
    const end = time + c.decay * 2 + 0.05;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 1.2;
    lp.frequency.setValueAtTime(c.tone, time);
    lp.frequency.setTargetAtTime(c.body, time + 0.005, c.decay / 3);

    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0, time);
    amp.gain.linearRampToValueAtTime(v, time + 0.003);
    amp.gain.setTargetAtTime(0, time + 0.012, c.decay / 4);

    const sawLevel = ctx.createGain();
    sawLevel.gain.value = 0.9 / notes.length;
    const organLevel = ctx.createGain();
    organLevel.gain.value = (dbToGain(c.organ) * 1.2) / notes.length;
    sawLevel.connect(lp);
    organLevel.connect(lp);
    lp.connect(amp);
    this.into(amp, this.lowCut);

    for (const n of notes) {
      const f = midiToFreq(n);
      for (const cents of [-c.detune / 2, c.detune / 2]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = f;
        o.detune.value = cents;
        o.connect(sawLevel);
        o.start(time);
        o.stop(end);
      }
      for (const [mult, level] of [
        [1, 1],
        [2, 0.5],
      ] as const) {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = f * mult;
        const g = ctx.createGain();
        g.gain.value = level;
        o.connect(g).connect(organLevel);
        o.start(time);
        o.stop(end);
      }
    }
  }

  override dispose(): void {
    this.lowCut.dispose();
    super.dispose();
  }
}
