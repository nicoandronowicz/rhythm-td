/**
 * Mixer: one channel per layer of the current song (its core layers, the pad, the four tower roles),
 * three shared effects (short room, long hall, tempo delay), the core bus and the master bus.
 *
 *   voice -> bitcrush (Static) -> wobbling low-pass (Muffler) -> presence low-pass + volume -> colour
 *         -> pump -> fader -> pan -> bus
 *   core layers and pad: bus = core bus (low-pass + volume: rests between waves) -> master
 *   towers: bus = master. Every channel can send to room, hall and delay.
 *   fx (risers, impacts): own channel -> master and hall
 *   atmosphere: noise floor and vinyl crackle -> master
 *   master: volume -> low cut -> tape -> glue compressor -> limiter -> safety clipper -> speakers
 *
 * Enemy inserts are neutral until something attacks; presence is how close a tower sounds.
 * Changes are scheduled at transport times handed in by the engine.
 */

import * as Tone from 'tone';
import type { Tuning } from '../config/tuning';
import type { Mods } from '../game/rewards';
import { TOWER_ROLES } from '../music/compose';
import type { SongDef } from '../music/song';
import { dbToGain, driveCurve, safetyCurve } from './curves';

const OPEN = 20000;

/** A 5-bit staircase: the Static crush, as a cheap native wave shaper. */
function crushCurve(): Float32Array {
  const n = 4096;
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    c[i] = Math.round(x * 15) / 15;
  }
  return c;
}

/**
 * One mixer channel. Tower channels (`full`) carry the enemy effects and presence filter:
 *   input -> dry/crushed mix (Static) -> wobbling low-pass (Muffler) -> presence low-pass + volume -> colour -> pump -> fader -> pan
 * Core and pad channels are light (enemies never touch them): input -> volume -> pump -> fader -> pan.
 */
export class LayerChannel {
  readonly input = new Tone.Gain(1);
  private readonly dry: Tone.Gain | null = null;
  private readonly wet: Tone.Gain | null = null;
  private readonly crusher: Tone.WaveShaper | null = null;
  private readonly muffle: Tone.Filter | null = null;
  /** Muffler wobble, an 8th-note LFO on the muffle filter. Flat (min = max = open) when nothing muffles. */
  private readonly wobble: Tone.LFO | null = null;
  private readonly presence: Tone.Filter | null = null;
  readonly presenceVolume = new Tone.Volume(0);
  /** Extra saturation (the Saturation reward). */
  readonly colour: Tone.WaveShaper | null = null;
  readonly pump = new Tone.Gain(1);
  readonly fader = new Tone.Volume(0);
  readonly panner = new Tone.Panner({ pan: 0, channelCount: 2 });

  constructor(destination: Tone.ToneAudioNode, full: boolean) {
    if (full) {
      this.dry = new Tone.Gain(1);
      this.wet = new Tone.Gain(0);
      this.crusher = new Tone.WaveShaper(crushCurve());
      this.muffle = new Tone.Filter({ type: 'lowpass', frequency: OPEN, rolloff: -24, Q: 0.7 });
      this.wobble = new Tone.LFO({ frequency: '8n', min: OPEN, max: OPEN });
      this.presence = new Tone.Filter({ type: 'lowpass', frequency: OPEN, rolloff: -12, Q: 0.6 });
      this.colour = new Tone.WaveShaper(driveCurve(0), 2048);
      this.wobble.connect(this.muffle.frequency);
      this.wobble.sync().start(0);
      this.input.fan(this.dry, this.crusher);
      this.crusher.connect(this.wet);
      this.dry.connect(this.muffle);
      this.wet.connect(this.muffle);
      this.muffle.chain(this.presence, this.presenceVolume, this.colour, this.pump, this.fader, this.panner, destination);
    } else {
      this.input.chain(this.presenceVolume, this.pump, this.fader, this.panner, destination);
    }
  }

  /** Static noise/crush and Muffler muffling, both 0..1, with hard caps from tuning. */
  setDamage(staticLevel: number, muffleLevel: number, time: number, t: Readonly<Tuning>): void {
    if (!this.dry || !this.wet || !this.muffle || !this.wobble) return;
    const crush = Math.min(Math.max(staticLevel, 0), 1) * Math.min(t.fx.maxCrush, 1);
    this.wet.gain.rampTo(crush, 0.05, time);
    this.dry.gain.rampTo(1 - crush, 0.05, time);
    const m = Math.min(Math.max(muffleLevel, 0), 1);
    const floor = Math.max(t.fx.muffleFloor, 20);
    const center = OPEN * Math.pow(floor / OPEN, m);
    const half = Math.pow(2, (t.fx.wobble * m) / 2);
    this.wobble.min = Math.max(floor, center / half);
    this.wobble.max = Math.min(OPEN, center * half);
    this.muffle.Q.rampTo(0.7 + 5 * m, 0.05, time);
  }

