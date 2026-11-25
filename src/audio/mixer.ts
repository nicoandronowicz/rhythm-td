/**
 * Mixer: one channel per instrument (drums and towers), shared room reverb and ping-pong delay,
 * and the master bus.
 *
 *   voice -> bitcrush (Static) -> wobbling low-pass (Muffler) -> presence low-pass + volume -> pump -> channel -> bus
 *   drums and pad: bus = core bus (low-pass + volume: rests between waves) -> master
 *   towers: bus = master; channel -> sends -> room / delay -> master
 *   fx (risers, impacts): own channel -> master and room
 *   atmosphere: noise floor and vinyl crackle -> master
 *   master: volume -> low cut -> tape -> glue compressor -> limiter -> safety clipper -> speakers
 *
 * Enemy inserts are neutral until something attacks; presence is how close a tower sounds
 * (open while fighting, quiet and filtered in the distance when idle). Changes are scheduled
 * at transport times handed in by the engine.
 */

import * as Tone from 'tone';
import type { Tuning } from '../config/tuning';
import { INSTRUMENTS, isCoreInstrument, type InstrumentId } from '../game/instruments';
import { dbToGain, driveCurve, safetyCurve } from './curves';

const OPEN = 20000;

export class LayerChannel {
  readonly input = new Tone.Gain(1);
  readonly crusher = new Tone.BitCrusher(5);
  readonly muffle = new Tone.Filter({ type: 'lowpass', frequency: OPEN, rolloff: -24, Q: 0.7 });
  /** Muffler wobble, an 8th-note LFO on the muffle filter. Flat (min = max = open) when nothing muffles. */
  private readonly wobble = new Tone.LFO({ frequency: '8n', min: OPEN, max: OPEN });
  readonly presence = new Tone.Filter({ type: 'lowpass', frequency: OPEN, rolloff: -12, Q: 0.6 });
  readonly presenceVolume = new Tone.Volume(0);
  /** Sidechain pump: dips on each kick when the combo is on. */
  readonly pump = new Tone.Gain(1);
  /** Fader. A plain Volume, not Tone.Channel: Tone.Channel's panner sums its input to mono. */
  readonly channel = new Tone.Volume(0);
  /** Balance that keeps stereo sources (wide stabs, the pad) stereo. */
  readonly panner = new Tone.Panner({ pan: 0, channelCount: 2 });

  constructor(destination: Tone.ToneAudioNode) {
    this.crusher.wet.value = 0;
    this.wobble.connect(this.muffle.frequency);
    this.wobble.sync().start(0);
    this.input.chain(this.crusher, this.muffle, this.presence, this.presenceVolume, this.pump, this.channel, this.panner, destination);
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

  /** Duck on a kick and swell back: the classic house pump. */
  duck(depthDb: number, release: number, time: number): void {
    const g = this.pump.gain;
    g.cancelScheduledValues(time);
    g.setValueAtTime(Math.pow(10, depthDb / 20), time + 0.004);
    g.setTargetAtTime(1, time + 0.012, release / 3);
  }

  /** How close the layer sounds. */
  setPresence(cutoff: number, db: number, ramp: number, time: number): void {
    this.presence.frequency.cancelScheduledValues(time);
    this.presence.frequency.exponentialRampTo(Math.min(Math.max(cutoff, 60), OPEN), ramp, time);
    this.presenceVolume.volume.cancelScheduledValues(time);
    this.presenceVolume.volume.rampTo(db, ramp, time);
  }

  dispose(): void {
    for (const n of [this.input, this.crusher, this.muffle, this.wobble, this.presence, this.presenceVolume, this.pump, this.channel, this.panner]) n.dispose();
  }
}

type Bus = 'room' | 'delay';

/** Which channel sends where, and which tuning value sets the level (dB). */
const SENDS: { from: InstrumentId; to: Bus; level: (t: Readonly<Tuning>) => number }[] = [
  { from: 'clap', to: 'room', level: (t) => t.sends.clapRoom },
  { from: 'chords', to: 'room', level: (t) => t.sends.chordsRoom },
  { from: 'chords', to: 'delay', level: (t) => t.sends.chordsDelay },
  { from: 'arp', to: 'room', level: (t) => t.sends.arpRoom },
  { from: 'arp', to: 'delay', level: (t) => t.sends.arpDelay },
  { from: 'lead', to: 'room', level: (t) => t.sends.leadRoom },
  { from: 'lead', to: 'delay', level: (t) => t.sends.leadDelay },
  { from: 'pad', to: 'room', level: (t) => t.pad.room },
];

/** Vinyl crackle: a few seconds of sparse clicks, looped. */
function crackleBuffer(ctx: BaseAudioContext): AudioBuffer {
  const seconds = 5;
  const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) {
    if (Math.random() < 0.0009) {
      const amp = (Math.random() * 0.8 + 0.2) * (Math.random() < 0.5 ? -1 : 1);
      // A tiny click: a few samples decaying fast.
      for (let k = 0; k < 24 && i + k < d.length; k++) d[i + k]! += amp * Math.exp(-k / 4);
    }
  }
  return buf;
}

