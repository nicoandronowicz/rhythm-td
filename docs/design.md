# Rhythm TD Design Doc v0.1

Last updated Oct 2, 2026 (after the session 2 review). Source of truth for design decisions.

## Concept

A tower defense where the defense is the track. Every tower is an instrument layer on a house loop, enemies attack the sound itself, and the run ends when the music goes silent. The first build is a browser prototype in endless mode, sequencer-first, with no timing input.

Design pillars, in priority order:

1. The defense is the track. Placing and upgrading towers is composing. A good defense and a good groove should be the same thing most of the time.
2. It always sounds musical. Everything snaps to the beat grid and the key. Playing badly makes the track thinner or messier, never unlistenable.
3. No two runs sound the same. Random map layouts, enemy mixes and sound variations mean each player ends up with a different track.
4. The beat is your health. The drum core at the end of the path always plays; leaks knock drums out of it. When the kick drops, you lose.

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

Endless mode for the prototype: build, survive a 16-bar wave, repeat. Campaign levels come later.

Loop, in order:

1. Place or upgrade towers, or upgrade the drum core (any time; costs currency). New towers are ready from the next bar.
2. Between waves the drum core rests (filtered and quieter, ready) and the towers play softly in the distance. In the last bar before a wave the core's filter sweeps open.
3. A 16-bar wave walks the path. Each tower plays, and attacks, only while an enemy is in its range, so the track builds up as the wave moves down the path.
4. Enemies attack the sound. Noise and filters degrade instruments; a destroyed tower goes silent until rebuilt. Enemies that reach the core knock drums out of the beat.
5. Is the kick still playing? Yes: earn currency, next wave is harder, back to step 1. No: silence, the run is over.

Placing and upgrading can happen at any time, but nothing enters mid-bar. That rule keeps the track in time no matter how fast or badly you play.

## Systems

Everything runs on one clock: 124 BPM, 4/4, a 16-step grid per bar. At that tempo one bar lasts about 1.9 seconds and a 16-bar phrase about 31 seconds, which is the length of a wave.

Harmony for the prototype: A minor, alternating Am7 and Fmaj7 every 2 bars, so a wave is 4 cycles of the vamp. Melodic material comes from the current chord or the A minor pentatonic scale (A, C, D, E, G), which fits both chords. There is no background bed: the drum core is the floor, and towers add everything else.

### The drum core

The drums are not towers. They are the core: the thing you defend, sitting at the end of the path. Kick, clap and hats always play, so the track always has a beat, even between waves and even in a losing run. Between waves, with no enemies on the path, the core rests: low-passed and a bit quieter, ready. In the last bar before a wave its filter sweeps open, so the wave lands on the full beat.

| Drum | Pattern (16 steps) | Drops out |
| --- | --- | --- |
| Hats | `..x...x...x...x.` offbeat 8ths | First |
| Clap | `....x.......x...` backbeat | Second |
| Kick | `x...x...x...x...` four on the floor | Last. Kick gone = game over |

Upgrading the core (costs currency) adds a percussion layer, such as a 16th shaker, a rim or a ride. Each one makes the groove fuller and adds one more chunk of core health. Added percussion drops out before the hats.

### Towers are instruments

Towers are the melodic and harmonic layers. A tower plays its pattern and attacks on the same steps, so you hear every shot, but only while it is fighting:

- An enemy enters its range: the tower starts playing from its next step.
- The last enemy leaves or dies: the tower keeps playing to the end of the bar, then settles back to idle.
- Idle is not silent: an idle tower plays quiet and low-passed, heard in the distance. Fighting opens it up. In later waves, with enemies everywhere, most towers stay open.
- The more enemies in range, the brighter and harder the tower plays.
- How fast a tower engages (next step, next beat) and how long it holds are tunable.

This turns the path into the arrangement. Towers near the entrance come in first each wave, towers near the core come in last, and more towers along the path means the layer plays for longer. Placing is arranging.

