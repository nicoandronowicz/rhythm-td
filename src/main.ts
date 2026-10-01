import Phaser from 'phaser';
import { AudioEngine } from './audio/engine';
import { tuning } from './config/tuningStore';
import { Board } from './game/board';
import { PROTOTYPE_MAP } from './game/grid';
import { World } from './game/world';
import { GAME_SIZE, GameScene } from './scenes/GameScene';
import { COLORS } from './scenes/layout';
import { mountTuningPanel } from './ui/tuningPanel';
import './ui/style.css';

const world = new World(new Board(PROTOTYPE_MAP), tuning.current);
const engine = new AudioEngine(world);

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_SIZE.width,
  height: GAME_SIZE.height,
  backgroundColor: COLORS.background,
  antialias: true,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [new GameScene(world, engine)],
});

mountTuningPanel(document.getElementById('tuning')!, document.getElementById('tuning-toggle')!);

const overlay = document.getElementById('start')!;
const startButton = document.getElementById('start-button') as HTMLButtonElement;
startButton.focus();

startButton.addEventListener('click', async () => {
  // iOS: let Web Audio play even with the silent switch on (Safari 17+).
  const nav = navigator as Navigator & { audioSession?: { type: string } };
  if (nav.audioSession) nav.audioSession.type = 'playback';

  startButton.disabled = true;
  startButton.textContent = 'Starting…';
  await engine.start();
  overlay.classList.add('leaving');
  window.setTimeout(() => overlay.remove(), 450);
});

// Handy for debugging from the console.
Object.assign(window, { rhythmTd: { world, engine, tuning } });