/** Fixed stereo positions. Small, so laptop speakers still hear everything. */
// Kick, bass, clap and lead stay centred; percussion is spread left and right around them.
const PAN: Partial<Record<InstrumentId, keyof Tuning['hats'] | number>> = {
  hats: 'pan',
  openhat: 0.32,
  shaker: -0.38,
  rim: -0.24,
  arp: -0.18,
};

export class Mixer {
  readonly master = new Tone.Volume(0);
  private readonly lowCut = new Tone.Filter({ type: 'highpass', frequency: 24, rolloff: -24 });
  private readonly glue = new Tone.Compressor({ threshold: -12, ratio: 2, attack: 0.015, release: 0.16, knee: 6 });
  private readonly limiter = new Tone.Limiter(-2.5);
  /** Rounds off anything the limiter lets through, so nothing hard-clips. */
  private readonly safety = new Tone.WaveShaper(safetyCurve, 8192);

  private readonly roomIn = new Tone.Filter({ type: 'highpass', frequency: 350, rolloff: -12 });
  private readonly reverb = new Tone.Reverb({ decay: 1.1, preDelay: 0.008, wet: 1 });
  private readonly roomReturn = new Tone.Volume(0);

  private readonly delayIn = new Tone.Filter({ type: 'bandpass', frequency: 1800, Q: 0.4 });
  private readonly delay = new Tone.PingPongDelay({ delayTime: 0.36, feedback: 0.3, wet: 1 });
  private readonly delayReturn = new Tone.Volume(0);

  /** The core's drums go through here: it rests (low-passed, quieter) between waves. */
  private readonly coreFilter = new Tone.Filter({ type: 'lowpass', frequency: OPEN, rolloff: -24, Q: 0.8 });
  private readonly coreVolume = new Tone.Volume(0);

  private readonly sendGains: { gain: Tone.Gain; from: InstrumentId; to: Bus; level: (t: Readonly<Tuning>) => number }[] = [];
  readonly layers: Record<InstrumentId, LayerChannel>;

  /** Risers, impacts and downlifters. */
  readonly fx = new Tone.Volume(0);
  private readonly fxRoom = new Tone.Gain(0.35);
  private readonly tape = new Tone.WaveShaper(driveCurve(0), 4096);
  private readonly noiseFloor = new Tone.Noise('pink');
  private readonly noiseBand = new Tone.Filter({ type: 'bandpass', frequency: 1800, Q: 0.3 });
  private readonly noiseVolume = new Tone.Volume(-60);
  private crackle: Tone.Player | null = null;
  private readonly crackleFilter = new Tone.Filter({ type: 'highpass', frequency: 1200 });
  private readonly crackleVolume = new Tone.Volume(-60);
  private lastT: Readonly<Tuning>;

