/**
 * Dev-only: render a real run of a level offline, with the real engine and a scripted player,
 * then save it as a WAV in ./renders and measure how it changes over time.
 *
 *   const r = await import('/src/dev/fullRender.ts'); await r.renderLevel('level5', 48)
 */

import * as Tone from 'tone';
import { Session } from '../app/session';
import { AudioEngine } from '../audio/engine';
import { perkLayers } from '../game/core';
import { pathCells, type Cell } from '../game/grid';
import { levelById, type LevelId } from '../game/levels';
import type { TowerType } from '../game/towers';
import { toWav } from './wav';

interface BarLog {
  bar: number;
  core: string;
  wave: number;
  section: number;
  enemies: number;
  lifted: boolean;
  chord: string;
}

/** Cells next to the path, best coverage first. */
function goodCells(session: Session): Cell[] {
  const map = session.level.map;
  const path = pathCells(map).map((c) => ({ x: c.col + 0.5, y: c.row + 0.5 }));
  const out: { cell: Cell; cov: number }[] = [];
  for (let col = 0; col < map.cols; col++) {
    for (let row = 0; row < map.rows; row++) {
      const cell = { col, row };
      if (!session.world.canBuild(cell)) continue;
      const cov = path.filter((p) => Math.hypot(p.x - col - 0.5, p.y - row - 0.5) <= 1.6).length;
      if (cov) out.push({ cell, cov });
    }
  }
  return out.sort((a, b) => b.cov - a.cov).map((c) => c.cell);
}

export async function renderLevel(id: LevelId, bars = 48, opts: { towers?: number; liftAtBar?: number; name?: string; perks?: boolean; mute?: string[]; save?: boolean; waveNow?: boolean } = {}) {
  const level = levelById(id);
  const log: BarLog[] = [];
  const probe = new Session(level);
  const song = probe.song;
  const bpm = song.bpm + probe.tuning.transport.tempo;
  const spb = song.stepsPerBar;
  const barSeconds = (60 / bpm / 4) * spb;
  const seconds = bars * barSeconds + 3;
  // Like Tone.Offline, but renders synchronously (Tone's async render crawls in a background tab).
  const original = Tone.getContext();
  const offline = new Tone.OfflineContext(2, seconds, 44100);
  Tone.setContext(offline);
  const engine = new AudioEngine();
  await engine.init({ offline: true });
  const session = new Session(level);
  await engine.prepare(session.song);
  const w = session.world;
  const t = session.tuning;
  w.money = 100000;
  const types: TowerType[] = [...level.towers];
  goodCells(session)
    .slice(0, opts.towers ?? 10)
    .forEach((cell, i) => w.place(types[i % types.length]!, cell, t));
  if (level.features.upgrades) for (const tw of w.board.all().slice(0, 3)) w.upgrade(tw.id, t);
  if (level.features.perks && opts.perks !== false) for (const p of perkLayers(song)) w.buyPerk(p.id, t);
  w.money = 0;
  if (opts.waveNow) t.waves.firstDelayBars = 0;
  engine.load(session);
  for (const m of opts.mute ?? []) engine.muted.add(m);
  engine.beforeStep = (step) => {
    for (const tw of w.board.all()) if (tw.state === 'wreck') w.repair(tw.id, t);
    if (w.rewardOffer) w.chooseReward(w.rewardOffer[0]!);
    if (opts.liftAtBar !== undefined && step === opts.liftAtBar * spb && level.features.lift) {
      w.hype = 1;
      w.requestLift();
    }
    if (step % spb === 0) {
      const st = w.waves.status(step);
      const pos = w.position(step / spb, st.wave);
      log.push({
        bar: step / spb + 1,
        core: w.coreMode(step, st),
        wave: st.wave,
        section: pos.section,
        enemies: w.enemies.size,
        lifted: w.isLifted(step),
        chord: pos.chord.name,
      });
    }
  };
  engine.play();
  const t0 = performance.now();
  const rendered = await offline.render(false);
  const renderSeconds = (performance.now() - t0) / 1000;
  Tone.setContext(original);
  const buf = rendered.get() as AudioBuffer;
  const name = opts.name ?? `${id}-run`;
  let file = '';
  if (opts.save !== false) file = await (await fetch(`/__save-render?name=${name}`, { method: 'POST', body: toWav(buf) })).text();
  return { file, renderSeconds, audioSeconds: seconds, bpm, song: song.id, log, stats: measureOverTime(buf, barSeconds, log) };
}

