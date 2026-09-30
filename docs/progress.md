# Progress

## 2026-09-30 · Session 1: Sound first

**Shipped**

- Project scaffold: TypeScript (strict), Vite 8, Phaser 4.2, Tone.js 15.1, Vitest 5. Deploys to GitHub Pages on every push to `main` (tests and build run first).
- Audio engine: one 16th-note tick on the Tone.js transport drives everything. Sounds are scheduled at the tick's transport time (look-ahead), never at "now".
- Music module (`src/music/theory.ts`): A minor, Am7/Fmaj7 every 2 bars. It picks every pitch, including kick tuning (A1) and both bass layers.
- Synth kit, built per hit on the audio clock:
  - Kick: tuned sine with pitch sweep, click and saturation.
  - Clap: 909-style, three bursts plus a tail, with a short room reverb send.
  - Hats: noise plus the 808 six-oscillator metal, velocity wobble.
  - Bass: sub on the root plus a plucked, saturated mid layer an octave up, so it still reads on laptops.
- Mixer: a channel per tower with neutral bitcrush and low-pass inserts (ready for enemies), glue compressor, limiter and a transparent safety clipper on the master.
- Mix balanced by measurement: offline renders, K-weighted loudness per hit, plus a small-speaker model. Tool in `src/dev/offline.ts`.
- Board: place (click or drag from the palette), move (drag), remove (right-click or drag to the bin). New layers enter on the next bar; a removed layer plays until the bar ends. Several towers of one type make one layer.
- Visuals: towers pulse on their hits, queued towers blink until their bar, the path breathes on the beat, and a 16-step track view has a playhead. The screen follows the audio clock every frame.
- HUD: bar, beat, chord, tempo, layers playing.
- Tuning panel (T): BPM, swing (on 16ths or 8ths), volumes, plus collapsible sound-design sections. Saves in the browser, Copy as JSON, Reset.
- 52 unit tests: music module, patterns, grid math, swing, next-bar queueing, board rules, sequencer, tuning store, audio curves.

**Known issues**

- Sounds were balanced by measurement, not by ear. Nico's listening notes are the real test.
- Swing only moves in-between notes. The base patterns are all 8ths, so swing on 16ths is inaudible until upgrades (session 4). "Swing on: 8ths" is audible now.
- The drag-to-remove bin is the only way to remove on touch screens (no right-click on phones).
- Phaser is ~1.6 MB of JS (430 KB gzipped); first load takes a moment on slow connections.

**Next step**

- Nico tests the groove on laptop speakers and headphones and sends tuning JSON and notes.
- Then session 2: path and enemies (Static, Muffler), towers attacking on their steps, kill notes, currency and costs.
