# Rhythm TD

A browser tower defense where the defense is the track. Design: [`docs/design.md`](docs/design.md). Progress: [`docs/progress.md`](docs/progress.md).

Play: https://nicoandronowicz.github.io/rhythm-td/ (add `?level=level3` to jump straight into a level after the first click).

```bash
npm install
npm run dev     # local dev server
npm test        # unit tests
npm run build   # type-check + production build
```

Songs live in `src/music/songs/` (one per chapter). Samples are CC0 (Versilian Studios VCSL and VSCO 2 CE); to rebuild them from the source libraries:

```bash
node scripts/fetch-samples.mjs   # downloads ~240 MB of WAVs into samples-src/ (git-ignored)
node scripts/build-samples.mjs   # trims and compresses them into public/samples (needs ffmpeg)
```
