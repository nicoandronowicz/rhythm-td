# Progress

## 2026-10-01 · Session 2: Core, path and enemies

**Shipped**

- Design change recorded in `design.md` and `CLAUDE.md`. The drums are now the core at the end of the path and always play; towers are melodic layers that play only while fighting; kill notes are dropped.
- Drum core: kick, clap and hats play from the first click, in a core block at the path's end that pulses with them.
- Four melodic towers, all synthesized, with every note picked by the music module:
  - Bass: the session 1 sound.
  - Chords: house stab, two detuned saws per note plus an organ layer, voiced A3 C4 E4 G4 / F3 A3 C4 E4.
  - Arp: pluck climbing the chord over two octaves, into a dotted-8th ping-pong delay.
  - Lead: detuned pluck playing a curated 4-bar pentatonic hook.
- Towers play only while an enemy is in range, from their next pattern step, and hold to the end of the bar. Hits and attacks happen on the same steps. Several towers of one type make one sound but attack separately. "Idle volume", "comes in on" and "hold" are in the tuning panel.
- Static and Muffler walk the path smoothly, drawn from the audio clock. Towers hit them only on their pattern steps:
  - Lead: one big hit on the enemy furthest along.
  - Arp: small hits at long range.
  - Chords: hits everything in range with a short stun.
  - Bass: hits and slows everything in range.
- Waves start on their own: 4 drums-only bars, then a 16-bar wave and a 4-bar breakdown, repeating without stopping. Each wave has 2 more enemies and is 22% tougher. Mufflers join from wave 2.
- Money: start with $120, earn per kill, towers cost $40–70, removing refunds half, moving is free.
- HUD shows wave and countdown, money and enemies on the path. Hovering shows tower range. The track view shows 7 rows (3 drums + 4 towers) lit by what's actually playing.
- Mix balanced by measurement for the 3 new instruments. Difficulty set by simulating builds of 2, 4, 8 and 15 towers. 82 unit tests: engagement and hold, attacks only on pattern steps, targeting, stun and slow, movement, leaks, economy, wave generation and clock, chord, arp and lead notes.

**Known issues**

- Enemies don't attack towers yet, and reaching the core is only counted (no damage, no game over). That's session 3.
- Upgrades aren't in yet (session 4). The upgraded patterns are defined but unused.
- Sounds and difficulty were set by measurement and simulation, not by ear or real play. Nico's notes come first.
- Tuning saved in the browser from session 1 still applies. If something sounds off, press Reset in the tuning panel.

**Next step**

- Nico plays a few waves and sends notes plus tuning JSON: the feel of towers coming in and out, the new sounds, difficulty, money.
- Then session 3: enemies attack towers (Static: noise and crush; Muffler: low-pass and smaller range), tower destruction, leaks knocking drums out of the core, game over, endless scaling.

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
