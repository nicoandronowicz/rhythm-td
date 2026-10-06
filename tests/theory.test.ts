import { describe, expect, it } from 'vitest';
import {
  ARP_STYLES,
  arpNote,
  arpStyleForWave,
  BASS_RANGE,
  bassLayerNotes,
  bassRoot,
  chordInProgression,
  chordVoicing,
  CHORDS,
  isInKey,
  isSafeLeadNote,
  kickNote,
  LEAD_MOTIFS,
  leadMotifForWave,
  leadNote,
  midiToFreq,
  midiToName,
  percNote,
  progressionBars,
  progressionForWave,
  PROGRESSIONS,
  type Chord,
} from '../src/music/theory';

const pcName = (m: number) => midiToName(m).replace(/-?\d+$/, '');
const ALL_CHORDS: Chord[] = Object.values(CHORDS);

describe('basics', () => {
  it('converts MIDI to frequency and name', () => {
    expect(midiToFreq(69)).toBeCloseTo(440);
    expect(midiToFreq(33)).toBeCloseTo(55);
    expect(midiToName(33)).toBe('A1');
    expect(midiToName(60)).toBe('C4');
  });

  it('kick and perc are tuned in key', () => {
    expect(midiToName(kickNote())).toBe('A1');
    expect(isInKey(percNote())).toBe(true);
  });
});

describe('progressions', () => {
  it('are the five curated 8-bar progressions, every chord in A minor', () => {
    expect(PROGRESSIONS.map((p) => p.chords.map((c) => c.name).join('-'))).toEqual([
      'Am7-Fmaj7-Cmaj7-G',
      'Am7-Dm7-Fmaj7-Em7',
      'Fmaj7-G-Am7-Am7',
      'Am7-Em7-Fmaj7-G',
      'Dm7-Am7-Fmaj7-G',
    ]);
    for (let p = 0; p < PROGRESSIONS.length; p++) expect(progressionBars(p)).toBe(8);
    for (const c of ALL_CHORDS) for (const pc of c.tones) expect(['A', 'B', 'C', 'D', 'E', 'F', 'G']).toContain(pc);
  });

  it('two bars per chord, wrapping after 8', () => {
    const names = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((b) => chordInProgression(0, b).name);
    expect(names).toEqual(['Am7', 'Am7', 'Fmaj7', 'Fmaj7', 'Cmaj7', 'Cmaj7', 'G', 'G', 'Am7']);
    expect(chordInProgression(1, -1).name).toBe('Em7');
  });

  it('each wave gets the next progression, cycling; the intro uses the first', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map(progressionForWave)).toEqual([0, 0, 1, 2, 3, 4, 0]);
  });
});

describe('bass', () => {
  it('root of every chord, inside the bass range; mid layer an octave up', () => {
    for (const c of ALL_CHORDS) {
      const r = bassRoot(c);
      expect(pcName(r)).toBe(c.tones[0]);
      expect(r).toBeGreaterThanOrEqual(BASS_RANGE[0]);
      expect(r).toBeLessThanOrEqual(BASS_RANGE[1]);
      expect(bassLayerNotes(c, false).mid).toBe(r + 12);
      expect(bassLayerNotes(c, true).sub).toBe(r + 12);
    }
    expect(midiToName(bassRoot(CHORDS.Am7))).toBe('A1');
    expect(midiToName(bassRoot(CHORDS.Fmaj7))).toBe('F1');
  });
});

describe('chord stabs', () => {
  it('root position, chord tones only, root between E3 and D#4', () => {
    expect(chordVoicing(CHORDS.Am7).map(midiToName)).toEqual(['A3', 'C4', 'E4', 'G4']);
    expect(chordVoicing(CHORDS.Fmaj7).map(midiToName)).toEqual(['F3', 'A3', 'C4', 'E4']);
    expect(chordVoicing(CHORDS.G).map(midiToName)).toEqual(['G3', 'B3', 'D4']);
    for (const c of ALL_CHORDS) {
      const v = chordVoicing(c);
      expect(v.map(pcName)).toEqual([...c.tones]);
      expect(v[0]!).toBeGreaterThanOrEqual(52);
      expect(v[0]!).toBeLessThanOrEqual(63);
      expect(v[v.length - 1]! - v[0]!).toBeLessThan(13);
    }
  });
});

describe('arp', () => {
  it('climbs the chord over two octaves in "up"', () => {
    const am = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => midiToName(arpNote(CHORDS.Am7, i, 'up')));
    expect(am).toEqual(['E4', 'G4', 'A4', 'C5', 'E5', 'G5', 'A5', 'C6']);
    expect(arpNote(CHORDS.Am7, 8, 'up')).toBe(arpNote(CHORDS.Am7, 0, 'up'));
  });

  it('down goes down, updown turns around without repeating the ends', () => {
    expect(arpNote(CHORDS.Am7, 0, 'down')).toBeGreaterThan(arpNote(CHORDS.Am7, 1, 'down'));
    const ud = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => arpNote(CHORDS.Am7, i, 'updown'));
    expect(ud[7]).toBeGreaterThan(ud[8]!);
    for (let i = 1; i < ud.length; i++) expect(ud[i]).not.toBe(ud[i - 1]);
  });

  it('every style plays only chord tones, for every chord', () => {
    for (const style of ARP_STYLES) {
      for (const c of ALL_CHORDS) {
        for (let i = 0; i < 32; i++) expect(c.tones).toContain(pcName(arpNote(c, i, style)));
      }
    }
  });

  it('style changes from wave to wave', () => {
    expect(new Set([1, 2, 3, 4].map(arpStyleForWave)).size).toBe(4);
  });
});

describe('lead', () => {
  it('never plays a note that rubs against the chord, for every motif, chord, bar and hit', () => {
    for (let m = 0; m < LEAD_MOTIFS.length; m++) {
      for (const c of ALL_CHORDS) {
        for (let bar = 0; bar < 8; bar++) {
          for (let hit = 0; hit < 6; hit++) {
            const n = leadNote(c, bar, hit, m);
            expect(isSafeLeadNote(n, c)).toBe(true);
            expect(n).toBeGreaterThanOrEqual(64);
            expect(n).toBeLessThanOrEqual(81);
          }
        }
      }
    }
  });

  it('safe notes: chord tones yes, a half step off a chord tone no', () => {
    expect(isSafeLeadNote(72, CHORDS.Am7)).toBe(true); // C over Am7
    expect(isSafeLeadNote(74, CHORDS.Am7)).toBe(true); // D, a whole step from C and E
    expect(isSafeLeadNote(72, CHORDS.G)).toBe(false); // C rubs on B
    expect(isSafeLeadNote(76, CHORDS.Dm7)).toBe(false); // E rubs on F
    expect(isSafeLeadNote(70, CHORDS.Am7)).toBe(false); // Bb isn't in the scale
  });

  it('each wave gets a different hook shape', () => {
    expect(new Set([1, 2, 3, 4, 5].map(leadMotifForWave)).size).toBe(5);
    const a = [0, 1, 2].map((h) => leadNote(CHORDS.Am7, 0, h, 0));
    const b = [0, 1, 2].map((h) => leadNote(CHORDS.Am7, 0, h, 1));
    expect(a).not.toEqual(b);
  });
});
