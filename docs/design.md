# Rhythm TD Design Doc v0.1

Last updated Nov 27, 2026 (music engine v2 and chapters). Source of truth for design decisions.

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

Everything runs on one clock: a 16th-note grid. Each chapter's song sets its own tempo, meter and key (see "Chapters" below): 122 BPM 4/4 for chapter 1, up to 172 BPM, and 7/8 in chapter 3. A wave is 16 bars.

Harmony comes from the song: each wave plays one of the song's sections, a 16-bar chord progression with extended chords (9ths, sus, slash chords) and a composed 8-bar melody plus an 8-bar answer. There is no background bed: the core is the floor, and towers add everything else.

### The core

From 27 Nov 2026 the core is whatever holds the chapter's song up: a 2-step kick in garage, a frame drum in the 7/8 chapter. Each song lists its core layers in drop-out order; the last one is the foundation, and losing it ends the run. The table below is chapter 1 (Afterhours, progressive house).

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
| Sidechain | Bass next to Chords | Both hit harder in the half beat right after each kick (×1.5), and both audibly pump with the kick |
| Call and response | Lead next to Arp | Lead hits can be critical (30% chance, double damage). Built this way because the lead never plays on the backbeat; to confirm |
| Full band | Bass, Chords and Arp touching (a chain counts) | All of them reach 20% further |

Touching includes diagonals. Built in sessions 4+5; numbers are in the tuning panel.

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
- Map randomization and more enemies (chapters, levels and genre variety are now in: see 27 Nov 2026)
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

Decided on 6 Oct 2026, after testing session 3:

- Sessions 4 and 5 are built together (one-time exception to one milestone per session)
- Idle and fighting towers sit closer together (less quiet, less filtered), and towers fade in over about a beat instead of snapping open
- A clear wave indicator: wave number, seconds to the next wave, wave progress, and a banner when a wave starts
- Progressions, 8 bars each (2 bars per chord), one per wave, cycling: Am7–Fmaj7–Cmaj7–G, Am7–Dm7–Fmaj7–Em7, Fmaj7–G–Am7–Am7, Am7–Em7–Fmaj7–G, Dm7–Am7–Fmaj7–G. The lead hook follows the current chord and changes shape each wave; the arp changes direction each wave
- Tower upgrades are per tower: the upgraded pattern (more hits, more attacks) plus more damage and range, from the next bar
- Core perks: Shaker, Rim/perc and Open hat. Each adds groove and one more drum's worth of core health, and drops out before the hats
- Combos: build the drafts (Sidechain, Call and response, Full band). Sidechain also makes the chords and bass audibly pump with the kick

Decided on 25 Nov 2026, from Nico's goal ("a more complete prototype with training levels, a menu, a richer music engine, new mechanics that build music; at least 3–4 next phases"). Nico asked for this to be built without check-ins, so these are Claude's calls inside his brief, listed for review:

