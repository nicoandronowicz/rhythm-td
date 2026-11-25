/**
 * The app: title screen, level select, runs, pause and end screens.
 * Owns the audio engine (one for the whole page) and the Phaser game; each run gets a fresh Session.
 */

import Phaser from 'phaser';
import { AudioEngine } from '../audio/engine';
import { LEVELS, levelById, nextLevel, type LevelId } from '../game/levels';
import { GAME_SIZE, GameScene, type SceneData } from '../scenes/GameScene';
import { COLORS } from '../scenes/layout';
import { mountTuningPanel } from '../ui/tuningPanel';
import { Session } from './session';
import { hideScreens, setInGameChrome, showCoach, showEnd, showLevels, showPause, showRewards, showTitle } from './screens';

const COMPLETED_KEY = 'rhythm-td.completed.v1';

function loadCompleted(): Set<LevelId> {
  try {
    const raw = localStorage.getItem(COMPLETED_KEY);
    return new Set(raw ? (JSON.parse(raw) as LevelId[]) : []);
  } catch {
    return new Set();
  }
}

export class App {
  readonly engine = new AudioEngine();
  readonly game: Phaser.Game;
  session: Session | null = null;
  private paused = false;
  private ended = false;
  private completed = loadCompleted();

  constructor() {
    this.game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: 'game',
      width: GAME_SIZE.width,
      height: GAME_SIZE.height,
      backgroundColor: COLORS.background,
      antialias: true,
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      scene: [],
    });
    this.game.scene.add('game', GameScene, false);

    mountTuningPanel(document.getElementById('tuning')!, document.getElementById('tuning-toggle')!);
    document.getElementById('pause-button')!.addEventListener('click', () => this.togglePause());
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.session && !this.ended) {
        e.preventDefault();
        this.togglePause();
      }
    });

    showTitle(() => void this.firstPlay());
  }

  /** The first click unlocks audio. */
  private async firstPlay(): Promise<void> {
    // iOS: let Web Audio play even with the silent switch on (Safari 17+).
    const nav = navigator as Navigator & { audioSession?: { type: string } };
    if (nav.audioSession) nav.audioSession.type = 'playback';
    await this.engine.init();
    // ?level=level3 jumps straight into a level (handy for testing).
    const wanted = new URLSearchParams(window.location.search).get('level');
    const direct = LEVELS.find((l) => l.id === wanted);
    if (direct) this.startLevel(direct.id);
    else this.toLevels();
  }

  toLevels(): void {
    this.endRun();
    showLevels(LEVELS, this.completed, (id) => this.startLevel(id));
  }

  startLevel(id: LevelId): void {
    this.endRun();
    hideScreens();
    const session = new Session(levelById(id));
    this.session = session;
    this.paused = false;
    this.ended = false;
    this.engine.load(session);
    const data: SceneData = { session, engine: this.engine, app: this };
    this.game.scene.start('game', data);
    this.engine.play();
    setInGameChrome(true);
  }

  restart(): void {
    if (this.session) this.startLevel(this.session.level.id);
  }

  togglePause(): void {
    if (!this.session || this.ended) return;
    this.paused = !this.paused;
    this.engine.setPaused(this.paused);
    if (this.paused) {
      showPause({ resume: () => this.togglePause(), restart: () => this.restart(), levels: () => this.toLevels() });
    } else {
      hideScreens();
    }
  }

  get isPaused(): boolean {
    return this.paused;
  }

  /** Called by the scene once the end of a run has been heard. */
  runEnded(victory: boolean): void {
    const session = this.session;
    if (!session || this.ended) return;
    this.ended = true;
    if (victory) {
      this.completed.add(session.level.id);
      try {
        localStorage.setItem(COMPLETED_KEY, JSON.stringify([...this.completed]));
      } catch {
        // Private mode: progress just isn't remembered.
      }
    }
    showCoach(null, () => {});
    showRewards(null, () => {});
    const next = nextLevel(session.level.id);
    showEnd(
      {
        victory,
        level: session.level,
        waves: session.world.wavesSurvived,
        kills: session.world.killed,
        core: session.world.coreHealth(session.tuning),
        hasNext: !!next,
      },
      {
        next: () => next && this.startLevel(next.id),
        retry: () => this.restart(),
        levels: () => this.toLevels(),
      },
    );
  }

  private endRun(): void {
    this.engine.stop();
    if (this.game.scene.isActive('game') || this.game.scene.isPaused('game')) this.game.scene.stop('game');
    this.session = null;
    this.paused = false;
    setInGameChrome(false);
    showCoach(null, () => {});
    showRewards(null, () => {});
  }
}
