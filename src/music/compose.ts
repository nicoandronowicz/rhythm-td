/**
 * The composer: turns a song and the state of the game into the notes of each 16th. Pure (no audio)
 * but stateful across steps, for voice leading, arpeggio position and melody continuity.
 *
 * The world asks it for every step's notes; tower attacks happen on the notes flagged `attack`
 * (a part's main hits, never its decoration). The audio engine plays the notes as they come.
 */

import type { TowerType } from '../game/towers';
import {
  arpLadder,
  bassNote,
  degreeToMidi,
  distanceToChord,
  isChordTone,
  nearestChordTone,
  parseChord,
  parseKey,
  type Chord,
  type Key,
  voiceChord,
} from './harmony';
import { parseMelody, type Melody } from './melody';
import { defaultVelocity, density, hitAt, type Hit, type Rhythm } from './rhythm';
import type { CoreLayerDef, PartDef, SectionDef, SongDef } from './song';

export const TOWER_ROLES: readonly TowerType[] = ['bass', 'chords', 'arp', 'lead'];

export interface NoteEvent {
  /** Mixer channel: a core layer id, 'pad', or a tower role. */
  layer: string;
  patch: string;
  /** MIDI notes (empty for drums). */
  notes: number[];
  /** Drum articulation or variant. */
  art?: string;
  /** Length in steps. */
  len: number;
  /** 0..1. */
  vel: number;
  /** Slow movement value 0..1 (filters, brightness). */
  mod: number;
  /** A main hit: towers attack on these. */
  attack: boolean;
  slide?: boolean;
  /** Timing offset in steps (positive = late). */
  offset: number;
  /** Seconds between chord notes (strum). */
  strum?: number;
}

export interface PartState {
  mode: 'fighting' | 'idle' | 'none';
  upgraded: boolean;
  variant: boolean;
}

export interface ComposeInput {
  step: number;
  bar: number;
  stepInBar: number;
  /** Section index (wave - 1, mod the song's sections), -1 for the intro. */
  section: number;
  /** Bars since the section started. */
  barInSection: number;
  /** How many times this section has come round before (0 the first time). */
  pass: number;
  wave: number;
  /** 0..1: resting ~0.2, building ~0.5, a wave 0.6..0.9, lifted 1. */
  energy: number;
  /** In full flow (not resting): fills and turnarounds allowed. */
  flowing: boolean;
  lifted: boolean;
  /** Core layer ids playing now. */
  core: ReadonlySet<string>;
  parts: Readonly<Record<TowerType, PartState>>;
}

export interface Harmony {
  chord: Chord;
  next: Chord;
  /** Bars left on this chord, counting this one. */
  barsLeft: number;
  /** First bar of a chord. */
  change: boolean;
}

interface ParsedSection {
  def: SectionDef;
  chords: { chord: Chord; bars: number }[];
  length: number;
  melody?: Melody;
  answer?: Melody;
}

/** Deterministic 0..1 noise from integers (humanizing that renders the same every time). */
function hash(a: number, b: number, c = 0): number {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function strHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  return h;
}

function transpose(chord: Chord, shift: number): Chord {
  if (!shift) return chord;
  return { ...chord, root: (chord.root + shift + 120) % 12, bass: (chord.bass + shift + 120) % 12 };
}

export class Composer {
  readonly key: Key;
  private readonly sections: ParsedSection[];
  private readonly intro: ParsedSection;
  private readonly prevVoicing = new Map<string, number[]>();
  private readonly arpCount = new Map<string, number>();
  private lastSection = -2;
  private readonly densities = new Map<PartDef, number>();

  constructor(readonly song: SongDef) {
    this.key = parseKey(song.key);
    const parse = (def: SectionDef): ParsedSection => {
      const chords = def.chords.map(([sym, bars]) => ({ chord: parseChord(sym), bars }));
      return {
        def,
        chords,
        length: chords.reduce((s, c) => s + c.bars, 0),
        melody: def.melody ? parseMelody(def.melody, song.stepsPerBar) : undefined,
        answer: def.answer ? parseMelody(def.answer, song.stepsPerBar) : undefined,
      };
    };
    this.sections = song.sections.map(parse);
    this.intro = parse(song.intro);
  }

  get stepsPerBar(): number {
    return this.song.stepsPerBar;
  }

  sectionFor(wave: number): number {
    return wave <= 0 ? -1 : (wave - 1) % this.sections.length;
  }

  private parsed(section: number): ParsedSection {
    return section < 0 ? this.intro : this.sections[section % this.sections.length]!;
  }

