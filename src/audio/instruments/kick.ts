/**
 * House kick: a sine tuned to the key with a fast pitch drop, a short noise click on top,
 * then soft saturation so the body has harmonics small speakers can reproduce.
 */

import * as Tone from 'tone';
import type { Tuning } from '../../config/tuning';
import { kickNote, midiToFreq } from '../../music/theory';
import { dbToGain, driveCurve, noiseBuffer, Voice, type HitContext } from '../voice';

/** Full-level hold before the body starts to decay, seconds. Gives the punch. */
const HOLD = 0.028;

export class KickVoice extends Voice {
  private readonly shaper = new Tone.WaveShaper(driveCurve(0), 4096);
  private readonly lowCut = new Tone.Filter({ type: 'highpass', frequency: 28, rolloff: -24 });
  private readonly body = new Tone.Gain(1);

  constructor(t: Readonly<Tuning>) {
    super();
    this.shaper.oversample = '4x';
    this.body.chain(this.shaper, this.lowCut, this.output);
    this.applyTuning(t);
  }

  override applyTuning(t: Readonly<Tuning>): void {
    this.shaper.setMap(driveCurve(t.kick.drive));
  }

  trigger(time: number, hit: HitContext, t: Readonly<Tuning>): void {
    const ctx = this.ctx();
    const k = t.kick;
    const v = hit.velocity;
    const f0 = midiToFreq(kickNote());
    const end = time + HOLD + k.decay * 1.3;

    // Body.
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(f0 * Math.pow(2, k.sweep), time);
    osc.frequency.exponentialRampToValueAtTime(f0, time + k.sweepTime);

    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0, time);
    amp.gain.linearRampToValueAtTime(v, time + 0.0015);
    amp.gain.setValueAtTime(v, time + HOLD);
    amp.gain.setTargetAtTime(0, time + HOLD, k.decay / 5);

    osc.connect(amp);
    this.into(amp, this.body);
    osc.start(time);
    osc.stop(end);

    // Click.
    const click = ctx.createBufferSource();
    click.buffer = noiseBuffer(ctx);
    const clickFilter = ctx.createBiquadFilter();
    clickFilter.type = 'bandpass';
    clickFilter.frequency.value = 3200;
    clickFilter.Q.value = 0.8;
    const clickAmp = ctx.createGain();
    const cl = v * dbToGain(k.click) * 2;
    clickAmp.gain.setValueAtTime(0, time);
    clickAmp.gain.linearRampToValueAtTime(cl, time + 0.0005);
    clickAmp.gain.setTargetAtTime(0, time + 0.0005, 0.003);
    click.connect(clickFilter).connect(clickAmp);
    this.into(clickAmp, this.lowCut);
    click.start(time, Math.random() * 0.5);
    click.stop(time + 0.04);
  }

  override dispose(): void {
    this.shaper.dispose();
    this.lowCut.dispose();
    this.body.dispose();
    super.dispose();
  }
}
