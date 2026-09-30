# Rhythm TD Design Doc v0.1

Last updated Sep 30, 2026. Source of truth for design decisions.

## Concept

A tower defense where the defense is the track. Every tower is an instrument layer on a house loop, enemies attack the sound itself, and the run ends when the music goes silent. The first build is a browser prototype in endless mode, sequencer-first, with no timing input.

Design pillars, in priority order:

1. The defense is the track. Placing and upgrading towers is composing. A good defense and a good groove should be the same thing most of the time.
2. It always sounds musical. Everything snaps to the beat grid and the key. Playing badly makes the track thinner or messier, never unlistenable.
3. No two runs sound the same. Random map layouts, enemy mixes and sound variations mean each player ends up with a different track.
4. The music is your health. A destroyed tower mutes its instrument. When the last layer drops, you lose.

Working title: none yet. "Rhythm TD" is a placeholder.

## Precedents

The core idea has been built at least six times since 2012, and none became a breakout. Melodefense from 2013 is almost exactly this concept: six towers mapped to kick, snare, hats, bass, arp and chords, and enemies that silence a loop when they destroy its tower. For a learn-and-have-fun project that is fine. It does mean the interesting part is the execution, not the premise.

| Game | Status | How music ties to play | Lesson for us |
| --- | --- | --- | --- |
| [Melodefense](https://www.indiedb.com/games/melodefense) | Global Game Jam 2013 prototype, later a Unity build | Each tower type starts a 16-step loop and fires on its pattern. A scanner sweeps the board and plays a note when it crosses an enemy. | Closest match to our idea. The scanner that turns enemy positions into melody is worth stealing. |
| [Bad Hotel](https://en.wikipedia.org/wiki/Bad_Hotel) | Shipped 2012 (iOS), 2013 (PC). BAFTA winner 2012 | Every room adds a layer; defenses crumbling makes the track go flat | Metacritic 83 on iOS but 54 on PC. [One reviewer](https://kritiqal.com/articles/2013/12/25/bad-hotel-review) called the result clashing beeps that sent him to the mute button. Generative music without guardrails gets ugly. |
| [Rhythm Towers](https://store.epicgames.com/en-US/p/rhythm-towers-c3ef51) | Demo, Unreal 4 + FMOD. 13 Steam reviews on the 2024 demo | Towers built through rhythm matching; each one adds a music layer | The timing-input version exists and has little traction so far. Our sequencer-first choice avoids competing on it. |
| [Tuneful Towers](https://itch.io/post/12693413/view-in-topic) | Godot Wild Jam entry | Towers get random notes; a sequence editor lets you tidy them, and more musical sequences deal more damage | Players liked it but said there wasn't much to do. The music toy crowds out the strategy if we are not careful. |
| [Beatdown Path](https://foonghost.itch.io/beatdown-path) | GMTK Jam 2025 prototype, still in development, runs in the browser | Tower actions are notes placed in a rhythm sequencer | Proof that a browser build is enough to test this kind of concept. |
| [Sentinel](https://www.moddb.com/games/sentinel) | Shipped on PC/Mac/Linux, year not confirmed | Sequencer-like grid; building, collecting and killing trigger sounds on the beat | Cites Rez and Lumines as inspiration; worth a look for its grid presentation. |

What this means for the design:

- Commit to house. None of these lean into a genre's structure. Phrases, build-ups, drops and the DJ-style mixing of layers are the part nobody has done well.
- Guardrails are required. Bad Hotel shows what happens when every action makes a sound with no key or grid discipline.
- Strategy has to stand on its own. Tuneful Towers shows that the music can carry a jam game but not a longer session.

## Core loop

Endless mode for the prototype: build, let the new layer drop in on the bar, survive a 16-bar wave, repeat. Campaign levels come later.

Loop, in order:

1. Place or upgrade towers (any time; costs currency).
2. The new layer enters on the next bar, like a queued Ableton clip.
3. A 16-bar wave plays. Towers fire on their steps; each kill adds a note.
4. Enemies attack the sound. Noise and filters degrade instruments; a destroyed tower mutes its layer.
5. Any layers left? Yes: earn currency, next wave is harder, back to step 1. No: silence, the run is over.

Placing and upgrading can happen at any time, but nothing enters mid-bar. That rule keeps the track in time no matter how fast or badly you play.

## Systems

Everything runs on one clock: 124 BPM, 4/4, a 16-step grid per bar. At that tempo one bar lasts about 1.9 seconds and a 16-bar phrase about 31 seconds, which is the length of a wave.

Harmony for the prototype: A minor, alternating Am7 and Fmaj7 every 2 bars, so a wave is 4 cycles of the vamp. Kill notes come from the A minor pentatonic scale (A, C, D, E, G), which fits both chords. The background stays silent; only towers make sound.

### Towers are instruments

A tower plays its pattern and attacks on the same steps, so you hear every shot. New towers join like clips launched in Ableton's Session view: queued, then entering on the next bar. Upgrades change the pattern, for example hats going from 8ths to 16ths, which means more hits and a busier groove.

| Tower | Plays | Attacks on | Combat role |
| --- | --- | --- | --- |
| Kick | Four on the floor | Every beat (steps 1, 5, 9, 13) | Heavy single-target hit, short range |
| Clap | Backbeat | Beats 2 and 4 | Area pulse that briefly stuns |
| Hats | Offbeat 8ths, 16ths when upgraded | Offbeats | Fast, light damage, long range |
| Bass | Offbeat bassline on the chord root | Offbeats, 1 or 2 per beat | Slows enemies along a stretch of path |
| Later: chord stab, arp, pad, riser | Harmony and lead layers | Their own patterns | Buffs, chain hits, shields, charging a drop |

### Enemies attack the sound

Enemies walk the path and attack towers in range. The damage is audible on that tower's instrument before it becomes lethal.

Movement is smooth, but attacks and sound effects only land on the 16th-note grid. An enemy hovers in place for the moment it hits, so the board flows and the audio stays in time.

| Enemy | What you hear | Game effect | In MVP |
| --- | --- | --- | --- |
| Static | Noise and bitcrush creeping into the instrument | Tower takes damage | Yes |
| Muffler | A low-pass filter closing on the instrument | Tower range shrinks while hit | Yes |
| Detuner | The synth drifts out of tune, capped at 30 to 50 cents | Tower misfires some steps | Later |
| Ducker | Everything pumps and ducks, like heavy sidechain | All towers slow down briefly | Later |

Each kill also plays one note from the current chord on the next 16th, so a busy wave adds melody. This is a small version of Melodefense's scanner.

### The music is your health

- A destroyed tower mutes its layer until you rebuild it.
- An enemy that reaches the exit steals a random layer.
- Zero layers playing means game over.

### Guardrails that keep it musical

- All pitched sounds come from the run's key and chord progression. Nothing can play a wrong note.
- Every event is quantized to the 16th-note grid.
- Tower patterns come from curated presets, not free programming, in the MVP.
- Disruptions are effects with hard limits (filter floor, max detune, noise level), and a limiter sits on the master.

### Variety between runs

Each run picks a path layout from a set of templates, a key and progression from a curated list, one of three sound variations per instrument, and a random enemy mix per wave. Two players should end up with different tracks.

### Combos

Music ideas get game names and plain-language rules, so nobody needs theory to use them. Players who produce music will spot them faster. Three to start:

| Combo | Setup | Effect |
| --- | --- | --- |
| Sidechain | Kick next to bass | Bass hits harder on the 16th right after each kick |
| Groove | Clap next to hats | Hats get a critical-hit chance on the backbeat |
| Full kit | Kick, clap and hats all touching | All three get more range |

### Economy and rewards

- One currency, earned per kill, spent any time to place or upgrade. This lets you rework the track live between waves.
- After each wave: pick 1 of 3 rewards, such as a new pattern, a combo boost or a modifier like +10% swing. This is the seed of the roguelike layer.
- A second, rarer currency waits for meta-progression in phase 2.

## Tech stack

Build the prototype as a browser game in TypeScript, with Tone.js for audio and Phaser for the game layer. Web does not limit the design we have. The real limit is consoles, which are out of scope anyway.

| Layer | Pick | Why |
| --- | --- | --- |
| Audio | [Tone.js](https://github.com/Tonejs/Tone.js) | Built around DAW ideas: a global transport, bars:beats:sixteenths timing, sequences, synths, samplers and effects. Actively maintained, last push April 2026 per [gittrend](https://gittrend.io/repo/Tonejs/Tone.js). |
| Game | Phaser 3 | Full 2D framework with scenes, input, tweens and sprites. Less to build by hand than PixiJS. |
| Language and build | TypeScript + Vite | Standard setup, fast reloads, and the stack Claude Code handles best. |
| Desktop later | Tauri or Electron wrapper | Same code packaged for Mac and PC, including Steam. |
| Mobile later | Capacitor wrapper | Same code as an iOS and Android app. |

One architecture rule matters more than any library choice: the audio clock is the master. Game logic runs on the Tone.js transport's 16th-note ticks, and the visuals only draw what the logic decided. Games that run gameplay on the frame loop and try to sync audio to it drift out of time.

Evidence that web can ship: [Vampire Survivors](https://en.wikipedia.org/wiki/Vampire_Survivors) ran on Phaser through its Steam, Xbox and mobile launches and only moved to Unity from version 1.6. The Phaser team's own [devlog](https://phaser.io/devlogs/279) names consoles as the reason, since JavaScript does not run on them easily.

Known web limits to plan around:

- Consoles are not realistic without a port to another engine.
- Heavy live synthesis can stutter on low-end phones. Samples are cheaper than synths, so use samples for drums.
- Browsers only start audio after a tap or click, so the game needs a start screen. On iPhone, the silent switch can also mute web audio (from memory, not verified for 2026).

Fallback if we outgrow the web: Godot. It exports to desktop, mobile and consoles through third parties, but the rhythm and sequencing layer would have to be rebuilt by hand.

## MVP prototype

The prototype answers one question: does placing towers feel like building a track, with a real decision each wave? Rough guess, not a commitment: 6 to 8 Claude Code sessions of 2 to 3 hours for a first playable build.

### In scope

- One map with one fixed path and a placement grid
- 124 BPM, A minor, Am7 and Fmaj7 vamp, silent background
- Four towers: kick, clap, hats, bass, each with a base pattern and one upgraded pattern
- Two enemies, Static and Muffler, moving smoothly and hitting on the grid
- Endless waves of 16 bars, getting harder each wave
- Kill notes from the A minor pentatonic scale
- Layers as health: destroyed towers mute, leaks steal a layer, silence ends the run
- One currency from kills
- Pick 1 of 3 rewards after each wave
- Three adjacency combos: Sidechain, Groove, Full kit
- Start screen to unlock audio, plus a HUD with bar and beat, active layers and currency
- A tuning panel opened with a key, for BPM, tower damage, range and cost, enemy HP and speed, effect strength and volumes. You tune the game without touching code.
- Placeholder art: simple shapes that pulse on their beats
- A live URL updated after each session, so you can test on your laptop and phone

### Out of scope for now

- On-beat timing inputs, drops and fills
- Exporting a run as audio
- Genre forks, campaign levels, map randomization and more enemies
- Rare currency, saves and meta-progression
- Background beds, desktop and mobile packaging, and final art

### How we judge it

- [ ] After 10 minutes, it feels like building a track, for you and at least 3 friends
- [ ] Each wave has a real placement decision, not just placing everything you can afford
- [ ] The track is good enough that you'd want to record it, and a losing run still sounds listenable
- [ ] A tester can tell by ear which tower is under attack

If it is not fun on its own after tuning, the concept stops here. Later ideas do not rescue a weak core loop.

## Roadmap

Four phases, each gated on a play test rather than a date. At 2 to 4 hours a week, dates would be fiction.

1. Prototype: sequencer loop, 4 towers, 2 enemies, endless mode. Gate: MVP passes its 4 checks.
2. Depth: random maps and keys, 4 more towers, Detuner and Ducker. Gate: friends replay it unprompted.
3. Timing layer: on-beat drops and fills, input calibration, mobile feel check. Gate: decide whether to release or keep it personal.
4. Campaign and ship: levels, art, sounds, Steam via Tauri, mobile via Capacitor.

The timing layer (the hybrid part of the idea) waits until phase 3, once the sequencer loop has proven it is fun on its own.

## Later: the roguelike direction

This is what sets the game apart: none of the six precedents is a roguelike. It starts in phase 2, only if the prototype passes.

- Every run randomizes key, progression, map and sound kit, always inside the musical guardrails.
- Balatro framing. Knowing music helps you find combos faster, the way knowing poker helps in Balatro, but it is never required.
- Genre forks. Runs start in baseline house and can branch. Tempo stays inside the house range, roughly 118 to 128 BPM. A fork changes the palette, adds towers and changes one rule.

| Fork | Palette | New tower idea | Rule change |
| --- | --- | --- | --- |
| Disco house | Filtered disco loops, strings, open hats | String stab that buffs its neighbors | A filter opens over each wave and tower range grows with it |
| Deep house | Rhodes chords, round sub bass | Chord tower that shields nearby towers | Sustained notes deal damage over time |
| Progressive house | Arps, pads, long builds | Arp tower that chains hits across enemies | 32-bar waves with bigger drops |

Also parked for later: the drop (a riser, then a damage burst on the downbeat), exporting a run as audio, and a rare currency for unlocks between runs.

## Risks and decisions

The biggest risk is design, not tech: the game ends up as a nice music toy with thin strategy.

| Risk | Why it matters | Plan |
| --- | --- | --- |
| Music toy, thin game | Tuneful Towers players liked it and ran out of things to do | Hard gate: the prototype has to be fun alone. Pick 1 of 3 and combos give it decisions from day one. |
| Hard to read by ear | Four layers plus enemy effects can blur into one sound | Expect several iterations on enemy effects, starting subtle. Effect strength sits in the tuning panel. |
| Suno does not fit the layer system | The system needs short loops locked to 124 BPM and the key. Suno makes full songs. | Suno for background beds only, later. Anything special gets made in Ableton. Check Suno's license before anything goes public. |
| Scope creep at 2 to 4 hours a week | Every added feature pushes the first playable build further out | Claude Code builds, you test and give feedback. Out-of-scope list holds until the prototype passes. More time goes in only if it works. |
| You don't read the code | Quality can drift without anyone noticing | Short sessions, a rules file for Claude Code with the design constraints, automated tests on timing logic, and a playable URL after every session |

Decided on 30 Sep 2026:

- Enemies move smoothly and hit on the 16th-note grid
- Silent background for the prototype
- One currency per kill; a rare currency waits for phase 2
- A minor, Am7 and Fmaj7 vamp
- Grid placement
- Pick 1 of 3 and adjacency combos are in the prototype; the drop and run export are not
