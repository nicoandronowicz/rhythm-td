// Dev-only: turn ./samples-src (raw CC0 WAVs, see fetch-samples.mjs) into small MP3s in public/samples,
// plus public/samples/manifest.json. Needs ffmpeg.
//   node scripts/build-samples.mjs
//
// Per file: trim leading silence, cap the length, fade the tail, convert (mono unless the group is stereo).
// Levels: pitched groups share one gain (the loudest note peaks at -1 dBFS); percussion is levelled per articulation.

import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = 'samples-src';
const OUT = 'public/samples';
const TMP = join(SRC, '.tmp');
const NOTE = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
const midiOf = (name) => {
  const m = /(?:^|_)([A-G]#?)(-?\d)(?=_|\.|$)/.exec(name);
  return m ? NOTE[m[1]] + (Number(m[2]) + 1) * 12 : null;
};

function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.wav$/i.test(e)) out.push(p);
  }
  return out;
}
const files = walk(SRC).filter((p) => !p.includes('.tmp'));
const find = (folder, re) => files.filter((p) => p.includes(`/${folder}/`) && re.test(p.split('/').pop()));

/**
 * Groups. `pitched`: keyed by MIDI note. Otherwise `arts` maps an articulation name to a filename
 * pattern; every match becomes a round-robin variant.
 */
const GROUPS = [
  { id: 'piano', folder: 'Grand Piano, Steinway B', re: /_vl3_rr1/, pitched: true, stereo: true, max: 5 },
  { id: 'epiano', folder: 'FM Piano', re: /_vl2/, pitched: true, max: 3.5 },
  { id: 'kalimba', folder: 'Kalimba, Kenya', re: /./, pitched: true, max: 3 },
  { id: 'marimba', folder: 'Marimba', re: /_med_01/, pitched: true, max: 2.2 },
  { id: 'vibes', folder: 'Vibraphone', re: /hard_.*_v2_rr1/, pitched: true, max: 3.5 },
  { id: 'bowed', folder: 'Vibraphone', re: /bowed/, pitched: true, stereo: true, max: 6 },
  { id: 'glock', folder: 'Glockenspiel', re: /loud_.*_01/, pitched: true, max: 2.5 },
  { id: 'violins', folder: 'susVib', re: /VlnEns/, pitched: true, stereo: true, max: 6 },
  { id: 'cellos', folder: 'susvib', re: /^susvib/, pitched: true, stereo: true, max: 6 },
  { id: 'pizz', folder: 'Pizz', re: /VlnEns_Pizz/, pitched: true, max: 1.4 },
  { id: 'flute', folder: 'susNV', re: /LDFlute/, pitched: true, max: 4.5 },
  {
    id: 'conga', folder: 'Conga', max: 1.2,
    arts: { low: /Tumba_HitN_v3/, lowMute: /Tumba_HitFM_v3/, open: /Conga_HitN_v3/, slap: /Conga_HitFM_v2/, high: /Quinto_HitN_v3/, highSlap: /Quinto_HitFM1_v2/, ghost: /Conga_HitN_v1/ },
  },
  { id: 'bongo', folder: 'Bongos', max: 1, arts: { high: /BongoH_Hit1_v3/, highMute: /BongoH_HitMuted1_v3/, low: /BongoL_Hit1_v3/, lowMute: /BongoL_HitMuted2_v3/, ghost: /BongoH_Hit1_v1/ } },
  { id: 'shaker', folder: 'Shaker, Small', max: 1.2, arts: { slap: /Shaker_Slap/, up: /ShakerHighFaster_Up/, down: /ShakerHighFaster_Down/, roll: /Shaker_Roll_Fast/ } },
  { id: 'cajon', folder: 'Cajon', max: 1, arts: { bass: /hit1_f_/, slap: /hit2_f_/, tip: /hit3_mp/, ghost: /hit2_pp/ } },
  { id: 'clap', folder: 'Claps', max: 1, arts: { group: /^Clap_rr/, solo: /SoloClap_vl[34]/ } },
  { id: 'darbuka', folder: 'Darbuka', max: 1, arts: { doum: /Darbuka_1_hit_vl2/, tek: /Darbuka_3_hit_vl2/, ka: /Darbuka_4_hit_vl2/, slap: /Darbuka_5_hit_vl2/, ghost: /Darbuka_3_hit_vl1/ } },
  { id: 'frame', folder: 'Frame Drum', max: 1.6, arts: { low: /HDrumL_Hit_v3/, lowMute: /HDrumL_HitMuted_v3/, high: /HDrumS_Hit_v3/, highMute: /HDrumS_HitMuted_v3/ } },
  { id: 'hihat', folder: 'Hi-Hat Cymbal', max: 1.4, arts: { closed: /HitC_v3/, soft: /HitC_v1/, tight: /HiHat_Close/, open: /HiHat_HitO_/, loose: /HitLoose/ } },
  { id: 'snare', folder: 'Snare Drum, Modern 1', max: 1.1, arts: { hit: /HitSN_v6/, hard: /HitSN_v9/, ghost: /HitSN_v3/, stick: /stick_v1/, roll: /rollSN_v4/ } },
  { id: 'tamb', folder: 'Tambourine 1', max: 1.2, arts: { hit: /Hit_v2/, shake: /Shake/ } },
  { id: 'logdrum', folder: 'log_drum', max: 1.2, arts: { d0: /slitdrum0_ff/, d1: /slitdrum1_ff/, d2: /slitdrum2_ff/, d3: /slitdrum3_ff/ } },
];