/**
 * Per-bar loudness, brightness, width and lows, plus how much each bar differs from the 8 before it
 * (`fresh`: 0 = an exact repeat of a recent bar, higher = something changed).
 */
export function measureOverTime(buf: AudioBuffer, barSeconds: number, log: BarLog[]) {
  const L = buf.getChannelData(0);
  const R = buf.getChannelData(1);
  const sr = buf.sampleRate;
  const barLen = Math.floor(sr * barSeconds);
  const offset = Math.floor(sr * 0.12); // the transport starts 0.12 s in
  const rows: { bar: number; label: string; chord: string; db: number; width: number; bright: number; lows: number; fresh: number }[] = [];
  const prints: number[][] = [];
  let peak = 0;
  for (let i = 0; i < L.length; i++) peak = Math.max(peak, Math.abs(L[i]!), Math.abs(R[i]!));
  const a150 = 1 - Math.exp((-2 * Math.PI * 150) / sr);
  const a2k = 1 - Math.exp((-2 * Math.PI * 2000) / sr);
  for (const entry of log) {
    const start = offset + (entry.bar - 1) * barLen;
    if (start + barLen > L.length) break;
    let mid = 0;
    let side = 0;
    let diffSq = 0;
    let lowSq = 0;
    let prev = 0;
    let lp = 0;
    let lp2 = 0;
    // Fingerprint: energy in 3 bands over 32 slices of the bar.
    const slices = 32;
    const print = new Array(slices * 3).fill(0);
    for (let i = start; i < start + barLen; i++) {
      const m = (L[i]! + R[i]!) / 2;
      const s = (L[i]! - R[i]!) / 2;
      mid += m * m;
      side += s * s;
      diffSq += (m - prev) * (m - prev);
      prev = m;
      lp += (m - lp) * a150;
      lp2 += (m - lp2) * a2k;
      lowSq += lp * lp;
      const k = Math.min(slices - 1, Math.floor(((i - start) / barLen) * slices));
      print[k * 3] += lp * lp;
      print[k * 3 + 1] += (lp2 - lp) * (lp2 - lp);
      print[k * 3 + 2] += (m - lp2) * (m - lp2);
    }
    const norm = Math.sqrt(print.reduce((a, b) => a + b * b, 0)) || 1;
    const p = print.map((x) => x / norm);
    let best = 0;
    for (const q of prints.slice(-8)) best = Math.max(best, p.reduce((a, x, i) => a + x * q[i]!, 0));
    prints.push(p);
    const n = barLen;
    const label = entry.lifted ? 'LIFT' : entry.core === 'active' ? `wave ${entry.wave} s${entry.section + 1}` : entry.core;
    rows.push({
      bar: entry.bar,
      label,
      chord: entry.chord,
      db: Math.round(10 * Math.log10(mid / n + 1e-12) * 10) / 10,
      width: Math.round(Math.sqrt(side / (mid + 1e-12)) * 100) / 100,
      bright: Math.round(Math.sqrt(diffSq / (mid + 1e-12)) * 1000) / 1000,
      lows: Math.round((lowSq / (mid + 1e-12)) * 100) / 100,
      fresh: prints.length > 1 ? Math.round((1 - best) * 10000) / 10000 : 1,
    });
  }
  const fresh = rows.slice(1).map((r) => r.fresh);
  return {
    peakDb: Math.round(20 * Math.log10(peak) * 10) / 10,
    /** Share of bars that are near-exact repeats of one of the 8 before. */
    repeats: Math.round((fresh.filter((f) => f < 0.002).length / Math.max(1, fresh.length)) * 100) / 100,
    rows,
  };
}
