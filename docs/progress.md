# Progress

## 2026-11-27 · Music engine v2 and chapters

From Nico's listen: "sounds like a garbage looped track from a kids game; the bar loops too quickly; the sounds are too basic; not all songs need a 4/4 kick; bigger levels in chapters". Built in one go (his choice), decisions in `design.md` (27 Nov 2026).

**Shipped**

- A new music engine. Songs are data (`src/music/songs/`); a composer writes every 16th from the song and the game state. Extended chords (9ths, sus, slash chords) with voice leading, composed 8-bar melodies plus answer phrases written as scale degrees, polymetric arps (5 against 8, 3 against 7), 2-bar patterns, fills every 8 bars, a key lift in a later section, filters opening across each wave.
- Four chapters, one song each:
  - Afterhours: progressive house, F minor, 122. The five training levels and Club Night.
  - Night Bus: UK garage / 2-step, C minor, 132, heavy shuffle. No four-on-the-floor; the foundation is the 2-step kick.
  - Seven Rivers: organic 7/8 (2+2+3), D dorian, 112. No kick at all; the foundation is a frame drum.
  - Low Tide: liquid drum & bass, E minor, 172.
- Real instruments: CC0 samples from Versilian Studios (VCSL, VSCO 2 CE): Steinway piano, FM electric piano, kalimba, marimba, vibraphone, string sections, flute, congas, bongos, cajon, darbuka, frame drum, snare, hi-hats, claps, shaker, tambourine. About 6 MB, loaded per song. Plus new synth voices: unison synths, FM bells and pianos, vowel-filtered vocal chops, synthesized drums.
- New mixer: per-song channels and levels, generated room and hall reverbs, tempo delay, sidechain pump per song.
- Breakdowns: when the core rests, the foundation drops out (instead of the whole core being muffled at 900 Hz), and builds come back with a riser, a snare roll speeding up and a reversed cymbal.
- Six new levels (two per new chapter) on bigger maps, 26×16 to 30×19, cells shrink to fit. Level select grouped by chapter. The core, perks, track view (any meter) and beat dots follow the song.
- Balance: tower damage is per bar (`refHits`), so busier parts never change difficulty. New tests: every song's melodies fit their chords on downbeats, every chapter level is winnable by an active player.

**Verified**

- 164 tests pass; build passes.
- Live playback load (Chrome playback stats, real towers fighting): 57 audio underruns in 45 s on the first try, 0 after the optimisation pass (lighter core channels, native crush, cached hat sounds, shared unison panners, cheaper idle towers), across Afterhours, Night Bus and Low Tide.
- Repetition, counted note for note: 14 to 16 of the 16 bars in a wave are different in every song (the old engine had at most 8: each wave was an 8-bar loop played twice).
- Offline renders of each song (`renders/preview-*.mp3`, not committed): spectrum now reaches the top octave (hats and percussion), the sub no longer swamps everything; peaks below 0 dBFS.

**Known issues**

- Nobody has heard it yet: mix levels, patch sounds and melodies are first drafts made by measurement, not by ear.
- Low end is still on the heavy side in Afterhours and Low Tide during waves (tuning panel: Core and Bass trims).
- Chapter level difficulty swings a lot with which rewards come up; first-pass numbers.
- On small cells (the 30×19 maps) the core box is cramped.
- Club Night (Endless) only plays Afterhours.

**Next step**

- Nico listens to the four previews and plays one level per chapter, then says in producer terms what still sounds cheap: which instrument, which section.
- Then: tune patches and mix by ear with him, and decide whether Endless should move through all four songs like a DJ set.

## 2026-11-25 · Goal: a complete, evaluable prototype (training levels, menu, rewards, music engine, Lift)

Built in one go at Nico's request, with design calls recorded in `design.md` (25 Nov 2026) for review.

**Shipped**

- Menu and flow: title screen, level select (6 cards, ✓ on cleared levels, saved in the browser), pause (Esc, Space or the button: resume, restart, level select), win and game-over screens with stats, next level / retry. Everything restarts in place, no page reloads.
  - `?level=level3` in the URL jumps straight into a level after the first click.
- Training levels, each on its own map with its own track (tempo, swing, pad level), one mechanic at a time, and a coach that shows one tip at a time and reacts to what you do:
  1. First Groove (Bass, 3 waves)
  2. Stabs (+ Chords, 4 waves)
  3. Hook Line (+ Arp, Lead, upgrades, 4 waves)
  4. Interference (enemy attacks, wrecks, repair, perks, 5 waves)
  5. Chemistry (combos, rewards, Lift, 6 waves)
  6. Club Night (Endless, everything)
  Locked towers show "later level"; locked mechanics explain when they unlock. A level is won when its last wave is cleared (the screen says "Track complete").
- Pick 1 of 3 rewards after each cleared wave (levels 5 and Endless). There are 12 rewards; each changes the game and the track at once: Shuffle (+swing, +damage), Saturation, Wide mix, Tip jar, Heavy sidechain, Long tail, Hot hands, four alternate tower parts (Rolling bass, Offbeat organ, Gallop arp, Answer phrase), Patch cable. The tray docks on the right, so the board stays visible and the music keeps playing.
- Lift (new, experimental): kills and combo hits fill a meter; press L or click it. At the next 8-bar phrase there's a riser, then an impact; for 8 bars the hats go double time, the pad swells, towers open fully and hit ×1.35.
- Music engine, "produced track" pass:
  - The core plays a pad: open voicing, 3 detuned saws per note spread in stereo, slow filter drift, pumping with the kick. It rests and opens with the core.
  - Arrangement: a riser into each wave, an impact on its first beat, a downlifter when it's cleared.
  - Turnarounds on the last bar of every 8-bar phrase: the kick drops beat 4, a clap roll, open hat.
  - Groove: laid-back clap (+7 ms) and hats (+3 ms), loose shaker and rim, velocity humanizing, the whole track breathing against the kick (-2.5 dB, deeper with Sidechain).
  - Bass passing notes into each chord change (a scale step below the next root).
  - Wider chord stabs (detuned saws panned L/R) with slight per-stab filter variation; the lead glides between close notes and has delayed vibrato; delay throw on the lead's last note of a phrase; the arp's filter breathes across the phrase.
  - Master: light tape saturation, a pink-noise floor (-50 dB) and vinyl crackle (-46 dB).
  - Every new number is in the tuning panel: Groove, Atmosphere, Lift, Rewards, Pad, and a section per level.