Several towers of one type make one sound (it doesn't get louder), but each one attacks on its own. New towers are ready from the next bar, like clips launched in Ableton's Session view. Upgrades change the pattern: more hits, a busier part.

| Tower | Plays (draft patterns, tuned by ear) | Combat role |
| --- | --- | --- |
| Bass | Offbeat root `..x...x...x...x.`; upgrade adds 16th pickups, root and octave | Slows enemies along a stretch of path |
| Chords | House chord stab, syncopated `...x......x..x..`; upgrade adds a stab | Area pulse that briefly stuns |
| Arp | Chord tones going up in 8ths `x.x.x.x.x.x.x.x.`; upgrade to 16ths | Fast, light damage, long range |
| Lead | Sparse pluck hook from the pentatonic scale `x......x..x.....`; upgrade adds a note | Heavy single-target hit, short range |
| Later: pad, riser | Sustained and build-up layers | Buffs, shields, charging a drop |

### Enemies attack the sound

Enemies walk the path and attack towers in range. The damage is audible on that tower's instrument before it becomes lethal.

Movement is smooth, but attacks and sound effects only land on the 16th-note grid. An enemy hovers in place for the moment it hits, so the board flows and the audio stays in time.

| Enemy | What you hear | Game effect | In MVP |
| --- | --- | --- | --- |
| Static | Noise and bitcrush creeping into the instrument | Tower takes damage | Yes |
| Muffler | A resonant low-pass closing and wobbling on the instrument (the wobble tells it apart from an idle tower) | Tower range shrinks while hit | Yes |
| Detuner | The synth drifts out of tune, capped at 30 to 50 cents | Tower misfires some steps | Later |
| Ducker | Everything pumps and ducks, like heavy sidechain | All towers slow down briefly | Later |

Kill notes (a note on every kill) are dropped for now: the towers already carry the melody. They can come back if the waves feel too quiet.

### The beat is your health

- Enemies that reach the core damage it. Core health is split across its drum layers, and damage knocks them out one by one: added percussion first, then hats, then clap, then kick.
- The kick dropping means silence and game over.
- A destroyed tower becomes a silent wreck on the grid. Repairing it costs half its price (tunable); its layer comes back on the next bar. Losing towers hurts your defense, not your life.

### Guardrails that keep it musical

- All pitched sounds come from the run's key and chord progression. Nothing can play a wrong note.
- Every event is quantized to the 16th-note grid.
- Tower patterns come from curated presets, not free programming, in the MVP.
- Disruptions are effects with hard limits (filter floor, max detune, noise level), and a limiter sits on the master.

### Variety between runs

Each run picks a path layout from a set of templates, a key and progression from a curated list, one of three sound variations per instrument, and a random enemy mix per wave. Two players should end up with different tracks.

### Combos

Music ideas get game names and plain-language rules, so nobody needs theory to use them. Players who produce music will spot them faster. The first set was built on drum towers, so it is being redesigned for the melodic towers. Drafts, to confirm in session 4:

| Combo | Setup | Effect |
| --- | --- | --- |
| Sidechain | Bass next to Chords | Both hit harder on the 16th right after each kick |
| Call and response | Lead next to Arp | Lead gets a critical-hit chance on the backbeat |
| Full band | Bass, Chords and Arp all touching | All three get more range |

### Economy and rewards

- One currency, earned per kill, spent any time to place or upgrade towers, or to upgrade the drum core. This lets you rework the track live between waves.
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
- 124 BPM, A minor, Am7 and Fmaj7 vamp, no background bed
- A drum core (kick, clap, hats) at the end of the path that always plays, with core upgrades that add percussion
- Four melodic towers: bass, chords, arp, lead, each with a base pattern and one upgraded pattern, playing only while fighting
- Two enemies, Static and Muffler, moving smoothly and hitting on the grid
- Endless waves of 16 bars, getting harder each wave
- The beat as health: leaks knock drums out of the core, losing the kick ends the run; destroyed towers go silent until rebuilt
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

Decided on 30 Sep 2026, after testing session 1:

- The drums become the core at the end of the path. They always play; core health is heard as drums dropping out; kick gone = game over
- The core can be upgraded with extra percussion (fuller groove, more health)
- Towers are melodic layers: bass, chords, arp, lead, keeping the four combat roles (slow, area stun, fast long range, heavy single hit)
- Towers play only while an enemy is in range, holding to the end of the bar, so the wave's path becomes the arrangement
- Kill notes dropped for now
- Combos to be redesigned for the melodic towers (drafts above)

Decided on 2 Oct 2026, after testing session 2:

- Idle towers play quiet and low-passed instead of silent; more enemies in range = brighter and harder
- The core rests between waves (filtered, quieter) and sweeps open in the last bar before a wave
- Destroyed towers leave a wreck that can be repaired for half price
- Session 4: a bigger map on the same screen (about 22×14 cells, path about twice as long)
- Session 4: less repetition. An 8-bar progression in A minor instead of the 2-chord vamp, a hook and arp that change each wave, and a new progression in A minor each wave (curated list)
- Later, in a sound-depth session: pads or strings, richer synths, groove (sidechain pumping, width). Kept off the out-of-scope list as long as they are tower or core sounds, not a background bed
