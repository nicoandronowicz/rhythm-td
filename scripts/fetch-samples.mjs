// Dev-only: download the CC0 source samples into ./samples-src (git-ignored).
// Sources: Versilian Community Sample Library (VCSL) and VSCO 2 Community Edition, both CC0-1.0.
//   node scripts/fetch-samples.mjs
// Then run scripts/build-samples.mjs to trim and compress them into public/samples.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const OUT = 'samples-src';
const NOTE = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
const midiOf = (name) => {
  const m = /(?:^|_)([A-G]#?)(-?\d)(?=_|\.|$)/.exec(name);
  return m ? NOTE[m[1]] + (Number(m[2]) + 1) * 12 : null;
};

function tree(repo) {
  const json = execFileSync('gh', ['api', `repos/sgossner/${repo}/git/trees/HEAD?recursive=1`], { maxBuffer: 1 << 28 });
  return JSON.parse(json).tree.filter((x) => x.type === 'blob' && /\.wav$/i.test(x.path));
}

/** Pitched: in `dir`, files matching `tag`, notes in [lo, hi], at most one per `spacing` semitones. */
function pitched(files, dir, tag, lo, hi, spacing) {
  const pool = files
    .filter((f) => f.path.startsWith(dir) && tag.test(f.path.split('/').pop()))
    .map((f) => ({ f, midi: midiOf(f.path.split('/').pop()) }))
    .filter((x) => x.midi !== null && x.midi >= lo && x.midi <= hi)
    .sort((a, b) => a.midi - b.midi);
  const out = [];
  let last = -Infinity;
  for (const x of pool) {
    if (x.midi - last < spacing) continue;
    out.push(x.f);
    last = x.midi;
  }
  return out;
}

const all = (files, dir) => files.filter((f) => f.path.startsWith(dir));

const vcsl = tree('VCSL');
const vsco = tree('VSCO-2-CE');
const I = 'Idiophones/Struck Idiophones/';
const M = 'Membranophones/Struck Membranophones/';
const picks = [
  ['VCSL', pitched(vcsl, 'Chordophones/Zithers/Grand Piano, Steinway B/', /_vl3_rr1/, 36, 96, 8)],
  ['VCSL', pitched(vcsl, 'Electrophones/TX81Z/FM Piano/', /_vl2/, 36, 90, 5)],
  ['VCSL', all(vcsl, 'Idiophones/Plucked Idiophones/Kalimba, Kenya/')],
  ['VCSL', pitched(vcsl, `${I}Marimba/`, /_med_01/, 36, 96, 3)],
  ['VCSL', pitched(vcsl, `${I}Vibraphone/`, /bowed/, 36, 96, 3)],
  ['VCSL', pitched(vcsl, `${I}Vibraphone/`, /hard_.*_v2_rr1/, 40, 90, 4)],
  ['VCSL', pitched(vcsl, `${I}Glockenspiel/`, /loud_.*_01/, 60, 108, 4)],
  ['VCSL', all(vcsl, `${M}Conga/`)],
  ['VCSL', all(vcsl, `${M}Bongos/`)],
  ['VCSL', all(vcsl, `${I}Shaker, Small/`)],
  ['VCSL', all(vcsl, `${I}Cajon/`)],
  ['VCSL', all(vcsl, `${I}Claps/`)],
  ['VCSL', all(vcsl, `${M}Darbuka/`)],
  ['VCSL', all(vcsl, `${M}Frame Drum/`)],
  ['VCSL', all(vcsl, `${I}Hi-Hat Cymbal/`)],
  ['VCSL', all(vcsl, `${M}Snare Drum, Modern 1/`)],
  ['VCSL', all(vcsl, `${I}Tambourine 1/`)],
  ['VSCO-2-CE', pitched(vsco, 'Strings/Violin Section/susVib/', /_v1/, 40, 100, 3)],
  ['VSCO-2-CE', pitched(vsco, 'Strings/Cello Section/susvib/', /_v1_/, 30, 80, 3)],
  ['VSCO-2-CE', pitched(vsco, 'Strings/Violin Section/Pizz/', /_v1_rr1/, 40, 100, 1)],
  ['VSCO-2-CE', pitched(vsco, 'Woodwinds/Flute/susNV/', /_v1_/, 50, 100, 1)],
  ['VSCO-2-CE', all(vsco, 'VSCO 1 Percussion/varWood/log_drum/')],
];

let bytes = 0;
let n = 0;
for (const [repo, files] of picks) {
  for (const f of files) {
    const dest = join(OUT, repo, f.path);
    bytes += f.size;
    n++;
    if (process.env.DRY || existsSync(dest)) continue;
    mkdirSync(dirname(dest), { recursive: true });
    const url = `https://raw.githubusercontent.com/sgossner/${repo}/HEAD/${f.path.split('/').map(encodeURIComponent).join('/')}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
    process.stdout.write('.');
  }
}
console.log(`\n${n} files, ${(bytes / 1e6).toFixed(1)} MB`);
