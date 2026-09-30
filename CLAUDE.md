# Rhythm TD

A browser tower defense where the defense is the track. Each tower is an instrument layer on a house loop, enemies attack the sound, and the run ends when the music goes silent.

`docs/design.md` is the source of truth for design. Read it at the start of every session. If this file and the design doc disagree, the design doc wins; flag the conflict.

## Working with Nico

- Nico designs and tests. He does not read code. You own the code, its quality and its tests.
- Explain everything in plain language: what changed, what he should hear and see, what to try.
- Before any decision that changes the design (rules, feel, scope), ask. Implementation choices are yours.
- Nico can produce music. Ask him when a sound is off; he can describe it in producer terms.
- Keep the out-of-scope list in `docs/design.md` closed. Suggest ideas in `docs/ideas.md` instead of building them.

End every session with:

1. What changed, in 3 to 5 bullets
2. How to test it on the live URL (what to click, what to listen for)
3. Open questions for Nico
4. A new entry in `docs/progress.md` (date, what shipped, known issues, next step)

## Stack

- TypeScript (strict), Vite, Phaser (latest stable), Tone.js (latest stable). Check npm for current versions; don't rely on memory.
- Vitest for tests.
- Deploy to GitHub Pages through a GitHub Actions workflow on every push to `main`.
- No backend. No other runtime dependencies without asking.

## Non-negotiable rules

### 1. The audio clock is the master

- All musical timing runs on the Tone.js transport. Never use `setTimeout`, `setInterval` or the Phaser frame loop for anything musical.
- Game logic advances on a 16th-note tick scheduled on the transport. Tower firing, enemy hits, damage, spawns and kill notes are decided on that tick.
- Schedule sounds at the transport time you were given (look-ahead), never at "now".
- Visuals only draw what the logic already decided. Sync visual beat events with `Tone.Draw` (or the current equivalent).
- Enemy movement is smooth in the frame loop, but anything that hits or makes sound happens on the tick. An enemy pauses ("hovers") for the moment it hits.

### 2. It always sounds musical

- Every pitched note comes from one music module (key, chords, scale). Nothing else is allowed to pick a pitch.
- Every event is quantized to the 16th-note grid.
- New towers, upgrades and restored layers enter on the next bar, never mid-bar.
- Enemy sound effects have hard caps (filter floor, max noise and crush level). Keep a limiter on the master.
- Tower patterns are curated presets, not free programming.

### 3. Everything tunable lives in one place

- All numbers (BPM, damage, range, cost, HP, speed, spawn rates, effect strength, volumes, combo values) live in `src/config/tuning.ts`.
- A tuning panel toggled with the `T` key edits them live. It saves to localStorage and has "Copy as JSON" and "Reset" buttons, so Nico can send you values that feel right.

### 4. Data-driven content

Towers, enemies, combos and rewards are defined as data (typed objects). Adding one should not require new game logic.

### 5. Tests on the parts that can break silently

Unit test the music module, pattern and quantization logic, next-bar queueing, combo detection, and wave generation. Run tests and a production build before every push.

## Musical spec (prototype)

- 124 BPM, 4/4, 16 steps per bar. A wave is 16 bars.
- Key: A minor. Chords alternate every 2 bars: Am7 (A C E G), then Fmaj7 (F A C E).
- Kill notes: A minor pentatonic (A C D E G), one note on the next 16th after a kill, soft and short.
- Silent background. Only towers make sound.

Tower patterns (16 steps, x = hit):

| Tower | Base | Upgraded |
| --- | --- | --- |
| Kick | `x...x...x...x...` | same, harder hit + extra ghost on step 15 |
| Clap | `....x.......x...` | adds `...............x` flam on the last 16th |
| Hats | `..x...x...x...x.` | all 16ths, accents on offbeats |
| Bass | `..x...x...x...x.`, chord root | adds 16th pickups, root and octave |

Sound: synthesize everything at first (Tone.js synths for kick, clap, hats, bass). If drums sound thin, propose swapping to CC0 samples and ask first. Each tower type gets its own channel with an insert chain: noise/bitcrush and a low-pass filter, both neutral by default. Enemy effects drive those inserts.

The mix has to sound good on laptop speakers and headphones. Aim for "Nico wants to record it", not "it technically plays".

## Game rules (prototype)

- One map, one fixed path, grid placement beside the path.
- Towers attack on the steps they play. Combat roles: kick = heavy single target, short range; clap = area pulse with a short stun; hats = fast light damage, long range; bass = slows enemies on a stretch of path.
- Enemies: Static (noise and crush creep into the attacked tower's channel, deals damage) and Muffler (closes the low-pass on the attacked tower, shrinks its range while attacking).
- Layers are health: a destroyed tower mutes its layer until rebuilt. A leaked enemy mutes a random active layer. Zero layers playing = game over.
- One currency, earned per kill, spent any time.
- After each wave: pick 1 of 3 rewards (new pattern, combo boost, or a modifier like +10% swing).
- Combos by adjacency: Sidechain (kick next to bass: bass hits harder on the 16th after each kick), Groove (clap next to hats: hats get a crit chance on the backbeat), Full kit (kick, clap and hats all touching: all three get more range).
- Endless waves, each harder than the last.
- Start screen with a click to unlock audio. HUD: bar and beat, wave, active layers, currency.
- Placeholder art: simple shapes that pulse on their beats. Each tower type has one color.

## Build order

One milestone per session. Don't start the next until Nico has tested the current one.

1. Sound first. Scaffold, deploy to GitHub Pages, start screen, transport, grid, place the 4 towers (free for now), layers enter on the next bar, pulses on beat, HUD bar:beat, basic tuning panel. Goal: does the groove sound good?
2. Path and enemies. Static and Muffler walking the path, towers attacking on their steps, kill notes, currency and costs.
3. The music is your health. Enemies attack towers, audible damage, tower destruction, muting, leaks, game over, endless wave scaling.
4. Upgrades and combos.
5. Pick 1 of 3 rewards.
6. Balance and polish pass from Nico's play-test notes.

## Out of scope

On-beat timing inputs, drops, run export, genre forks, campaign, map randomization, more enemies, rare currency, saves, background beds, desktop or mobile packaging, final art. See `docs/design.md`.
