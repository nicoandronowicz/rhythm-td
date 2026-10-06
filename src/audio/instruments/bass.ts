/**
 * House offbeat bass, two layers:
 *  - sub: clean sine on the chord root, for headphones and real speakers.
 *  - mid: saw + square an octave up, through a plucked resonant low-pass, then saturation.
 *    Laptop speakers can't reproduce the root, so this layer is what they play; the ear
 *    fills in the fundamental from its harmonics.
 */

import * as Tone from 'tone';
import type { Tuning } from '../../config/tuning';
import { bassLayerNotes, midiToFreq } from '../../music/theory';
import { dbToGain, driveCurve, Voice, type HitContext } from '../voice';

export class BassVoice extends Voice {
  private readonly midBus = new Tone.Gain(1);
  private readonly shaper = new Tone.WaveShaper(driveCurve(0), 4096);
  private readonly midHighpass = new Tone.Filter({ type: 'highpass', frequency: 100, rolloff: -12 });

  constructor(t: Readonly<Tuning>) {
    super();
    this.shaper.oversample = '4x';
    this.midBus.chain(this.shaper, this.midHighpass, this.output);
    this.applyTuning(t);
  }

  override applyTuning(t: Readonly<Tuning>): void {
    this.shaper.setMap(driveCurve(t.bass.drive));
    this.midHighpass.frequency.value = t.bass.midLowCut;
  }

  trigger(time: number, hit: HitContext, t: Readonly<Tuning>): void {
    const ctx = this.ctx();
    const b = t.bass;
    const v = hit.velocity;
    const notes = bassLayerNotes(hit.chord, hit.kind === 'octave');
    const subFreq = midiToFreq(notes.sub);
    const midFreq = midiToFreq(notes.mid);
    const dur = b.length * hit.sixteenth;
    const release = 0.03;
    const end = time + dur + release * 6;

    // Mid layer.
    const saw = ctx.createOscillator();
    saw.type = 'sawtooth';
    saw.frequency.value = midFreq;
    const square = ctx.createOscillator();
    square.type = 'square';
    square.frequency.value = midFreq;
    const squareLevel = ctx.createGain();
    squareLevel.gain.value = 0.3;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = b.resonance;
    const peak = Math.min(b.cutoff * Math.pow(2, b.envelope), 16000);
    lp.frequency.setValueAtTime(peak, time);
    lp.frequency.setTargetAtTime(b.cutoff, time, b.pluck / 3);

    const midAmp = ctx.createGain();
    envelope(midAmp.gain, time, dur, release, v * dbToGain(b.mid));

    saw.connect(lp);
    square.connect(squareLevel).connect(lp);
    lp.connect(midAmp);
    this.into(midAmp, this.midBus);

    // Sub layer.
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.value = subFreq;
    const subAmp = ctx.createGain();
    envelope(subAmp.gain, time, dur, release, v * dbToGain(b.sub));
    sub.connect(subAmp);
    this.into(subAmp, this.output);

    for (const o of [saw, square, sub]) {
      o.start(time);
      o.stop(end);
    }
  }

  override dispose(): void {
    this.midBus.dispose();
    this.shaper.dispose();
    this.midHighpass.dispose();
    super.dispose();
  }
}

/** Short attack, hold for the note length, quick release. No clicks. */
function envelope(g: AudioParam, time: number, dur: number, release: number, level: number): void {
  g.setValueAtTime(0, time);
  g.linearRampToValueAtTime(level, time + 0.004);
  g.setTargetAtTime(level * 0.75, time + 0.004, 0.08);
  g.setTargetAtTime(0, time + dur, release);
}
