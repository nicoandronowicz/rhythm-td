# Progress

## 2026-10-06 · Sessions 4 + 5: Bigger map, less repetition, upgrades, perks and combos

Built together at Nico's request, with session 4 committed as a checkpoint first.

**Shipped**

- Session 4:
  - Map: 22×14 grid on the same screen (40 px cells) with a 55-cell winding path (was 29): two loops, and corners where one tower covers two stretches. The core is now a 3×4 block.
  - Music: five 8-bar progressions in A minor (2 bars per chord), one per wave, cycling: Am7–Fmaj7–Cmaj7–G, Am7–Dm7–Fmaj7–Em7, Fmaj7–G–Am7–Am7, Am7–Em7–Fmaj7–G, Dm7–Am7–Fmaj7–G.
    - The lead picks notes that fit the current chord (chord tones plus pentatonic notes that don't rub) and gets a new hook shape each wave (5 shapes).
    - The arp walks the chord in a new direction each wave (up, up-down, down, broken).
  - Wave indicator: big wave number; "N enemies left · next wave in Xs" or "Clear · wave N in Xs"; a progress bar; a "WAVE N" banner when a wave starts and "WAVE N CLEARED" when it's done.
  - Towers less on/off: idle is now -9 dB and 1.5 kHz (was -15 dB and 700 Hz). Towers fade in over a beat and settle back over two.
  - Enemies are faster for the longer path. Static: 1.0 cells/beat, Muffler: 0.75.
- Session 5:
  - Tower upgrades, per tower. Click a tower to upgrade it; it switches to its upgraded pattern on the next bar (more hits, more attacks), with more damage and range. A chevron badge marks it. The layer plays the upgraded part whenever an upgraded tower of that type is playing.
  - Core perks: click the core for Shaker ($60), Rim/perc ($80, tuned to E) and Open hat ($100). Each joins on the next bar, adds groove and one more drum's worth of core health, and drops out before the hats. A perk can be bought again after it drops.
  - Combos (touching, diagonals count), with links drawn on the board and a shout when one forms:
    - Sidechain: bass + chords hit ×1.5 in the half beat after each kick, and both channels pump with the kick (-9 dB).
    - Call & response: lead + arp gives the lead a 30% chance of a double-damage crit, played as an accent with a CRIT pop.
    - Full band: bass, chords and arp in one touching cluster reach 20% further.
- New sounds balanced by measurement against the kick: shaker about -13 dB, rim about -10, open hat about -10. The full mix with all 10 parts peaks at -0.7 dBFS.
- Difficulty, simulated: a plain build with repairs lasts to wave 11; with upgrades, 13; combo-aware placement, 13; combos + upgrades + perks, 16.
- 113 unit tests (+15): progressions, safe lead notes across every chord/motif/bar, arp styles, harmony switching per wave, combo detection, upgrades, perks, sidechain/crit/full band effects.

**Known issues**

- Call & response deviates from the draft (crits on any lead hit, not the backbeat). Needs Nico's OK.
- Clicking a tower now upgrades it, so a click meant to start a drag can spend money if the mouse doesn't move. Drag threshold is 6 px.
- Tower shapes are smaller on the bigger map; may be hard to read on a phone.
- Sounds and difficulty were set by measurement and simulation, not by ear or real play.

**Next step**

- Nico plays several waves with upgrades, perks and combos, and checks whether the progressions and changing hooks fix the repetition. Send tuning JSON.
- Then session 6: pick 1 of 3 rewards after each wave.

## 2026-10-02 · Session 3: The beat is your health

**Shipped**

- Feedback from session 2, recorded in `design.md` and `CLAUDE.md`, then built:
  - Idle towers no longer cut to silence. They play quiet and low-passed, "in the distance" (-15 dB, 700 Hz), open up on their next step when an enemy comes in range, and settle back over a beat.
  - The more enemies near a fighting tower, the brighter it gets: the filter opens from 4.5 kHz with one enemy to fully open at four, and it plays a bit harder.
  - The core rests between waves. Once a wave has fully spawned and the path is empty, the drums go low-passed (900 Hz) and 6 dB down. In the last bar before the next wave the filter sweeps open, so the wave lands on the full beat.
- Enemies attack towers, on the 16th grid, pausing for the moment they hit:
  - Static: 2 damage every half bar, plus noise crackle on the tower's hits and bitcrush on its channel.
  - Muffler: a wobbling, resonant low-pass closing on the tower (an 8th-note wobble, so it doesn't sound like idle), and up to 20% less range. No damage.
  - Caps on every effect: crush mix, noise level, filter floor. Towers recover over 2 bars once the attacks stop.
- Tower health, with health bars and shake when hit. A destroyed tower becomes a cracked, silent wreck that enemies ignore. Click it to repair for half its price; it comes back on the next bar at full health. Removing a wreck refunds nothing.
- Core health: each drum takes 3 leaks. Hats drop out first, then clap, then kick. Health shows as pips on the core and "CORE 9 / 9" in the HUD. Kick gone = silence: the run freezes, the mix fades over 2 bars, and a "The beat stopped" screen shows waves survived and Play again.
- Rebalanced by simulation now that losing is real: tower health doubled, Static slowed down, Muffler range loss capped at 20%. A 4-tower defense lasts to about wave 6, 8 towers to about wave 7, and a full build with repairs to about wave 11.
- 95 unit tests (13 new): enemy attack cadence and hovering, effect caps and recovery, muffled range, wreck and repair, wreck refund, drum drop order, game over freeze, core rest/rise/active, idle vs fighting, enemies near a tower.

**Known issues**

- Sounds and difficulty set by measurement and simulation, not by ear or real play.
- Play again reloads the page, so you click start again.
- Static's noise only plays on the hits of an attacked tower, so a tower that's idle and filtered hides most of it. That's probably right, but listen for it.
- Saved tuning from earlier sessions still applies; press Reset in the panel if something sounds off.

**Next step**

- Nico plays to a game over a couple of times and sends notes and tuning JSON. Questions to answer: can you hear which tower is under attack? Does idle "in the distance" sound right? Does the core's rest and rise feel good?
- Then session 4: bigger map (about 22×14) and less repetitive music (8-bar progressions in A minor, a new progression and hook each wave).

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