- Balance by simulation: a "good" bot and a "casual" bot on every level. Doing nothing loses every level; the good bot wins all five training levels; the casual bot wins levels 1, 3 and 4 almost always, and loses levels 2 and 5 sometimes.
- 137 unit tests (+22): level maps (continuous path, never touching itself, ends at the core), coach order, pad voicing and passing notes, turnarounds, risers and impacts, level rules and victory, rewards (offers, uniques, effects, alternate parts), Lift.

**Verified after the first build (same day)**

- Full playthrough of Level 1 through the real UI (clicks, coach, three waves) to "Track complete": 12 kills, no leaks.
- A full-run render of Level 5, with the real engine and a scripted player, saved as `renders/level5-arc.wav` (intro, the rise, wave 1, a Lift). Measured over time: resting bars about -15 dB and dark, wave and Lift bars about -12 dB and 5–7× brighter, chords following the progression, peak under 0 dBFS.
- Real-time headroom: with every layer fighting, all upgrades, all perks and a Lift, the audio clock kept exact pace with the wall clock over 20 s (no dropouts).
- Bugs found and fixed:
  - **The whole mix was mono.** Tone.Channel sums its input to mono, so wide stabs, the pad and the ping-pong delay were flattened. Channels are now stereo; percussion is spread left and right; stabs and pad are wider. Width above 300 Hz went from 0.06–0.12 to 0.11–0.22.
  - **Taps could land on the wrong cell.** The first click of a level and every touch tap used a stale pointer position. Positions are now computed from the screen on every event.
  - Master and limiter lowered for headroom after the stereo fix made the mix louder.
- Dev tool: `src/dev/fullRender.ts` renders any level offline and saves a WAV to `./renders` (dev server only).

**Second verification round (same day, live site, real clicks and keys)**

| Level | Result | Waves | Kills | Core left |
| --- | --- | --- | --- | --- |
| 1 · First Groove | Track complete | 3 | 12 | full |
| 2 · Stabs | Track complete | 4 | 32 | full |
| 3 · Hook Line | Track complete | 4 | 36 | full |
| 4 · Interference | Track complete | 5 | 50 | 12/12 |
| 5 · Chemistry (combos, rewards, Lift) | Track complete | 6 | 83 | 5/9 (wave 6 took 4 layers) |
| Club Night (Endless) | Lost on purpose at wave 8 | 6 cleared | 81 | 0/9 |

- In Level 5, all three combos lit up from placement alone, 4 rewards were picked by clicking cards, and Lift fired from the L key on the next 8-bar phrase three times.
- In Club Night, with 7 towers and no building after wave 6, the core went from 9/9 to 0 in waves 7–8 with $447 unspent.
- Next level, Replay and Try again all start a fresh run with wave 1 on time.
- Bugs found and fixed in this round:
  - **Waves never started after Next level / Retry.** Late transport ticks from the old run leaked into the new one. The new run now ignores ticks before its own start.
  - **Coach tips could be skipped.** They rode on the droppable visual-sync queue; they now use their own queue that never drops.

**Difficulty simulation (same day)**

- New dev tool `src/dev/simulate.ts`: plays a level headless with a scripted player who checks in every bar (repairs, picks a reward, fires Lift, spends on towers next to the path, upgrades, perks).
- Active player: wins every training level with 0 leaks. In Club Night they clear 14 waves perfectly, then lose in waves 15–16. That is where good cells run out (24 towers) while enemy toughness keeps compounding 22% a wave.
- Player who barely builds: loses Level 5 by wave 4 and Club Night by wave 2.
- So the drop I hit live (wipe at wave 7–8) came from stopping building, not from a bad curve. The real cliff is at the end of a good Club Night run.
- `tests/difficulty.test.ts` now guards this: every training level stays winnable, Level 5 still punishes hoarding, Club Night lasts 8+ waves and still ends.

**Known issues**

- Everything was tuned by measurement, simulation and scripted playthroughs; nobody has listened to it or play-tested it for fun yet.
- Lift is the first new mechanic; it may be too strong or too rare. Lift numbers are in the panel.
- Club Night (Endless) is harsh on the first wave if towers are placed far from the path. A good run ends abruptly (perfect for 14 waves, wiped in 2); whether that should be a slope instead is Nico's call (Endless "HP growth" and "+ per wave" in the panel).
- The training levels may be too easy for a player who builds well every bar; a casual live run of Level 5 lost 4 core layers in wave 6, the scripted active player lost none.
- The coach card sits bottom-left over the board; on small windows it can cover a corner of the map.
- Call & response still deviates from the original draft (crits on any lead hit).

**Next step**

- Nico plays the five training levels in order and Club Night, and answers: is it fun? Which level teaches best? Does the track sound produced? Is Lift worth keeping?
- Then build order step 8: balance and polish from those notes.

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