const ff = (args) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args]);
function measure(wav) {
  const r = execFileSync('sh', ['-c', `ffmpeg -hide_banner -i "${wav}" -af volumedetect -f null - 2>&1 | grep max_volume`]).toString();
  return Number(/max_volume: (-?[\d.]+) dB/.exec(r)[1]);
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
mkdirSync(TMP, { recursive: true });
const manifest = {};
let total = 0;

for (const g of GROUPS) {
  // 1. Collect (key, source) pairs.
  const items = [];
  if (g.pitched) {
    const seen = new Set();
    for (const f of find(g.folder, g.re)) {
      const midi = midiOf(f.split('/').pop());
      if (midi === null || seen.has(midi)) continue;
      seen.add(midi);
      items.push({ key: String(midi), src: f });
    }
  } else {
    for (const [art, re] of Object.entries(g.arts)) {
      find(g.folder, re).sort().forEach((f, i) => items.push({ key: `${art}${i + 1}`, art, src: f }));
    }
  }
  if (!items.length) throw new Error(`No files for ${g.id}`);

  // 2. Trim + cap + fade into temp WAVs, and find the group's loudest peak.
  const fade = Math.min(0.4, g.max * 0.3);
  const peaks = {};
  for (const it of items) {
    it.tmp = join(TMP, `${g.id}_${it.key}.wav`);
    const filters = [
      'silenceremove=start_periods=1:start_threshold=-55dB:start_duration=0',
      `atrim=0:${g.max}`,
      `afade=t=out:st=${(g.max - fade).toFixed(3)}:d=${fade.toFixed(3)}`,
    ];
    ff(['-i', it.src, '-af', filters.join(','), '-ac', g.stereo ? '2' : '1', '-ar', '44100', it.tmp]);
    const k = g.pitched ? "all" : it.art;
    peaks[k] = Math.max(peaks[k] ?? -Infinity, measure(it.tmp));
  }

  // 3. Encode with the shared gain.
  mkdirSync(join(OUT, g.id), { recursive: true });
  const entry = g.pitched ? { kind: 'pitched', notes: {} } : { kind: 'perc', arts: {} };
  for (const it of items) {
    const rel = `${g.id}/${it.key}.mp3`;
    ff(['-i', it.tmp, '-af', `volume=${(-1 - peaks[g.pitched ? "all" : it.art]).toFixed(2)}dB`, '-c:a', 'libmp3lame', '-q:a', g.stereo ? '4' : '5', join(OUT, rel)]);
    total += statSync(join(OUT, rel)).size;
    if (g.pitched) entry.notes[it.key] = rel;
    else (entry.arts[it.art] ??= []).push(rel);
  }
  manifest[g.id] = entry;
  process.stdout.write(`${g.id}(${items.length}) `);
}

writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 1));
writeFileSync(
  join(OUT, 'LICENSE.txt'),
  'All samples in this folder are derived from CC0-1.0 (public domain) libraries by Versilian Studios:\n' +
    '- Versilian Community Sample Library (VCSL): https://github.com/sgossner/VCSL\n' +
    '- VSCO 2 Community Edition: https://github.com/sgossner/VSCO-2-CE\n' +
    'Trimmed, levelled and converted to MP3 by scripts/build-samples.mjs.\n',
);
rmSync(TMP, { recursive: true, force: true });
console.log(`\n${(total / 1e6).toFixed(2)} MB`);
