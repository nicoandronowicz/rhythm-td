# Rhythm TD

A browser tower defense where the defense is the track. A drum core at the end of the path always plays the beat; each tower is a melodic layer that plays while it fights, enemies attack the sound, and the run ends when the kick drops.

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
- New towers, upgrades and restored layers enter on the next bar, never mid-bar. A tower that engages an enemy starts on its next pattern step and holds to the end of the bar.
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
- Melodic notes come from the current chord or A minor pentatonic (A C D E G). Kill notes are dropped for now.
- No background bed. The drum core always plays; towers add everything else.

Drum core (always on, 16 steps, x = hit). Core upgrades add percussion layers (shaker, rim, ride...):

| Drum | Pattern | Drops out |
| --- | --- | --- |
| Hats | `..x...x...x...x.` | first (after any added percussion) |
| Clap | `....x.......x...` | second |
| Kick | `x...x...x...x...` | last = game over |

Tower patterns (drafts, tune by ear with Nico):

| Tower | Base | Upgraded |
| --- | --- | --- |
| Bass | `..x...x...x...x.`, chord root | adds 16th pickups, root and octave |
| Chords | `...x......x..x..`, house stab on the current chord | adds a stab |
| Arp | `x.x.x.x.x.x.x.x.`, chord tones going up | all 16ths |
| Lead | `x......x..x.....`, pluck hook from the pentatonic | adds a note |

Sound: synthesized for now (the kick is accepted; samples may come later, ask first). Each drum and each tower type gets its own channel with an insert chain: noise/bitcrush and a low-pass filter, both neutral by default. Enemy effects drive those inserts.

The mix has to sound good on laptop speakers and headphones. Aim for "Nico wants to record it", not "it technically plays".

## Game rules (prototype)

- One map, one fixed path, grid placement beside the path.
- The drum core sits at the end of the path and always plays. Core health is split across its drum layers; leaked enemies knock them out (added percussion, then hats, clap, kick). Kick gone = game over. Core upgrades add percussion = fuller groove + more health.
- Towers play, and attack on the steps they play, only while an enemy is in range; they hold to the end of the bar after the last target leaves. Several towers of one type = one sound, separate attacks.
- Combat roles: lead = heavy single target, short range; chords = area pulse with a short stun; arp = fast light damage, long range; bass = slows enemies on a stretch of path.
- Enemies: Static (noise and crush creep into the attacked tower's channel, deals damage) and Muffler (closes the low-pass on the attacked tower, shrinks its range while attacking).
- A destroyed tower goes silent until rebuilt. It costs defense, not life.
- One currency, earned per kill, spent any time on towers, tower upgrades or core upgrades.
- After each wave: pick 1 of 3 rewards (new pattern, combo boost, or a modifier like +10% swing).
- Combos by adjacency, drafts to confirm in session 4: Sidechain (bass next to chords: both hit harder on the 16th after each kick), Call and response (lead next to arp: lead crits on the backbeat), Full band (bass, chords and arp touching: more range).
- Endless waves, each harder than the last.
- Start screen with a click to unlock audio. HUD: bar and beat, wave, core health (drum layers), currency.
- Placeholder art: simple shapes that pulse on their beats. Each tower type has one color.

## Build order

One milestone per session. Don't start the next until Nico has tested the current one.

1. Sound first. Scaffold, deploy to GitHub Pages, start screen, transport, grid, place the 4 towers (free for now), layers enter on the next bar, pulses on beat, HUD bar:beat, basic tuning panel. Goal: does the groove sound good? (Done; led to the drum-core redesign.)
2. Core, path and enemies. Drum core at the path's end, the 4 melodic towers (bass, chords, arp, lead), Static and Muffler walking the path, towers engaging and attacking on their steps, currency and costs.
3. The beat is your health. Enemies attack towers, audible damage, tower destruction, leaks damaging the core, drums dropping out, game over, endless wave scaling.
4. Upgrades (towers and core) and combos.
5. Pick 1 of 3 rewards.
6. Balance and polish pass from Nico's play-test notes.

## Out of scope

On-beat timing inputs, drops, run export, genre forks, campaign, map randomization, more enemies, rare currency, saves, background beds, desktop or mobile packaging, final art. See `docs/design.md`.
