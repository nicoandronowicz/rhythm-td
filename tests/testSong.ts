/**
 * A plain, fixed song for world tests: the original prototype's patterns and chords, so game-rule
 * tests don't change when the real songs are re-arranged.
 */

import { rhythm } from '../src/music/rhythm';
import type { SongDef } from '../src/music/song';

const R = (...bars: string[]) => rhythm(16, ...bars);
const drum = (id: string, name: string, pattern: string, extra: object = {}) => ({
  id,
  name,
  color: 0xffffff,
  patch: 'click',
  notes: { kind: 'drum' as const },
  rhythm: R(pattern),
  ...extra,
});

export const TEST_SONG: SongDef = {
  id: 'afterhours',
  title: 'Test',
  style: 'test',
  bpm: 124,
  stepsPerBar: 16,
  beats: [4, 4, 4, 4],
  swing: 0,
  key: 'A minor',
  intro: { chords: [['Am7', 2], ['Fmaj7', 2], ['Cmaj7', 2], ['G', 2]] },
  sections: [
    { chords: [['Am7', 2], ['Fmaj7', 2], ['Cmaj7', 2], ['G', 2]] },
    { chords: [['Am7', 2], ['Dm7', 2], ['Fmaj7', 2], ['Em7', 2]] },
    { chords: [['Fmaj7', 2], ['G', 2], ['Am7', 2], ['Am7', 2]] },
  ],
  core: [
    drum('openhat', 'Open hat', '..x...x...x...x.', { perk: { tier: 3 }, fill: { every: 8, rhythm: R('..x...x...x....X') } }),
    drum('rim', 'Rim', '...x..x.x.....x.', { perk: { tier: 2 } }),
    drum('shaker', 'Shaker', 'gxXxgxXxgxXxgxXx', { perk: { tier: 1 } }),
    drum('hats', 'Hats', '..x...x...x...x.', { fill: { every: 8, rhythm: R('..x...x...x.x.xx') }, lift: R('xxXxxxXxxxXxxxXx') }),
    drum('clap', 'Clap', '....x.......x...', { fill: { every: 8, rhythm: R('....x.......gxxX') } }),
    drum('kick', 'Kick', 'x...x...x...x...', { pump: true, fill: { every: 8, rhythm: R('x...x...x.......') } }),
  ],
  pad: { name: 'Pad', patch: 'tone', notes: { kind: 'pad', voicing: { style: 'open', low: 41, high: 79 } } },
  parts: {
    bass: { name: 'Bass', patch: 'tone', notes: { kind: 'bass', low: 28 }, rhythm: R('..R...R...R...R.', '..R...R...R...A.'), upgraded: R('..R..OR...R..OR.', '..R..OR...R..OA.'), variant: R('..RR..R...RR..R.') },
    chords: { name: 'Chords', patch: 'tone', notes: { kind: 'chord', voicing: { style: 'close', low: 52, high: 76 } }, rhythm: R('...x......x..x..'), upgraded: R('...x..x...x..x..'), variant: R('..x...x...x...x.') },
    arp: { name: 'Arp', patch: 'tone', notes: { kind: 'arp', low: 64, count: 6, order: [0, 1, 2, 3] }, rhythm: R('x.x.x.x.x.x.x.x.'), upgraded: R('xxxxxxxxxxxxxxxx'), variant: R('x.xxx.xxx.xxx.xx') },
    lead: { name: 'Lead', patch: 'tone', notes: { kind: 'arp', low: 64, count: 6, order: [3, 2, 1, 0] }, rhythm: R('x......x..x.....'), upgraded: R('x......x..x...x.'), variant: R('x..x...x..x...x.') },
  },
  patches: {
    click: { type: 'drum', kind: 'rim' },
    tone: { type: 'synth', osc: [{ wave: 'sine' }], filter: { cutoff: 2000 }, amp: { a: 0.01, d: 0.1, s: 0.5, r: 0.1 } },
  },
  mix: { levels: {}, sends: {}, delay: { steps: 3, feedback: 0.3 }, hall: 3, pump: { depth: -4, release: 3 } },
  atmosphere: { noise: -80, crackle: -80, tape: 0 },
};
