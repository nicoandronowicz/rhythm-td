/**
 * Mixer: one channel per instrument (drums and towers), shared room reverb and ping-pong delay,
 * and the master bus.
 *
 *   voice -> bitcrush (Static) -> wobbling low-pass (Muffler) -> presence low-pass + volume -> channel -> bus
 *   drums: bus = core bus (low-pass + volume: rests between waves) -> master
 *   towers: bus = master; channel -> sends -> room / delay -> master
 *   master: volume -> low cut -> glue compressor -> limiter -> safety clipper -> speakers
 *
 * Enemy inserts are neutral until something attacks; presence is how close a tower sounds
 * (open while fighting, quiet and filtered in the distance when idle). Changes are scheduled
 * at transport times handed in by the engine.
 */

import * as Tone from 'tone';
import type { Tuning } from '../config/tuning';
import { DRUM_DEFS } from '../game/core';
import { INSTRUMENTS, type InstrumentId } from '../game/instruments';
import { dbToGain, safetyCurve } from './curves';

const OPEN = 20000;

export class LayerChannel {
  readonly input = new Tone.Gain(1);
  readonly crusher = new Tone.BitCrusher(5);
  readonly muffle = new Tone.Filter({ type: 'lowpass', frequency: OPEN, rolloff: -24, Q: 0.7 });
  /** Muffler wobble, an 8th-note LFO on the muffle filter. Flat (min = max = open) when nothing muffles. */
  private readonly wobble = new Tone.LFO({ frequency: '8n', min: OPEN, max: OPEN });
  readonly presence = new Tone.Filter({ type: 'lowpass', frequency: OPEN, rolloff: -12, Q: 0.6 });
  readonly presenceVolume = new Tone.Volume(0);
  readonly channel = new Tone.Channel();

  constructor(destination: Tone.ToneAudioNode) {
    this.crusher.wet.value = 0;
    this.wobble.connect(this.muffle.frequency);
    this.wobble.sync().start(0);
    this.input.chain(this.crusher, this.muffle, this.presence, this.presenceVolume, this.channel, destination);
  }

  /** Static noise/crush and Muffler muffling, both 0..1, with hard caps from tuning. */
  setDamage(staticLevel: number, muffleLevel: number, time: number, t: Readonly<Tuning>): void {
    this.crusher.wet.rampTo(Math.min(Math.max(staticLevel, 0), 1) * Math.min(t.fx.maxCrush, 1), 0.05, time);
    const m = Math.min(Math.max(muffleLevel, 0), 1);
    const floor = Math.max(t.fx.muffleFloor, 20);
    const center = OPEN * Math.pow(floor / OPEN, m);
    const half = Math.pow(2, (t.fx.wobble * m) / 2);
    this.wobble.min = Math.max(floor, center / half);
    this.wobble.max = Math.min(OPEN, center * half);
    this.muffle.Q.rampTo(0.7 + 5 * m, 0.05, time);
  }

  /** How close the layer sounds. */
  setPresence(cutoff: number, db: number, ramp: number, time: number): void {
    this.presence.frequency.cancelScheduledValues(time);
    this.presence.frequency.exponentialRampTo(Math.min(Math.max(cutoff, 60), OPEN), ramp, time);
    this.presenceVolume.volume.cancelScheduledValues(time);
    this.presenceVolume.volume.rampTo(db, ramp, time);
  }

  dispose(): void {
    for (const n of [this.input, this.crusher, this.muffle, this.wobble, this.presence, this.presenceVolume, this.channel]) n.dispose();
  }
}

type Bus = 'room' | 'delay';

/** Which channel sends where, and which tuning value sets the level. */
const SENDS: { from: InstrumentId; to: Bus; level: keyof Tuning['sends'] }[] = [
  { from: 'clap', to: 'room', level: 'clapRoom' },
  { from: 'chords', to: 'room', level: 'chordsRoom' },
  { from: 'chords', to: 'delay', level: 'chordsDelay' },
  { from: 'arp', to: 'room', level: 'arpRoom' },
  { from: 'arp', to: 'delay', level: 'arpDelay' },
  { from: 'lead', to: 'room', level: 'leadRoom' },
  { from: 'lead', to: 'delay', level: 'leadDelay' },
];

/** Fixed stereo positions. Small, so laptop speakers still hear everything. */
const PAN: Partial<Record<InstrumentId, keyof Tuning['hats'] | number>> = { hats: 'pan', arp: -0.12, chords: 0.08 };

