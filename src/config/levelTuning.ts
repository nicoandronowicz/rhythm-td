/**
 * The tuning a level actually plays with: global tuning, with the level's own section applied on top.
 *
 *  - Waves to win, start money, wave size, first-wave delay, enemy toughness: from the level.
 *  - Levels without enemy attacks zero out Static and Muffler attacks; levels without Mufflers never spawn them.
 */

import type { LevelDef } from '../game/levels';
import type { Tuning } from './tuning';
import { cloneTuning } from './tuningStore';

export function tuningForLevel(t: Readonly<Tuning>, level: LevelDef): Tuning {
  const out = cloneTuning(t as Tuning);
  const l = t[level.id];
  out.waves.toWin = Math.max(0, Math.round(l.waves));
  out.economy.startMoney = l.startMoney;
  out.waves.countBase = l.countBase;
  out.waves.countGrowth = l.countGrowth;
  out.waves.firstDelayBars = l.firstDelayBars;
  out.static.hp = t.static.hp * l.hpScale;
  out.muffler.hp = t.muffler.hp * l.hpScale;
  const mufflers = level.enemies.includes('muffler') && l.mufflerFromWave > 0;
  out.waves.mufflerFromWave = mufflers ? l.mufflerFromWave : 9999;
  if (!level.features.enemiesAttack) {
    out.static.damage = 0;
    out.static.effect = 0;
    out.muffler.damage = 0;
    out.muffler.effect = 0;
  }
  return out;
}