  harmony(section: number, barInSection: number): Harmony {
    const s = this.parsed(section);
    const shift = s.def.shift ?? 0;
    const at = (bar: number) => {
      let b = ((bar % s.length) + s.length) % s.length;
      for (let i = 0; i < s.chords.length; i++) {
        const c = s.chords[i]!;
        if (b < c.bars) return { i, into: b, chord: c };
        b -= c.bars;
      }
      return { i: 0, into: 0, chord: s.chords[0]! };
    };
    const now = at(barInSection);
    const next = at(barInSection + (now.chord.bars - now.into));
    return {
      chord: transpose(now.chord.chord, shift),
      next: transpose(next.chord.chord, shift),
      barsLeft: now.chord.bars - now.into,
      change: now.into === 0,
    };
  }

  /** The rhythm a part plays right now (fills, lift and tower upgrades considered). */
  rhythmFor(part: PartDef, inp: ComposeInput, state?: PartState): Rhythm | null {
    if (inp.lifted && part.lift) return part.lift;
    if (part.fill && inp.flowing && (inp.barInSection + 1) % part.fill.every === 0) return part.fill.rhythm;
    if (state?.upgraded && part.upgraded) return part.upgraded;
    if (state?.variant && part.variant) return part.variant;
    return part.rhythm ?? null;
  }

  /** The main hit a part plays at this step, if any (melody parts: the melody's note). */
  mainHit(part: PartDef, inp: ComposeInput, state?: PartState): Hit | null {
    if (part.notes.kind === 'melody') {
      const m = this.melodyFor(inp, state);
      if (!m) return null;
      const n = m.starts.get((inp.barInSection % m.bars) * m.stepsPerBar + inp.stepInBar);
      return n ? { step: inp.stepInBar, sym: 'x', len: n.len, index: 0 } : null;
    }
    if (part.notes.kind === 'pad') {
      const h = this.harmony(inp.section, inp.barInSection);
      const start = inp.stepInBar === 0 && (h.change || inp.barInSection === 0);
      return start ? { step: 0, sym: 'x', len: h.barsLeft * this.stepsPerBar, index: 0 } : null;
    }
    const r = this.rhythmFor(part, inp, state);
    return r ? hitAt(r, inp.barInSection, inp.stepInBar) : null;
  }

  private melodyFor(inp: ComposeInput, state?: PartState): Melody | undefined {
    const s = this.parsed(inp.section);
    if (!s.melody) return undefined;
    // The answer phrase every other time round (within the section and across waves), or always with the variant reward.
    const round = Math.floor(inp.barInSection / s.melody.bars) + inp.pass;
    const useAnswer = s.answer && (state?.variant || round % 2 === 1);
    return useAnswer ? s.answer : s.melody;
  }

  private sweep(part: PartDef, inp: ComposeInput): number {
    const sw = part.sweep;
    if (!sw) return inp.energy;
    const span = sw.bars * this.stepsPerBar;
    const pos = (inp.barInSection * this.stepsPerBar + inp.stepInBar) % span;
    const t = pos / span;
    const f = sw.shape === 'rise' ? t : 0.5 - 0.5 * Math.cos(2 * Math.PI * t);
    return sw.min + (sw.max - sw.min) * f;
  }

  /** Beat accent: the first step of each beat group plays a touch louder. */
  private accent(stepInBar: number): number {
    let pos = 0;
    for (const len of this.song.beats) {
      if (stepInBar === pos) return pos === 0 ? 1.06 : 1.03;
      pos += len;
    }
    return 1;
  }

  /** Every note to play at this step. */
  compose(inp: ComposeInput): NoteEvent[] {
    if (inp.section !== this.lastSection && inp.barInSection === 0 && inp.stepInBar === 0) {
      this.lastSection = inp.section;
      this.arpCount.clear();
    }
    const out: NoteEvent[] = [];
    const h = this.harmony(inp.section, inp.barInSection);
    for (const layer of this.song.core) {
      if (!inp.core.has(layer.id)) continue;
      if (layer.breakdown === 'drop' && !inp.flowing && !inp.lifted) continue;
      this.part(layer.id, layer, inp, h, undefined, out);
    }
    this.part('pad', this.song.pad, inp, h, undefined, out);
    for (const role of TOWER_ROLES) {
      const st = inp.parts[role];
      if (st.mode === 'none') continue;
      this.part(role, this.song.parts[role], inp, h, st, out);
    }
    return out;
  }

