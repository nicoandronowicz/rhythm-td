/**
 * Wave generation and the wave clock. Pure.
 *
 * Timeline: drums-only intro, then wave 1 (lengthBars), breakdown (breakdownBars), wave 2, ...
 * The next wave always starts on schedule, whether or not the last one was cleared.
 */

import type { Tuning } from '../config/tuning';
import { STEPS_PER_BAR } from '../music/patterns';
import type { EnemyType } from './enemies';

export interface Spawn {
  /** Absolute 16th step the enemy enters the path. */
  step: number;
  type: EnemyType;
  hp: number;
}

export interface Wave {
  /** 1-based. */
  number: number;
  startStep: number;
  /** First step after the wave's bars (the breakdown starts here). */
  endStep: number;
  spawns: Spawn[];
}

type WaveTuning = Pick<Tuning, 'waves' | 'static' | 'muffler'>;

/** Which enemy the i-th spawn of a wave is. Deterministic, mufflers spread evenly. */
export function enemyTypeAt(i: number, waveNumber: number, t: WaveTuning): EnemyType {
  const w = t.waves;
  if (waveNumber < w.mufflerFromWave || w.mufflerShare <= 0) return 'static';
  return Math.floor((i + 1) * w.mufflerShare) > Math.floor(i * w.mufflerShare) ? 'muffler' : 'static';
}

export function waveSize(waveNumber: number, t: WaveTuning): number {
  return Math.max(1, Math.round(t.waves.countBase + t.waves.countGrowth * (waveNumber - 1)));
}

/** HP compounds per wave (0.2 = each wave 20% tougher than the last), so it outruns a growing economy. */
export function hpMultiplier(waveNumber: number, t: WaveTuning): number {
  return Math.pow(1 + t.waves.hpGrowth, waveNumber - 1);
}

/** Build a wave starting at `startStep`. Spawns land on the 16th grid and always fit inside the wave. */
export function generateWave(waveNumber: number, startStep: number, t: WaveTuning): Wave {
  const lengthSteps = Math.max(1, Math.round(t.waves.lengthBars)) * STEPS_PER_BAR;
  const count = waveSize(waveNumber, t);
  // Spawns use at most the first half of the wave so the last enemies have time to walk.
  const window = Math.max(1, Math.floor(lengthSteps / 2));
  const gap = Math.max(1, Math.min(Math.round(t.waves.spawnGap), Math.floor(window / count)));
  const mult = hpMultiplier(waveNumber, t);
  const spawns: Spawn[] = [];
  for (let i = 0; i < count; i++) {
    const type = enemyTypeAt(i, waveNumber, t);
    spawns.push({ step: startStep + i * gap, type, hp: Math.round(t[type].hp * mult) });
  }
  return { number: waveNumber, startStep, endStep: startStep + lengthSteps, spawns };
}

export type WavePhase = 'intro' | 'wave' | 'breakdown';

export interface WaveStatus {
  phase: WavePhase;
  /** Current wave number (during a wave), or the last one (during a breakdown). 0 before the first. */
  wave: number;
  /** Step the next wave starts. */
  nextWaveStep: number;
  /** Step the current wave started (0 before the first). */
  waveStartStep: number;
  /** Enemies in the current wave. */
  size: number;
  /** Enemies of the current wave not spawned yet. */
  pending: number;
}

/** Keeps track of which wave is on and hands out spawns as their steps come up. */
export class WaveClock {
  private current: Wave | null = null;
  private pending: Spawn[] = [];
  private nextStart: number | null = null;
  private waveCount = 0;

  /** Called for every step, in order. Returns enemies to spawn on this step. */
  onStep(step: number, t: WaveTuning): Spawn[] {
    if (this.nextStart === null) this.nextStart = step + Math.max(0, Math.round(t.waves.firstDelayBars)) * STEPS_PER_BAR;
    if (step >= this.nextStart) {
      this.waveCount++;
      this.current = generateWave(this.waveCount, this.nextStart, t);
      this.pending.push(...this.current.spawns);
      const breakdown = Math.max(0, Math.round(t.waves.breakdownBars)) * STEPS_PER_BAR;
      this.nextStart = this.current.endStep + breakdown;
    }
    const due = this.pending.filter((s) => s.step <= step);
    this.pending = this.pending.filter((s) => s.step > step);
    return due;
  }

  /** Enemies of the current wave still waiting to spawn. */
  get pendingSpawns(): number {
    return this.pending.length;
  }

  status(step: number): WaveStatus {
    const next = this.nextStart ?? 0;
    if (!this.current) return { phase: 'intro', wave: 0, nextWaveStep: next, waveStartStep: 0, size: 0, pending: 0 };
    return {
      phase: step < this.current.endStep ? 'wave' : 'breakdown',
      wave: this.current.number,
      nextWaveStep: next,
      waveStartStep: this.current.startStep,
      size: this.current.spawns.length,
      pending: this.pending.length,
    };
  }
}
