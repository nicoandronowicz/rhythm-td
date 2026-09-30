/**
 * Mixer: one channel per tower type, a shared room reverb, and the master bus.
 *
 *   voice -> [bitcrush (dry)] -> [low-pass (open)] -> channel (volume, pan) -> master
 *   master: volume -> low cut -> glue compressor -> limiter -> safety clipper -> speakers
 *
 * The bitcrush and low-pass inserts are neutral for now; enemies will drive them later.
 */

import * as Tone from 'tone';
import type { Tuning } from '../config/tuning';
import { TOWER_TYPES, type TowerType } from '../game/towers';
import { safetyCurve } from './curves';

export class LayerChannel {
  readonly input = new Tone.Gain(1);
  readonly crusher = new Tone.BitCrusher(16);
  readonly lowpass = new Tone.Filter({ type: 'lowpass', frequency: 20000, rolloff: -24, Q: 0.5 });
  readonly channel = new Tone.Channel();

  constructor(destination: Tone.ToneAudioNode) {
    this.crusher.wet.value = 0;
    this.input.chain(this.crusher, this.lowpass, this.channel, destination);
  }

  dispose(): void {
    for (const n of [this.input, this.crusher, this.lowpass, this.channel]) n.dispose();
  }
}

export class Mixer {
  readonly master = new Tone.Volume(0);
  private readonly lowCut = new Tone.Filter({ type: 'highpass', frequency: 24, rolloff: -24 });
  private readonly glue = new Tone.Compressor({ threshold: -12, ratio: 2, attack: 0.015, release: 0.16, knee: 6 });
  private readonly limiter = new Tone.Limiter(-1.5);
  /** Transparent below -1.5 dBFS, rounds off anything the limiter lets through. Never hard-clips. */
  private readonly safety = new Tone.WaveShaper(safetyCurve, 8192);
  private readonly reverb = new Tone.Reverb({ decay: 0.9, preDelay: 0.008, wet: 1 });
  private readonly reverbLowCut = new Tone.Filter({ type: 'highpass', frequency: 350, rolloff: -12 });
  private readonly roomReturn = new Tone.Channel();
  /** Post-fader send from the clap channel into the room. */
  private readonly clapSend = new Tone.Gain(0, 'decibels');
  readonly layers: Record<TowerType, LayerChannel>;

  constructor(t: Readonly<Tuning>) {
    this.safety.oversample = '4x';
    this.master.chain(this.lowCut, this.glue, this.limiter, this.safety, Tone.getDestination());
    this.reverbLowCut.chain(this.reverb, this.roomReturn, this.master);

    this.layers = Object.fromEntries(TOWER_TYPES.map((type) => [type, new LayerChannel(this.master)])) as Record<
      TowerType,
      LayerChannel
    >;
    this.layers.clap.channel.chain(this.clapSend, this.reverbLowCut);
    this.applyTuning(t);
  }

  /** Wait for the reverb impulse to be generated. */
  ready(): Promise<void> {
    return this.reverb.ready;
  }

  applyTuning(t: Readonly<Tuning>): void {
    this.master.volume.value = t.mix.master;
    this.roomReturn.volume.value = t.mix.room;
    for (const type of TOWER_TYPES) this.layers[type].channel.volume.value = t.mix[type];
    this.layers.hats.channel.pan.value = t.hats.pan;
    this.clapSend.gain.value = t.clap.roomSend;
  }
}