  constructor(t: Readonly<Tuning>) {
    this.lastT = t;
    this.safety.oversample = '4x';
    this.tape.oversample = '2x';
    this.master.chain(this.lowCut, this.tape, this.glue, this.limiter, this.safety, Tone.getDestination());
    this.roomIn.chain(this.reverb, this.roomReturn, this.master);
    this.delayIn.chain(this.delay, this.delayReturn, this.master);

    this.coreFilter.chain(this.coreVolume, this.master);
    this.layers = Object.fromEntries(
      INSTRUMENTS.map((id) => [id, new LayerChannel(isCoreInstrument(id) ? this.coreFilter : this.master)]),
    ) as Record<InstrumentId, LayerChannel>;
    for (const s of SENDS) {
      const gain = new Tone.Gain(0);
      this.layers[s.from].panner.connect(gain);
      gain.connect(s.to === 'room' ? this.roomIn : this.delayIn);
      this.sendGains.push({ gain, ...s });
    }
    this.fx.connect(this.master);
    this.fx.chain(this.fxRoom, this.roomIn);

    // Atmosphere: always on, very quiet, under everything.
    this.noiseFloor.chain(this.noiseBand, this.noiseVolume, this.master);
    this.noiseFloor.start();
    const raw = Tone.getContext().rawContext as unknown as BaseAudioContext;
    this.crackle = new Tone.Player({ url: new Tone.ToneAudioBuffer(crackleBuffer(raw)), loop: true });
    this.crackle.chain(this.crackleFilter, this.crackleVolume, this.master);
    this.crackle.start();
    this.applyTuning(t);
  }

  /** Back to a clean slate for a new run: full volume, core resting, no pumps or damage. */
  reset(t: Readonly<Tuning>): void {
    const now = Tone.now();
    this.master.volume.cancelScheduledValues(now);
    this.master.volume.rampTo(t.mix.master, 0.05, now);
    this.setCore(t.core.restCutoff, t.core.restVolume, 0.02, now);
    for (const id of INSTRUMENTS) {
      const layer = this.layers[id];
      layer.pump.gain.cancelScheduledValues(now);
      layer.pump.gain.setValueAtTime(1, now);
      layer.setDamage(0, 0, now, t);
    }
  }

  /** Delay throw: push one hit much harder into the delay, then back. */
  throwDelay(id: InstrumentId, extraDb: number, time: number, seconds: number): void {
    for (const s of this.sendGains) {
      if (s.from !== id || s.to !== 'delay') continue;
      const base = s.level(this.lastT) <= -60 ? 0 : dbToGain(s.level(this.lastT));
      const g = s.gain.gain;
      g.cancelScheduledValues(time);
      g.setValueAtTime(base * dbToGain(extraDb), time);
      g.setValueAtTime(base, time + seconds);
    }
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
    this.lastT = t;
    this.master.volume.value = t.mix.master;
    this.fx.volume.value = t.mix.fx;
    this.tape.setMap(driveCurve(Math.min(Math.max(t.atmo.tape, 0), 1)));
    this.noiseVolume.volume.value = t.atmo.noise <= -60 ? -120 : t.atmo.noise;
    this.crackleVolume.volume.value = t.atmo.crackle <= -60 ? -120 : t.atmo.crackle;
    this.roomReturn.volume.value = t.mix.room;
    this.delayReturn.volume.value = t.mix.delay;
    this.delay.feedback.value = Math.min(Math.max(t.sends.delayFeedback, 0), 0.9);
    for (const id of INSTRUMENTS) this.layers[id].channel.volume.value = t.mix[id];
    for (const [id, pan] of Object.entries(PAN) as [InstrumentId, keyof Tuning['hats'] | number][]) {
      this.layers[id].panner.pan.value = typeof pan === 'number' ? pan : t.hats[pan];
    }
    for (const s of this.sendGains) s.gain.gain.value = s.level(t) <= -60 ? 0 : dbToGain(s.level(t));
    this.setTempo(t.transport.bpm);
  }
}