  /** Duck and swell back: the house pump. */
  duck(depthDb: number, release: number, time: number): void {
    if (depthDb >= -0.1) return;
    const g = this.pump.gain;
    g.cancelScheduledValues(time);
    g.setValueAtTime(dbToGain(depthDb), time + 0.003);
    g.setTargetAtTime(1, time + 0.01, release / 3);
  }

  /** How close the layer sounds (light channels: volume only). */
  setPresence(cutoff: number, db: number, ramp: number, time: number): void {
    if (this.presence) {
      this.presence.frequency.cancelScheduledValues(time);
      this.presence.frequency.exponentialRampTo(Math.min(Math.max(cutoff, 60), OPEN), ramp, time);
    }
    this.presenceVolume.volume.cancelScheduledValues(time);
    this.presenceVolume.volume.rampTo(db, ramp, time);
  }

  dispose(): void {
    for (const n of [this.input, this.dry, this.wet, this.crusher, this.muffle, this.wobble, this.presence, this.presenceVolume, this.colour, this.pump, this.fader, this.panner]) n?.dispose();
  }
}

type Bus = 'room' | 'hall' | 'delay';

/**
 * A reverb impulse: early reflections, then stereo noise decaying by 60 dB over `seconds` and getting
 * darker as it fades (high frequencies die first, like a real room). `damp` 0..1 = how fast it darkens.
 */
function impulse(seconds: number, preDelay: number, damp: number): AudioBuffer {
  const ctx = Tone.getContext().rawContext as unknown as BaseAudioContext;
  const sr = ctx.sampleRate;
  const len = Math.floor(sr * (seconds + preDelay + 0.05));
  const buf = ctx.createBuffer(2, len, sr);
  const start = Math.floor(sr * preDelay);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    let lp = 0;
    for (let i = start; i < len; i++) {
      const t = (i - start) / sr;
      const env = Math.exp((-6.9 * t) / seconds);
      // Low-pass coefficient falls over time: bright onset, dark tail.
      const a = Math.max(0.04, Math.exp(-t * (1 + damp * 6)) * 0.9);
      lp += (Math.random() * 2 - 1 - lp) * a;
      d[i] = lp * env;
    }
    // Early reflections: a few sparse taps in the first 60 ms, different per side.
    for (let k = 0; k < 7; k++) {
      const at = start + Math.floor(sr * (0.006 + Math.random() * 0.055));
      if (at < len) d[at]! += (Math.random() < 0.5 ? -1 : 1) * (0.5 - k * 0.05);
    }
  }
  return buf;
}

/** Vinyl crackle: a few seconds of sparse clicks, looped. */
function crackleBuffer(ctx: BaseAudioContext): AudioBuffer {
  const seconds = 5;
  const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) {
    if (Math.random() < 0.0009) {
      const amp = (Math.random() * 0.8 + 0.2) * (Math.random() < 0.5 ? -1 : 1);
      for (let k = 0; k < 24 && i + k < d.length; k++) d[i + k]! += amp * Math.exp(-k / 4);
    }
  }
  return buf;
}

export class Mixer {
  readonly master = new Tone.Volume(0);
  private readonly lowCut = new Tone.Filter({ type: 'highpass', frequency: 24, rolloff: -24 });
  /** Darkens the whole mix (game over tape stop). */
  private readonly masterTone = new Tone.Filter({ type: 'lowpass', frequency: OPEN, rolloff: -12 });
  private readonly glue = new Tone.Compressor({ threshold: -14, ratio: 2, attack: 0.02, release: 0.18, knee: 8 });
  private readonly limiter = new Tone.Limiter(-2);
  private readonly safety = new Tone.WaveShaper(safetyCurve, 8192);
  private readonly tape = new Tone.WaveShaper(driveCurve(0), 4096);

  private readonly roomIn = new Tone.Filter({ type: 'highpass', frequency: 300, rolloff: -12 });
  private readonly room = new Tone.Convolver({ normalize: true });
  private readonly roomReturn = new Tone.Volume(0);

