/**
 * One run of one level: the level, its world, and the tuning it plays with.
 *
 * `tuning` is the level's effective tuning (global tuning + the level's section), recomputed when the
 * panel changes something. `audioTuning` adds the sound side of picked rewards (swing, drive, width...).
 */

import { tuningForLevel } from '../config/levelTuning';
import type { Tuning } from '../config/tuning';
import { cloneTuning, tuning as store } from '../config/tuningStore';
import { Board } from '../game/board';
import type { LevelDef } from '../game/levels';
import { rulesFor, World } from '../game/world';

export class Session {
  readonly world: World;
  private cached: Tuning;
  private cachedVersion = -1;
  private audio: Tuning;
  private audioKey = '';

  constructor(readonly level: LevelDef) {
    this.cached = tuningForLevel(store.current, level);
    this.cachedVersion = store.version;
    this.audio = this.cached;
    this.world = new World(new Board(level.map), this.cached, Math.random, rulesFor(level));
  }

  get tuning(): Tuning {
    if (store.version !== this.cachedVersion) {
      this.cached = tuningForLevel(store.current, this.level);
      this.cachedVersion = store.version;
    }
    return this.cached;
  }

  /** Tuning for the audio engine: rewards bend the sound too. */
  get audioTuning(): Tuning {
    const t = this.tuning;
    const m = this.world.mods;
    const key = `${this.cachedVersion}:${this.world.rewardsTaken.join(',')}`;
    if (key === this.audioKey) return this.audio;
    const a = cloneTuning(t);
    a.transport.swing = Math.min(1, a.transport.swing + m.swing);
    a.bass.drive = Math.min(1, a.bass.drive + m.drive);
    a.lead.tone = a.lead.tone * (1 + m.drive);
    a.sends.chordsRoom = Math.min(0, a.sends.chordsRoom + m.chordsRoom);
    a.combos.sidechainPump = a.combos.sidechainPump + m.pump;
    this.audio = a;
    this.audioKey = key;
    return a;
  }
}