- **Training levels (reopens "campaign" from the out-of-scope list, at Nico's request).** Five short levels, each teaching one thing, then Endless:
  1. First Groove: one tower (Bass), the core, towers playing when enemies come near.
  2. Stabs: Chords, area hits and stun, money, spreading towers along the path.
  3. Hook Line: Arp and Lead, range, upgrades.
  4. Interference: enemies attack towers, wrecks and repair, core perks.
  5. Chemistry: combos, the pick-1-of-3 rewards and Lift.
  6. Endless (Club Night): everything, the big map.
  Each level has its own map, its own track (tempo, swing, progressions, sound palette) and a coach that explains one step at a time. Win a level by surviving its waves. All levels stay unlocked so Nico can test any of them; completed levels get a check mark saved in the browser (a small exception to "no saves").
- **Menu:** title screen, level select, pause (resume, restart, quit), win and game-over screens, restart without reloading the page.
- **Pick 1 of 3 rewards** (build order step 6), after each cleared wave in levels that use them. Every reward changes both the game and the music, for example Shuffle (+swing, +damage), alternate tower patterns, combo boosts, a stereo-wide mix (+range), saturation (+damage).
- **Music engine, "produced track" pass** (build order step 7):
  - A pad played by the core (chord-following, slow, wide, very quiet) for atmosphere. This is a core sound, not a background bed.
  - Transitions: a riser in the bar before a wave, an impact on its first downbeat, a downlifter when a wave is cleared.
  - Automatic turnarounds on phrase ends: small drum variations (clap roll, kick drop, open hat). These are arrangement, not player-triggered fills, which stay out of scope.
  - Groove: micro-timing per instrument (laid-back clap, loose shaker), velocity humanising, a gentle always-on pump of the music against the kick, and a bass approach note into each chord change.
  - Richer synths: wider chord stabs, lead glide and vibrato, delay throws at phrase ends, a light tape saturation and a noise floor (vinyl and room) on the master.
- **New mechanic, experimental: Lift.** Kills and combo hits fill a Lift meter. When it's full, press L (or the button) and the track lifts at the next 8-bar phrase: the core opens fully, the pad swells, the hats double, and all towers hit harder for 8 bars. It is quantized to the phrase, not a timing input; drops in the original sense stay out of scope.
- **Level and track numbers live in `tuning.ts`** as one section per level, so they stay in the tuning panel.

Decided on 27 Nov 2026, after Nico listened: "still sounds like a garbage looped track from a kids game... the bar loops too quickly, the sounds are too basic... maybe not all songs need a 4/4 kick... build bigger levels from different chapters". Answers to Claude's questions: chapters each with their own groove; free samples plus better synths; Claude writes original parts (no copying real tracks); go all the way before the next listen.

- **Chapters (genre forks are in).** Four chapters, one song each, every song with its own tempo, meter, key, core and sound palette:
  1. Afterhours: progressive house, F minor, 122. The five training levels.
  2. Night Bus: UK garage / 2-step, C minor, 132, heavy shuffle. No four-on-the-floor; the 2-step kick is the foundation.
  3. Seven Rivers: organic 7/8 (2+2+3), D dorian, 112. No kick at all; a frame drum is the foundation.
  4. Low Tide: liquid drum & bass, E minor, 172.
  Chapters 2 to 4 have two levels each on bigger maps (26×16 to 30×19, cells shrink to fit the same screen), 7 to 9 waves. Club Night (Endless) stays on Afterhours.
- **The core is per song**: its layers, drop-out order and foundation come from the song. Perks are the song's three extra layers, priced by tier in tuning.
- **Towers keep their four roles** (Bass slows, Chords stun, Arp fast and long, Lead heavy), but what they play is the song's: e.g. in Night Bus the Arp is vocal chops and the Lead a bell; in Seven Rivers they are a marimba and a flute.
- **Long-form music instead of loops**: chords every 2 to 4 bars, 2-bar patterns, 8-bar melodies with an answer phrase, arpeggios whose note cycle runs against the bar (5 against 8, 3 against 7), filters that open across each wave, fills every 8 bars, a key lift in a later section.
- **Breakdowns**: when the core rests between waves, the foundation drops out and the rest of the core is only gently filtered, then a build (riser, snare roll, reversed cymbal) and an impact bring it back. Replaces the heavy low-pass.
- **Samples**: CC0 (public domain) instruments and percussion from Versilian Studios (VCSL and VSCO 2 CE): grand piano, FM electric piano, kalimba, marimba, vibraphone, glockenspiel, string sections, flute, congas, bongos, cajon, darbuka, frame drum, snare, hi-hat, claps, shaker, tambourine. About 6 MB, loaded per song.
- **Balance stays independent of the music**: a tower's damage is per bar, split over however many notes its part plays, so a busier part sounds busier without being stronger.
- **Songs are content files** (`src/music/songs/`): patterns, melodies, chords, instrument designs and the song's own mix. Gameplay numbers and global mix trims stay in `tuning.ts` and the panel.