  private readonly hallIn = new Tone.Filter({ type: 'highpass', frequency: 280, rolloff: -12 });
  private readonly hallTone = new Tone.Filter({ type: 'lowpass', frequency: 7500, rolloff: -12 });
  private readonly hall = new Tone.Convolver({ normalize: true });
  private readonly hallWidth = new Tone.StereoWidener(0.7);
  private readonly hallReturn = new Tone.Volume(0);

  private readonly delayIn = new Tone.Filter({ type: 'bandpass', frequency: 1600, Q: 0.35 });
  private readonly delay = new Tone.PingPongDelay({ delayTime: 0.36, feedback: 0.35, wet: 1 });
  private readonly delayTone = new Tone.Filter({ type: 'lowpass', frequency: 5200, rolloff: -12 });
  private readonly delayReturn = new Tone.Volume(0);

  /** The core goes through here: it rests (low-passed, quieter) between waves. */
  private readonly coreFilter = new Tone.Filter({ type: 'lowpass', frequency: OPEN, rolloff: -24, Q: 0.8 });
  private readonly coreVolume = new Tone.Volume(0);
  private readonly coreTrim = new Tone.Volume(0);

  readonly fx = new Tone.Volume(0);
  private readonly fxHall = new Tone.Gain(0.4);
  private readonly noiseFloor = new Tone.Noise('pink');
  private readonly noiseBand = new Tone.Filter({ type: 'bandpass', frequency: 1800, Q: 0.3 });
  private readonly noiseVolume = new Tone.Volume(-80);
  private readonly crackle: Tone.Player;
  private readonly crackleFilter = new Tone.Filter({ type: 'highpass', frequency: 1200 });
  private readonly crackleVolume = new Tone.Volume(-80);

  private layerMap = new Map<string, LayerChannel>();
  private sendGains: { from: string; to: Bus; gain: Tone.Gain; db: number }[] = [];
  private song: SongDef | null = null;
  private hallSeconds = 0;

  constructor() {
    this.safety.oversample = '2x';
    this.tape.oversample = '2x';
    this.master.chain(this.lowCut, this.masterTone, this.tape, this.glue, this.limiter, this.safety, Tone.getDestination());
    this.roomIn.chain(this.room, this.roomReturn, this.master);
    this.hallIn.chain(this.hallTone, this.hall, this.hallWidth, this.hallReturn, this.master);
    this.delayIn.chain(this.delay, this.delayTone, this.delayReturn, this.master);
    this.coreFilter.chain(this.coreVolume, this.coreTrim, this.master);
    this.fx.connect(this.master);
    this.fx.chain(this.fxHall, this.hallIn);

    this.noiseFloor.chain(this.noiseBand, this.noiseVolume, this.master);
    this.noiseFloor.start();
    const raw = Tone.getContext().rawContext as unknown as BaseAudioContext;
    this.crackle = new Tone.Player({ url: new Tone.ToneAudioBuffer(crackleBuffer(raw)), loop: true });
    this.crackle.chain(this.crackleFilter, this.crackleVolume, this.master);
    this.crackle.start();
    this.room.buffer = new Tone.ToneAudioBuffer(impulse(0.9, 0.004, 0.25));
  }

  layer(id: string): LayerChannel {
    const l = this.layerMap.get(id);
    if (!l) throw new Error(`No mixer channel "${id}"`);
    return l;
  }

  get layerIds(): string[] {
    return [...this.layerMap.keys()];
  }

  hasLayer(id: string): boolean {
    return this.layerMap.has(id);
  }

  /** Build the channels for a song (once per level). */
  build(song: SongDef): void {
    for (const l of this.layerMap.values()) l.dispose();
    for (const s of this.sendGains) s.gain.dispose();
    this.layerMap.clear();
    this.sendGains = [];
    this.song = song;
    const coreIds = [...song.core.map((l) => l.id), 'pad'];
    for (const id of coreIds) this.layerMap.set(id, new LayerChannel(this.coreFilter, false));
    for (const id of TOWER_ROLES) this.layerMap.set(id, new LayerChannel(this.master, true));
    for (const [id, sends] of Object.entries(song.mix.sends)) {
      const ch = this.layerMap.get(id);
      if (!ch) continue;
      for (const bus of ['room', 'hall', 'delay'] as const) {
        const db = sends[bus];
        if (db === undefined) continue;
        const gain = new Tone.Gain(dbToGain(db));
        ch.panner.connect(gain);
        gain.connect(bus === 'room' ? this.roomIn : bus === 'hall' ? this.hallIn : this.delayIn);
        this.sendGains.push({ from: id, to: bus, gain, db });
      }
    }
    for (const l of song.core) if (l.pan) this.layer(l.id).panner.pan.value = l.pan;
    if (Math.abs(this.hallSeconds - song.mix.hall) > 0.05) {
      this.hallSeconds = song.mix.hall;
      this.hall.buffer = new Tone.ToneAudioBuffer(impulse(song.mix.hall, 0.026, 0.55));
    }
  }