export class Mixer {
  readonly master = new Tone.Volume(0);
  private readonly lowCut = new Tone.Filter({ type: 'highpass', frequency: 24, rolloff: -24 });
  private readonly glue = new Tone.Compressor({ threshold: -12, ratio: 2, attack: 0.015, release: 0.16, knee: 6 });
  private readonly limiter = new Tone.Limiter(-1.5);
  /** Transparent below -1.5 dBFS, rounds off anything the limiter lets through. Never hard-clips. */
  private readonly safety = new Tone.WaveShaper(safetyCurve, 8192);

  private readonly roomIn = new Tone.Filter({ type: 'highpass', frequency: 350, rolloff: -12 });
  private readonly reverb = new Tone.Reverb({ decay: 1.1, preDelay: 0.008, wet: 1 });
  private readonly roomReturn = new Tone.Channel();

  private readonly delayIn = new Tone.Filter({ type: 'bandpass', frequency: 1800, Q: 0.4 });
  private readonly delay = new Tone.PingPongDelay({ delayTime: 0.36, feedback: 0.3, wet: 1 });
  private readonly delayReturn = new Tone.Channel();

  /** The core's drums go through here: it rests (low-passed, quieter) between waves. */
  private readonly coreFilter = new Tone.Filter({ type: 'lowpass', frequency: OPEN, rolloff: -24, Q: 0.8 });
  private readonly coreVolume = new Tone.Volume(0);

  private readonly sendGains: { gain: Tone.Gain; level: keyof Tuning['sends'] }[] = [];
  readonly layers: Record<InstrumentId, LayerChannel>;

  constructor(t: Readonly<Tuning>) {
    this.safety.oversample = '4x';
    this.master.chain(this.lowCut, this.glue, this.limiter, this.safety, Tone.getDestination());
    this.roomIn.chain(this.reverb, this.roomReturn, this.master);
    this.delayIn.chain(this.delay, this.delayReturn, this.master);

    this.coreFilter.chain(this.coreVolume, this.master);
    this.layers = Object.fromEntries(
      INSTRUMENTS.map((id) => [id, new LayerChannel(id in DRUM_DEFS ? this.coreFilter : this.master)]),
    ) as Record<InstrumentId, LayerChannel>;
    for (const s of SENDS) {
      const gain = new Tone.Gain(0);
      this.layers[s.from].channel.connect(gain);
      gain.connect(s.to === 'room' ? this.roomIn : this.delayIn);
      this.sendGains.push({ gain, level: s.level });
    }
    this.applyTuning(t);
  }

  /** Wait for the reverb impulse to be generated. */
  ready(): Promise<void> {
    return this.reverb.ready;
  }

  /** Move the core toward a filter and volume over `ramp` seconds, starting at `time`. */
  setCore(cutoff: number, db: number, ramp: number, time: number): void {
    this.coreFilter.frequency.cancelScheduledValues(time);
    this.coreFilter.frequency.exponentialRampTo(Math.min(Math.max(cutoff, 60), OPEN), ramp, time);
    this.coreVolume.volume.cancelScheduledValues(time);
    this.coreVolume.volume.rampTo(db, ramp, time);
  }

  /** Fade everything out (game over). */
  fadeOut(seconds: number, time: number): void {
    this.master.volume.cancelScheduledValues(time);
    this.master.volume.rampTo(-80, seconds, time);
  }

  /** Keep the delay on a dotted 8th. */
  setTempo(bpm: number): void {
    this.delay.delayTime.rampTo((60 / bpm) * 0.75, 0.05);
  }

  applyTuning(t: Readonly<Tuning>): void {
    this.master.volume.value = t.mix.master;
    this.roomReturn.volume.value = t.mix.room;
    this.delayReturn.volume.value = t.mix.delay;
    this.delay.feedback.value = Math.min(Math.max(t.sends.delayFeedback, 0), 0.9);
    for (const id of INSTRUMENTS) this.layers[id].channel.volume.value = t.mix[id];
    for (const [id, pan] of Object.entries(PAN) as [InstrumentId, keyof Tuning['hats'] | number][]) {
      this.layers[id].channel.pan.value = typeof pan === 'number' ? pan : t.hats[pan];
    }
    for (const s of this.sendGains) s.gain.gain.value = t.sends[s.level] <= -60 ? 0 : dbToGain(t.sends[s.level]);
    this.setTempo(t.transport.bpm);
  }
}
