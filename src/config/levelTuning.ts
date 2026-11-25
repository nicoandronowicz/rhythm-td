/**
 * The tuning a level actually plays with: global tuning, with the level's own section applied on top.
 *
 *  - Tempo and swing: the level's values, shifted by the global sliders (global BPM 124 and swing 0
 *    leave the level as designed; moving them nudges every level).
 *  - Pad: the level's pad level plus the global pad trim.
 *  - Waves to win, start money, wave size, first-wave delay, enemy toughness: from the level.
 *  - Levels without enemy attacks zero out Static and Muffler attacks; levels without Mufflers never spawn them.
 */

import type { LevelDef } from '../game/levels';
import type { Tuning } from './tuning';
import { cloneTuning } from './tuningStore';

export function tuningForLevel(t: Readonly<Tuning>, level: LevelDef): Tuning {
  const out = cloneTuning(t as Tuning);
  const l = t[level.id];
  out.transport.bpm = Math.min(Math.max(l.bpm + (t.transport.bpm - 124), 60), 200);
  out.transport.swing = Math.min(Math.max(l.swing + t.transport.swing, 0), 1);
  out.mix.pad = l.pad + t.mix.pad;
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