  /** Levels, sends and colours for the song with tuning trims and reward mods. */
  apply(t: Readonly<Tuning>, mods: Mods, bpm: number): void {
    const song = this.song;
    if (!song) return;
    this.master.volume.value = t.mix.master;
    this.fx.volume.value = t.mix.fx;
    this.roomReturn.volume.value = t.mix.room;
    this.hallReturn.volume.value = t.mix.hall;
    this.delayReturn.volume.value = t.mix.delay;
    this.coreTrim.volume.value = t.mix.core;
    const roleTrim: Record<string, number> = { pad: t.mix.pad, bass: t.mix.bass, chords: t.mix.chords, arp: t.mix.arp, lead: t.mix.lead };
    for (const [id, ch] of this.layerMap) ch.fader.volume.value = (song.mix.levels[id] ?? -12) + (roleTrim[id] ?? 0);
    for (const s of this.sendGains) {
      const extra = s.from === 'chords' && s.to === 'hall' ? mods.chordsRoom : 0;
      s.gain.gain.value = dbToGain(Math.min(0, s.db + extra));
    }
    const drive = Math.min(1, mods.drive);
    for (const id of ['bass', 'lead']) this.layer(id).colour?.setMap(driveCurve(drive * 0.6));
    this.delay.delayTime.value = (60 / bpm / 4) * song.mix.delay.steps;
    this.delay.feedback.value = Math.min(0.85, song.mix.delay.feedback);
    const a = song.atmosphere;
    this.noiseVolume.volume.value = a.noise + t.atmo.noise;
    this.crackleVolume.volume.value = a.crackle + t.atmo.crackle;
    this.tape.setMap(driveCurve(Math.min(1, Math.max(0, a.tape + t.atmo.tape))));
  }

  /** Back to a clean slate for a new run. */
  reset(t: Readonly<Tuning>): void {
    const now = Tone.now();
    this.master.volume.cancelScheduledValues(now);
    this.master.volume.rampTo(t.mix.master, 0.05, now);
    this.masterTone.frequency.cancelScheduledValues(now);
    this.masterTone.frequency.setValueAtTime(OPEN, now);
    this.setCore(t.core.restCutoff, t.core.restVolume, 0.02, now);
    for (const ch of this.layerMap.values()) {
      ch.pump.gain.cancelScheduledValues(now);
      ch.pump.gain.setValueAtTime(1, now);
      ch.setDamage(0, 0, now, t);
    }
  }

  /** Delay throw: push one layer much harder into the delay for a moment. */
  throwDelay(id: string, extraDb: number, time: number, seconds: number): void {
    for (const s of this.sendGains) {
      if (s.from !== id || s.to !== 'delay') continue;
      const g = s.gain.gain;
      const base = g.getValueAtTime(time);
      g.cancelScheduledValues(time);
      g.setValueAtTime(Math.min(1, base * dbToGain(extraDb)), time);
      g.setValueAtTime(base, time + seconds);
    }
  }

  /** Move the core toward a filter and volume over `ramp` seconds. */
  setCore(cutoff: number, db: number, ramp: number, time: number): void {
    this.coreFilter.frequency.cancelScheduledValues(time);
    this.coreFilter.frequency.exponentialRampTo(Math.min(Math.max(cutoff, 60), OPEN), ramp, time);
    this.coreVolume.volume.cancelScheduledValues(time);
    this.coreVolume.volume.rampTo(db, ramp, time);
  }

  /** Game over: the mix darkens and fades like a tape machine winding down. */
  tapeStop(seconds: number, time: number): void {
    this.masterTone.frequency.cancelScheduledValues(time);
    this.masterTone.frequency.setValueAtTime(OPEN, time);
    this.masterTone.frequency.exponentialRampToValueAtTime(180, time + seconds);
    this.master.volume.cancelScheduledValues(time);
    this.master.volume.setValueAtTime(this.master.volume.getValueAtTime(time), time);
    this.master.volume.linearRampToValueAtTime(-70, time + seconds * 1.3);
  }
}
