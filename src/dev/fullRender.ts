/**
 * Dev-only: render a real run of a level offline, with the real engine and a scripted player,
 * then save it as a WAV in ./renders and measure how it changes over time.
 *
 *   const r = await import('/src/dev/fullRender.ts'); await r.renderLevel('level5', 48)
 */

import * as Tone from 'tone';
import { Session } from '../app/session';
import { AudioEngine } from '../audio/engine';
import { pathCells, type Cell } from '../game/grid';
import { levelById, type LevelId } from '../game/levels';
import type { TowerType } from '../game/towers';
import { toWav } from './offline';

interface BarLog {
  bar: number;
  core: string;
  wave: number;
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

export async function renderLevel(id: LevelId, bars = 48, opts: { towers?: number; liftAtBar?: number; name?: string } = {}) {
  const level = levelById(id);
  const log: BarLog[] = [];
  let bpm = 124;
  // Long enough for the slowest track tempo.
  const seconds = (bars * 240) / 118 + 2;
  // Like Tone.Offline, but renders synchronously: Tone's async render waits on timers between chunks,
  // which crawl when the page is in the background.
  const original = Tone.getContext();
  const offline = new Tone.OfflineContext(2, seconds, 44100);
  Tone.setContext(offline);
  await (async () => {
    const session = new Session(level);
    const w = session.world;
    const t = session.tuning;
    bpm = t.transport.bpm;
    // A decent player: towers along the path, a couple of upgrades and perks.
    w.money = 100000;
    const types: TowerType[] = [...level.towers];
    goodCells(session)
      .slice(0, opts.towers ?? 10)
      .forEach((cell, i) => w.place(types[i % types.length]!, cell, t));
    if (level.features.upgrades) for (const tw of w.board.all().slice(0, 3)) w.upgrade(tw.id, t);
    if (level.features.perks) for (const p of ['shaker', 'rim', 'openhat'] as const) w.buyPerk(p, t);
    w.money = 0;

    const engine = new AudioEngine();
    await engine.init({ offline: true });
    engine.load(session);
    engine.beforeStep = (step) => {
      for (const tw of w.board.all()) if (tw.state === 'wreck') w.repair(tw.id, t);
      if (w.rewardOffer) w.chooseReward(w.rewardOffer[0]!);
      if (opts.liftAtBar !== undefined && step === opts.liftAtBar * 16 && level.features.lift) {
        w.hype = 1;
        w.requestLift();
      }
      if (step % 16 === 0) {
        const st = w.waves.status(step);
        log.push({
          bar: step / 16 + 1,
          core: w.coreMode(step, st),
          wave: st.wave,
          enemies: w.enemies.size,
          lifted: w.isLifted(step),
          chord: w.harmonyAt(step / 16, st.wave).chord.name,
        });
      }
    };
    engine.play();
  })();
  const rendered = await offline.render(false);
  Tone.setContext(original);
  const buf = rendered.get() as AudioBuffer;
  const name = opts.name ?? `${id}-run`;
  const res = await fetch(`/__save-render?name=${name}`, { method: 'POST', body: toWav(buf) });
  const file = await res.text();
  return { file, bpm, log, stats: measureOverTime(buf, bpm, log) };
}

/** Per-bar loudness, brightness and stereo width, grouped by what was going on. */
export function measureOverTime(buf: AudioBuffer, bpm: number, log: BarLog[]) {
  const L = buf.getChannelData(0);
  const R = buf.getChannelData(1);
  const sr = buf.sampleRate;
  const barLen = Math.floor((sr * 240) / bpm);
  const offset = Math.floor(sr * 0.12); // transport started 0.12 s in
  const rows: { bar: number; label: string; db: number; width: number; bright: number; lows: number }[] = [];
  let peak = 0;
  for (let i = 0; i < L.length; i++) peak = Math.max(peak, Math.abs(L[i]!), Math.abs(R[i]!));
  for (const entry of log) {
    const start = offset + (entry.bar - 1) * barLen;
    if (start + barLen > L.length) break;
    let mid = 0;
    let side = 0;
    let diffSq = 0;
    let lowSq = 0;
    let prev = 0;
    let lp = 0;
    for (let i = start; i < start + barLen; i++) {
      const m = (L[i]! + R[i]!) / 2;
      const s = (L[i]! - R[i]!) / 2;
      mid += m * m;
      side += s * s;
      // Brightness: energy of the first difference (high frequencies) vs the signal.
      diffSq += (m - prev) * (m - prev);
      prev = m;
      // Lows: a one-pole low-pass around 150 Hz.
      lp += (m - lp) * (1 - Math.exp((-2 * Math.PI * 150) / sr));
      lowSq += lp * lp;
    }
    const n = barLen;
    const label = entry.lifted ? 'LIFT' : entry.core === 'active' ? `wave ${entry.wave}` : entry.core;
    rows.push({
      bar: entry.bar,
      label,
      db: Math.round(10 * Math.log10(mid / n + 1e-12) * 10) / 10,
      width: Math.round(Math.sqrt(side / (mid + 1e-12)) * 100) / 100,
      bright: Math.round(Math.sqrt(diffSq / (mid + 1e-12)) * 1000) / 1000,
      lows: Math.round((lowSq / (mid + 1e-12)) * 100) / 100,
    });
  }
  return { peakDb: Math.round(20 * Math.log10(peak) * 10) / 10, rows };
}
