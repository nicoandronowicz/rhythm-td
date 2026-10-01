import { describe, expect, it } from 'vitest';
import {
  bassNote,
  bassRootAtBar,
  chordAtBar,
  isInMelodyScale,
  kickNote,
  melodyNotesInRange,
  midiToFreq,
  midiToName,
  PROTOTYPE_SPEC,
} from '../src/music/theory';

describe('music theory', () => {
  it('converts MIDI to frequency and name', () => {
    expect(midiToFreq(69)).toBeCloseTo(440);
    expect(midiToFreq(33)).toBeCloseTo(55);
    expect(midiToName(33)).toBe('A1');
    expect(midiToName(29)).toBe('F1');
    expect(midiToName(60)).toBe('C4');
  });

  it('alternates Am7 and Fmaj7 every 2 bars', () => {
    const names = [0, 1, 2, 3, 4, 5, 6, 7].map((b) => chordAtBar(b).name);
    expect(names).toEqual(['Am7', 'Am7', 'Fmaj7', 'Fmaj7', 'Am7', 'Am7', 'Fmaj7', 'Fmaj7']);
  });

  it('a 16-bar wave is 4 full cycles of the vamp', () => {
    expect(chordAtBar(15).name).toBe('Fmaj7');
    expect(chordAtBar(16).name).toBe('Am7');
  });

  it('handles negative bars without crashing', () => {
    expect(chordAtBar(-1).name).toBe('Fmaj7');
  });

  it('chord tones match the spec', () => {
    expect(chordAtBar(0).tones).toEqual(['A', 'C', 'E', 'G']);
    expect(chordAtBar(2).tones).toEqual(['F', 'A', 'C', 'E']);
  });

  it('bass root follows the chord and stays in range', () => {
    expect(midiToName(bassRootAtBar(0))).toBe('A1');
    expect(midiToName(bassRootAtBar(2))).toBe('F1');
    for (let bar = 0; bar < 16; bar++) {
      const n = bassRootAtBar(bar);
      expect(n).toBeGreaterThanOrEqual(PROTOTYPE_SPEC.bassRange[0]);
      expect(n).toBeLessThanOrEqual(PROTOTYPE_SPEC.bassRange[1]);
    }
  });

  it('bass octave note is the root an octave up', () => {
    expect(bassNote(0, true)).toBe(bassNote(0, false) + 12);
  });

  it('kick is tuned to A', () => {
    expect(midiToName(kickNote())).toBe('A1');
  });

  it('melody notes are only A C D E G', () => {
    const notes = melodyNotesInRange(57, 81).map((m) => midiToName(m).replace(/\d+$/, ''));
    expect(new Set(notes)).toEqual(new Set(['A', 'C', 'D', 'E', 'G']));
    expect(isInMelodyScale(58)).toBe(false); // A#
    expect(isInMelodyScale(69)).toBe(true); // A
  });
});

describe('bass layers', () => {
  it('mid layer sits an octave above the sub, both on the chord root', async () => {
    const { bassLayerNotes } = await import('../src/music/theory');
    const am = bassLayerNotes(0, false);
    expect(midiToName(am.sub)).toBe('A1');
    expect(midiToName(am.mid)).toBe('A2');
    const f = bassLayerNotes(2, false);
    expect(midiToName(f.sub)).toBe('F1');
    expect(midiToName(f.mid)).toBe('F2');
    expect(bassLayerNotes(0, true).sub).toBe(am.sub + 12);
  });
});

describe('melodic towers', () => {
  it('chord stabs use only chord tones, ascending, in a tight voicing', async () => {
    const { chordVoicing } = await import('../src/music/theory');
    expect(chordVoicing(0).map(midiToName)).toEqual(['A3', 'C4', 'E4', 'G4']);
    expect(chordVoicing(2).map(midiToName)).toEqual(['F3', 'A3', 'C4', 'E4']);
    for (let bar = 0; bar < 8; bar++) {
      const v = chordVoicing(bar);
      const pcs = chordAtBar(bar).tones;
      for (let i = 0; i < v.length; i++) {
        expect(pcs).toContain(midiToName(v[i]!).replace(/-?\d+$/, ''));
        if (i > 0) expect(v[i]!).toBeGreaterThan(v[i - 1]!);
      }
      expect(v[v.length - 1]! - v[0]!).toBeLessThan(13);
    }
  });

  it('arp climbs the chord tones over two octaves and wraps', async () => {
    const { arpNote } = await import('../src/music/theory');
    const am = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => midiToName(arpNote(0, i)));
    expect(am).toEqual(['A4', 'C5', 'E5', 'G5', 'A5', 'C6', 'E6', 'G6']);
    expect(arpNote(0, 8)).toBe(arpNote(0, 0));
    expect(midiToName(arpNote(2, 0))).toBe('F4');
    for (let i = 0; i < 16; i++) {
      const pc = midiToName(arpNote(2, i)).replace(/-?\d+$/, '');
      expect(chordAtBar(2).tones).toContain(pc);
    }
  });

  it('lead hook only uses the pentatonic scale, on every bar and hit', async () => {
    const { leadNote } = await import('../src/music/theory');
    for (let bar = 0; bar < 8; bar++) {
      for (let hit = 0; hit < 6; hit++) expect(isInMelodyScale(leadNote(bar, hit))).toBe(true);
    }
    expect(midiToName(leadNote(0, 0))).toBe('E5');
  });
});
