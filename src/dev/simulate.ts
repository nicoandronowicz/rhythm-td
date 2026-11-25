/**
 * Headless play-through of a level with a scripted player, for checking the difficulty curve.
 * Pure: no audio, no DOM. Used by tests/difficulty.test.ts and handy from the console.
 *
 * The player checks in once a bar, like a person glancing at the board: repairs wrecks, picks the first
 * reward, fires Lift when it is ready, then spends what is left on towers (best cells first, cycling the
 * level's tower types), upgrades and core perks. `skill` scales how much of the money it is willing to spend
 * (1 = spends everything, 0.5 = keeps half in the bank).
 */

import { tuningForLevel } from '../config/levelTuning';
import { DEFAULT_TUNING, type Tuning } from '../config/tuning';
import { Board } from '../game/board';
import { PERK_DRUMS } from '../game/core';
import { pathCells, type Cell } from '../game/grid';
import { levelById, type LevelId } from '../game/levels';
import type { TowerType } from '../game/towers';
import { waveSize } from '../game/waves';
import { rulesFor, towerStats, World } from '../game/world';

export interface WaveLog {
  wave: number;
  enemies: number;
  /** Enemies of this wave that reached the core. */
  leaks: number;
  /** Core layers left when the wave's bars ended. */
  coreLeft: number;
  coreTotal: number;
  towers: number;
  money: number;
}

export interface SimResult {
  victory: boolean;
  gameOver: boolean;
  wavesCleared: number;
  waves: WaveLog[];
}

function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Buildable cells next to the path, the ones covering the most path first. */
function goodCells(world: World, cols: number, rows: number, layout: Parameters<typeof pathCells>[0]): Cell[] {
  const path = pathCells(layout).map((c) => ({ x: c.col + 0.5, y: c.row + 0.5 }));
  const out: { cell: Cell; cov: number }[] = [];
  for (let col = 0; col < cols; col++) {
    for (let row = 0; row < rows; row++) {
      const cell = { col, row };
      if (!world.canBuild(cell)) continue;
      const cov = path.filter((p) => Math.hypot(p.x - col - 0.5, p.y - row - 0.5) <= 1.6).length;
      if (cov) out.push({ cell, cov });
    }
  }
  return out.sort((a, b) => b.cov - a.cov).map((c) => c.cell);
}

export function simulateLevel(
  id: LevelId,
  opts: { seed?: number; skill?: number; maxWaves?: number; tuning?: Tuning; stopBuildingAfterWave?: number } = {},
): SimResult {
  const level = levelById(id);
  const t = tuningForLevel(opts.tuning ?? DEFAULT_TUNING, level);
  const world = new World(new Board(level.map), t, mulberry(opts.seed ?? 1), rulesFor(level));
  const skill = opts.skill ?? 1;
  const maxWaves = opts.maxWaves ?? (t.waves.toWin || 15);
  const types: TowerType[] = [...level.towers];
  let next = 0;
  const waves: WaveLog[] = [];
  let lastWave = 0;
  let leaksThisWave = 0;

  for (let step = 0; step < 16 * 400; step++) {
    const st = world.waves.status(step);
    if (step % 16 === 0) {
      const building = opts.stopBuildingAfterWave === undefined || st.wave <= opts.stopBuildingAfterWave;
      if (world.rewardOffer?.length) world.chooseReward(world.rewardOffer[0]!);
      if (world.hype >= 1) world.requestLift();
      for (const tw of world.board.all()) if (tw.state === 'wreck') world.repair(tw.id, t);
      if (building) {
        const reserve = world.money * (1 - skill);
        const cells = goodCells(world, level.map.cols, level.map.rows, level.map);
        for (const cell of cells) {
          const type = types[next % types.length]!;
          if (world.money - towerStats(t, type).cost < reserve) break;
          if (world.place(type, cell, t).ok) next++;
        }
        for (const tw of world.board.all()) {
          if (world.money - world.upgradeCost(tw, t) < reserve) break;
          world.upgrade(tw.id, t);
        }
        for (const p of PERK_DRUMS) if (world.money - world.perkCost(p, t) >= reserve) world.buyPerk(p, t);
      }
    }

    const r = world.onStep(step, t);
    leaksThisWave += r.leaks.length;

    // Log a wave when the next one starts (or the run ends).
    const now = world.waves.status(step);
    if (now.wave !== lastWave || world.gameOver || world.victory) {
      if (lastWave > 0) {
        const core = world.coreHealth(t);
        waves.push({
          wave: lastWave,
          enemies: waveSize(lastWave, t),
          leaks: leaksThisWave,
          coreLeft: core.left,
          coreTotal: core.total,
          towers: world.board.all().length,
          money: Math.round(world.money),
        });
      }
      leaksThisWave = 0;
      lastWave = now.wave;
    }
    if (world.gameOver || world.victory || (lastWave > maxWaves)) break;
  }
  return {
    victory: world.victory,
    gameOver: world.gameOver && !world.victory,
    wavesCleared: waves.filter((w) => w.coreLeft > 0).length,
    waves,
  };
}