  private part(layer: string, part: PartDef | CoreLayerDef, inp: ComposeInput, h: Harmony, state: PartState | undefined, out: NoteEvent[]): void {
    const main = this.mainHit(part, inp, state);
    if (main) out.push(...this.realize(layer, part, main, inp, h, true, 1, state));
    for (const d of part.deco ?? []) {
      if (inp.energy < d.from) continue;
      const hit = hitAt(d.rhythm, inp.barInSection, inp.stepInBar);
      if (hit && !main) out.push(...this.realize(layer, part, hit, inp, h, false, d.vel ?? 0.6, state));
    }
  }

  private realize(layer: string, part: PartDef, hit: Hit, inp: ComposeInput, h: Harmony, attack: boolean, velScale: number, state?: PartState): NoteEvent[] {
    const sym = part.symbols?.[hit.sym];
    const lh = strHash(layer);
    const human = 1 + (hash(inp.step, lh) - 0.5) * 0.08;
    const vel = Math.min(1, (sym?.vel ?? defaultVelocity(hit.sym)) * velScale * this.accent(inp.stepInBar) * human);
    const offset = (part.late ?? 0) + (part.loose ? (hash(inp.step, lh, 7) - 0.5) * 2 * part.loose : 0);
    const base = { layer, patch: part.patch, len: hit.len, vel, mod: this.sweep(part, inp), attack, offset };
    const rule = part.notes;
    switch (rule.kind) {
      case 'drum':
        return [{ ...base, notes: [], art: sym?.art ?? hit.sym }];
      case 'bass': {
        // An approach note only makes sense right before a chord change; otherwise play the octave.
        const role = hit.sym.toUpperCase() === "A" && h.barsLeft > 1 ? "O" : hit.sym;
        const note = bassNote(role, h.chord, h.next, rule.low);
        return [{ ...base, notes: [note], slide: hit.sym === '~' }];
      }
      case 'chord': {
        const prev = this.prevVoicing.get(layer);
        const v = voiceChord(h.chord, rule.voicing, prev);
        this.prevVoicing.set(layer, v);
        return [{ ...base, notes: v, strum: rule.strum, art: sym?.art }];
      }
      case 'pad': {
        const prev = this.prevVoicing.get(layer);
        const v = voiceChord(h.chord, rule.voicing, prev);
        this.prevVoicing.set(layer, v);
        return [{ ...base, notes: v }];
      }
      case 'arp': {
        const orders = rule.orders ?? [rule.order];
        const order = orders[Math.max(0, inp.wave - 1) % orders.length]!;
        const n = this.arpCount.get(layer) ?? 0;
        if (attack) this.arpCount.set(layer, n + 1);
        const ladder = arpLadder(h.chord, rule.low, rule.count);
        const idx = order[n % order.length]! % ladder.length;
        return [{ ...base, notes: [ladder[idx]!], art: sym?.art }];
      }
      case 'melody': {
        const m = this.melodyFor(inp, state);
        if (!m) return [];
        const note = m.starts.get((inp.barInSection % m.bars) * m.stepsPerBar + inp.stepInBar);
        if (!note) return [];
        const shift = this.parsed(inp.section).def.shift ?? 0;
        let midi = degreeToMidi(this.key, note.degree, rule.base) + note.accidental + shift;
        const strong = this.accent(inp.stepInBar) > 1;
        if (rule.snap && strong && !isChordTone(h.chord, midi) && distanceToChord(h.chord, midi) === 1) {
          midi = nearestChordTone(h.chord, midi);
        }
        const notes = state?.upgraded ? [midi, midi + 12] : [midi];
        return [{ ...base, notes, slide: note.slide, len: note.len }];
      }
    }
  }

  /** Main hits per bar of a part's base rhythm (melodies: notes per bar over all sections). */
  density(part: PartDef): number {
    let d = this.densities.get(part);
    if (d === undefined) {
      if (part.notes.kind === 'melody') {
        const ms = this.sections.flatMap((s) => [s.melody, s.answer]).filter((m): m is Melody => !!m);
        const bars = ms.reduce((a, m) => a + m.bars, 0);
        d = bars ? ms.reduce((a, m) => a + m.notes.length, 0) / bars : 0;
      } else d = part.rhythm ? density(part.rhythm) : 0;
      this.densities.set(part, d);
    }
    return d;
  }

  /** What a layer plays over a whole bar, for the track view: hit steps of its main part. */
  barPreview(part: PartDef, inp: ComposeInput, state?: PartState): number[] {
    const steps: number[] = [];
    for (let s = 0; s < this.stepsPerBar; s++) {
      if (this.mainHit(part, { ...inp, stepInBar: s }, state)) steps.push(s);
    }
    return steps;
  }
}
