/** Top bar: bar, beat, chord, wave, money, enemies. */

import Phaser from 'phaser';
import type { WaveStatus } from '../game/waves';
import { STEPS_PER_BAR } from '../music/patterns';
import { COLORS, FONT, GRID, MONO, RENDER_SCALE } from './layout';

export class Hud {
  private bar: Phaser.GameObjects.Text;
  private beatDots: Phaser.GameObjects.Arc[] = [];
  private chord: Phaser.GameObjects.Text;
  private wave: Phaser.GameObjects.Text;
  private waveSub: Phaser.GameObjects.Text;
  private money: Phaser.GameObjects.Text;
  private enemies: Phaser.GameObjects.Text;
  private status: Phaser.GameObjects.Text;
  private lastMoney = -1;

  constructor(private readonly scene: Phaser.Scene) {
    const y = 26;
    const text = (x: number, ty: number, s: string, style: Phaser.Types.GameObjects.Text.TextStyle) =>
      scene.add.text(x, ty, s, { resolution: RENDER_SCALE, ...style });
    const label = (x: number, s: string) => text(x, y - 10, s, { fontFamily: MONO, fontSize: '11px', color: COLORS.muted });
    const big = { fontFamily: MONO, fontSize: '30px', fontStyle: 'bold', color: COLORS.text };
    const mid = { fontFamily: MONO, fontSize: '18px', color: COLORS.text };

    const x0 = GRID.x;
    label(x0, 'BAR');
    this.bar = text(x0, y + 4, '–', big);
    label(x0 + 80, 'BEAT');
    for (let i = 0; i < 4; i++) this.beatDots.push(scene.add.circle(x0 + 88 + i * 24, y + 24, 7, 0xffffff, 0.12));
    label(x0 + 200, 'CHORD');
    this.chord = text(x0 + 200, y + 7, '–', { fontFamily: FONT, fontSize: '24px', fontStyle: 'bold', color: COLORS.text });
    label(x0 + 310, 'WAVE');
    this.wave = text(x0 + 310, y + 4, '–', big);
    this.waveSub = text(x0 + 356, y + 8, '', { fontFamily: FONT, fontSize: '12px', color: COLORS.muted, lineSpacing: 2 });
    label(x0 + 530, 'MONEY');
    this.money = text(x0 + 530, y + 11, '', { ...mid, color: '#5dffa8' });
    label(x0 + 640, 'ENEMIES');
    this.enemies = text(x0 + 640, y + 11, '', mid);
    this.status = text(x0 + 900, y - 10, '', { fontFamily: MONO, fontSize: '12px', color: '#ffc94d' }).setOrigin(1, 0);
  }

  setStep(bar: number, beat: number, sixteenth: number, chord: string): void {
    this.bar.setText(String(bar + 1));
    this.chord.setText(chord);
    if (sixteenth === 0) {
      this.beatDots.forEach((d, i) => d.setFillStyle(0xffffff, i === beat ? 0.95 : i < beat ? 0.3 : 0.12));
    }
  }

  setWaves(w: WaveStatus, step: number): void {
    const barsToNext = Math.max(0, Math.ceil((w.nextWaveStep - step) / STEPS_PER_BAR));
    if (w.phase === 'intro') {
      this.wave.setText('0');
      this.waveSub.setText(`get ready\nwave 1 in ${barsToNext} bar${barsToNext === 1 ? '' : 's'}`);
    } else if (w.phase === 'wave') {
      this.wave.setText(String(w.wave));
      this.waveSub.setText(`incoming\nnext in ${barsToNext} bars`);
    } else {
      this.wave.setText(String(w.wave));
      this.waveSub.setText(`breakdown\nwave ${w.wave + 1} in ${barsToNext} bar${barsToNext === 1 ? '' : 's'}`);
    }
  }

  setMoney(money: number): void {
    if (money === this.lastMoney) return;
    const up = money > this.lastMoney && this.lastMoney >= 0;
    this.lastMoney = money;
    this.money.setText(`$${money}`);
    if (up) this.scene.tweens.add({ targets: this.money, scale: { from: 1.18, to: 1 }, duration: 180 });
  }

  setEnemies(onPath: number, leaked: number): void {
    this.enemies.setText(`${onPath} on path${leaked ? `\n${leaked} reached core` : ''}`);
    this.enemies.setFontSize(leaked ? 13 : 18);
  }

  setStatus(s: string): void {
    this.status.setText(s);
  }
}
