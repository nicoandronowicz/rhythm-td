/**
 * One run of one level: the level, its song, its world, and the tuning it plays with.
 *
 * `tuning` is the level's effective tuning (global tuning + the level's section), recomputed when the
 * panel changes something.
 */

import { tuningForLevel } from '../config/levelTuning';
import type { Tuning } from '../config/tuning';
import { tuning as store } from '../config/tuningStore';
import { Board } from '../game/board';
import type { LevelDef } from '../game/levels';
import { rulesFor, World } from '../game/world';
import type { SongDef } from '../music/song';
import { songById } from '../music/songs';

export class Session {
  readonly world: World;
  readonly song: SongDef;
  private cached: Tuning;
  private cachedVersion = -1;

  constructor(readonly level: LevelDef) {
    this.song = songById(level.song);
    this.cached = tuningForLevel(store.current, level);
    this.cachedVersion = store.version;
    const board = new Board(level.map, this.song.stepsPerBar);
    this.world = new World(board, this.cached, Math.random, rulesFor(level, this.song));
  }

  get tuning(): Tuning {
    if (store.version !== this.cachedVersion) {
      this.cached = tuningForLevel(store.current, this.level);
      this.cachedVersion = store.version;
    }
    return this.cached;
  }
}
