# Kickoff: how to start

## Before the first session (10 minutes, once)

1. Create an empty folder, for example `rhythm-td`.
2. Put `CLAUDE.md` in the folder root and `design.md` in a `docs` subfolder.
3. Have a GitHub account ready. Claude Code will create the repo and turn on GitHub Pages with you.
4. Open the folder in Claude Code and paste the prompt below.

## Prompt for session 1

```
Read CLAUDE.md and docs/design.md fully before doing anything.

This is session 1 of the build order: "Sound first". I don't read code, so you own the implementation and I'll test in the browser.

Goal for today: a live URL where I can click to start, place kick, clap, hats and bass towers on a grid, and hear each layer come in on the next bar at 124 BPM. Towers pulse on their beats. The HUD shows bar and beat. The T key opens a basic tuning panel with BPM and a volume per tower. No enemies yet.

Steps:
1. Propose a short plan and the project structure, then wait for my OK.
2. Set up the repo, the GitHub Pages deploy and the tests.
3. Build the audio engine and transport first, with tests for quantization and next-bar queueing.
4. Build the grid, placement and visuals.
5. Deploy and give me the URL.

Spend real effort on the sounds. The groove should make me nod my head on laptop speakers. If a sound can't get there with synths, tell me and propose options.

End with the session summary CLAUDE.md asks for.
```

## Prompt for later sessions

```
Read CLAUDE.md, docs/design.md and docs/progress.md. We're on session [N] of the build order.

My test notes from last session:
- [what felt good]
- [what felt or sounded wrong]
- [tuning values, pasted from the panel's Copy as JSON]

Fix anything blocking from my notes first, then build the next milestone. Propose the plan before building.
```
