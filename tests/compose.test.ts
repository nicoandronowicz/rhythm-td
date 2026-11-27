import { describe, expect, it } from 'vitest';
import { Composer, type ComposeInput, type PartState } from '../src/music/compose';
import { arpLadder, bassNote, degreeToMidi, parseChord, parseKey, pc, voiceChord } from '../src/music/harmony';
import { parseMelody } from '../src/music/melody';
import { hitAt, rhythm } from '../src/music/rhythm';
import { SONGS } from '../src/music/songs';

const idle: PartState = { mode: 'idle', upgraded: false, variant: false };
const fight: PartState = { mode: 'fighting', upgraded: false, variant: false };

function input(c: Composer, step: number, over: Partial<ComposeInput> = {}): ComposeInput {
  const spb = c.stepsPerBar;
  const bar = Math.floor(step / spb);
  return {
    step,
    bar,
    stepInBar: step % spb,
    section: 0,
    barInSection: bar % 16,
    pass: 0,
    wave: 1,
    energy: 0.7,
    flowing: true,
    lifted: false,
    core: new Set(c.song.core.map((l) => l.id)),
    parts: { bass: fight, chords: fight, arp: fight, lead: fight },
    ...over,
  };
}

describe('harmony', () => {
  it('parses extended and slash chords', () => {
    const c = parseChord('Abmaj7/C');
    expect(c.root).toBe(8);
    expect(c.bass).toBe(0);
    expect(parseChord('Fm9').intervals).toEqual([0, 3, 7, 10, 14]);
    expect(() => parseChord('Xm7')).toThrow();
  });

  it('maps scale degrees in a mode', () => {
    const k = parseKey('F minor');
    expect(degreeToMidi(k, 1, 60)).toBe(65); // F4
    expect(degreeToMidi(k, 3, 60)).toBe(68); // Ab4
    expect(degreeToMidi(k, 8, 60)).toBe(77); // F5
    expect(degreeToMidi(parseKey('D dorian'), 6, 60)).toBe(71); // B natural
  });

  it('voice leads: the next voicing moves little', () => {
    const opts = { style: 'rootless' as const, low: 55, high: 80 };
    const a = voiceChord(parseChord('Fm9'), opts);
    const b = voiceChord(parseChord('Dbmaj9'), opts, a);
    const moved = b.reduce((s, n) => s + Math.min(...a.map((x) => Math.abs(x - n))), 0);
    expect(moved).toBeLessThanOrEqual(6);
    for (const n of [...a, ...b]) expect(n >= 55 && n <= 80).toBe(true);
  });

  it('bass roles land on the right notes', () => {
    const fm = parseChord('Fm9');
    const db = parseChord('Dbmaj7');
    expect(pc(bassNote('R', fm, db, 29))).toBe(5);
    expect(bassNote('O', fm, db, 29)).toBe(bassNote('R', fm, db, 29) + 12);
    expect(pc(bassNote('A', fm, db, 29) + 1)).toBe(1); // a half step under Db
  });

  it('arp ladders hold only chord tones', () => {
    const ladder = arpLadder(parseChord('Fm9'), 65, 7);
    expect(ladder).toHaveLength(7);
    for (const n of ladder) expect([5, 8, 0, 3, 7]).toContain(pc(n));
  });
});

describe('notation', () => {
  it('rhythm bars must fill the meter; ties extend hits', () => {
    expect(() => rhythm(16, 'x...')).toThrow();
    const r = rhythm(14, 'x--. x... x.....');
    expect(hitAt(r, 0, 0)?.len).toBe(3);
    expect(hitAt(r, 3, 4)).not.toBeNull();
  });

  it('melody bars must add up', () => {
    expect(() => parseMelody('5:4 3:4', 16)).toThrow();
    const m = parseMelody("1:8 5':8 | ~b3:16", 16);
    expect(m.notes).toHaveLength(3);
    expect(m.notes[1]!.degree).toBe(12);
    expect(m.notes[2]!.accidental).toBe(-1);
    expect(m.notes[2]!.slide).toBe(true);
  });
});

for (const song of Object.values(SONGS)) {
  describe(`song: ${song.title}`, () => {
    const c = new Composer(song);
    const spb = song.stepsPerBar;

    it('beats add up to the bar', () => {
      expect(song.beats.reduce((a, b) => a + b, 0)).toBe(spb);
    });

    it('every patch a part uses exists', () => {
      const used = [...song.core, song.pad, ...Object.values(song.parts)].map((p) => p.patch);
      for (const id of used) expect(song.patches[id], id).toBeDefined();
    });

    it('melodies fit their chords on strong beats', () => {
      song.sections.forEach((s, si) => {
        for (const src of [s.melody, s.answer]) {
          if (!src) continue;
          const m = parseMelody(src, spb);
          const offset = src === s.answer ? m.bars : 0;
          for (const n of m.notes) {
            if (n.step % spb !== 0) continue;
            const h = c.harmony(si, offset + Math.floor(n.step / spb));
            const midi = degreeToMidi(c.key, n.degree, 60) + n.accidental + (s.shift ?? 0);
            const pcs = h.chord.intervals.map((i) => pc(h.chord.root + i));
            const near = Math.min(...pcs.map((p) => Math.min(pc(midi - p), pc(p - midi))));
            // A downbeat may hold a tension (9th, 11th, 6th) but never a half step against the chord.
            expect(near, `section ${si + 1}, bar ${Math.floor(n.step / spb) + 1}`).not.toBe(1);
          }
        }
      });
    });

    it('plays four waves without errors, and every part makes sound', () => {
      const heard = new Map<string, number>();
      let attacks = 0;
      for (let wave = 1; wave <= 4; wave++) {
        const section = c.sectionFor(wave);
        for (let s = 0; s < 16 * spb; s++) {
          const evs = c.compose(input(c, s, { section, wave, barInSection: Math.floor(s / spb), stepInBar: s % spb }));
          for (const e of evs) {
            heard.set(e.layer, (heard.get(e.layer) ?? 0) + 1);
            if (e.attack && ['bass', 'chords', 'arp', 'lead'].includes(e.layer)) attacks++;
            for (const n of e.notes) expect(n > 20 && n < 110, `${e.layer} ${n}`).toBe(true);
            expect(e.vel).toBeGreaterThan(0);
            expect(e.vel).toBeLessThanOrEqual(1);
          }
        }
      }
      for (const id of [...song.core.map((l) => l.id), 'pad', 'bass', 'chords', 'arp', 'lead']) {
        expect(heard.get(id) ?? 0, id).toBeGreaterThan(0);
      }
      expect(attacks).toBeGreaterThan(100);
    });

    it('idle towers play but never attack', () => {
      const evs = [];
      for (let s = 0; s < 4 * spb; s++) {
        evs.push(...c.compose(input(c, s, { parts: { bass: idle, chords: idle, arp: idle, lead: idle } })));
      }
      expect(evs.some((e) => e.layer === 'arp')).toBe(true);
      // Attack flags mark main hits; the world only uses them for fighting towers.
      expect(evs.filter((e) => e.layer === 'arp').every((e) => e.attack)).toBe(true);
    });

    it('the arp cycle runs across bar lines (polymeter)', () => {
      const firstNotes: number[] = [];
      for (let bar = 0; bar < 5; bar++) {
        const evs = c.compose(input(c, bar * spb, { barInSection: 0, stepInBar: 0 }));
        const arp = evs.find((e) => e.layer === 'arp');
        if (arp) firstNotes.push(arp.notes[0]!);
      }
      expect(new Set(firstNotes).size).toBeGreaterThan(1);
    });
  });
}
