/** Top bar: bar, beat, chord, wave, money, enemies. */

import Phaser from 'phaser';
import type { WaveStatus } from '../game/waves';
import { COLORS, FONT, GRID, MONO, RENDER_SCALE } from './layout';

export interface WaveView {
  status: WaveStatus;
  step: number;
  stepSeconds: number;
  /** Enemies still to deal with: not spawned yet plus on the path. */
  remaining: number;
}

export class Hud {
  private bar: Phaser.GameObjects.Text;
  private beatDots: Phaser.GameObjects.Arc[] = [];
  private chord: Phaser.GameObjects.Text;
  private wave: Phaser.GameObjects.Text;
  private waveSub: Phaser.GameObjects.Text;
  private waveBar: Phaser.GameObjects.Rectangle;
  private money: Phaser.GameObjects.Text;
  private core: Phaser.GameObjects.Text;
  private status: Phaser.GameObjects.Text;
  private banner: Phaser.GameObjects.Text;
  private bannerSub: Phaser.GameObjects.Text;
  private lastMoney = -1;
  private lastCore = -1;
  private lastWave = 0;
  private clearedShown = 0;

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
    label(x0 + 74, 'BEAT');
    for (let i = 0; i < 4; i++) this.beatDots.push(scene.add.circle(x0 + 82 + i * 22, y + 24, 6, 0xffffff, 0.12));
    label(x0 + 180, 'CHORD');
    this.chord = text(x0 + 180, y + 7, '–', { fontFamily: FONT, fontSize: '24px', fontStyle: 'bold', color: COLORS.text });

    // Wave block: big number, what's happening, and a progress bar.
    label(x0 + 296, 'WAVE');
    this.wave = text(x0 + 296, y + 4, '–', { ...big, fontSize: '34px' });
    this.waveSub = text(x0 + 350, y + 4, '', { fontFamily: FONT, fontSize: '14px', fontStyle: 'bold', color: COLORS.text });
    scene.add.rectangle(x0 + 350, y + 32, 220, 6, 0xffffff, 0.1).setOrigin(0, 0.5);
    this.waveBar = scene.add.rectangle(x0 + 350, y + 32, 0, 6, 0x5dffa8, 1).setOrigin(0, 0.5);

    label(x0 + 600, 'MONEY');
    this.money = text(x0 + 600, y + 11, '', { ...mid, color: '#5dffa8' });
    label(x0 + 700, 'CORE');
    this.core = text(x0 + 700, y + 11, '', { ...mid, color: '#5dffa8' });
    this.status = text(x0 + 900, y - 10, '', { fontFamily: MONO, fontSize: '12px', color: '#ffc94d' }).setOrigin(1, 0);

    // Big centred banner over the board for wave starts and clears.
    const cx = GRID.x + 440;
    const cy = GRID.y + 230;
    this.banner = text(cx, cy, '', { fontFamily: FONT, fontSize: '56px', fontStyle: 'bold', color: '#ffffff' })
      .setOrigin(0.5)
      .setDepth(50)
      .setAlpha(0);
    this.bannerSub = text(cx, cy + 46, '', { fontFamily: FONT, fontSize: '18px', color: COLORS.muted })
      .setOrigin(0.5)
      .setDepth(50)
      .setAlpha(0);
  }

  setStep(bar: number, beat: number, sixteenth: number, chord: string): void {
    this.bar.setText(String(bar + 1));
    this.chord.setText(chord);
    if (sixteenth === 0) {
      this.beatDots.forEach((d, i) => d.setFillStyle(0xffffff, i === beat ? 0.95 : i < beat ? 0.3 : 0.12));
    }
  }

  setWaves(v: WaveView): void {
    const w = v.status;
    const seconds = Math.max(0, Math.ceil((w.nextWaveStep - v.step) * v.stepSeconds));
    const fighting = w.phase !== 'intro' && v.remaining > 0;
    this.wave.setText(String(w.wave));
    if (fighting) {
      this.waveSub.setText(`${v.remaining} enem${v.remaining === 1 ? 'y' : 'ies'} left · next wave in ${seconds}s`);
      this.waveSub.setColor(COLORS.text);
      this.waveBar.width = 220 * (w.size > 0 ? 1 - Math.min(v.remaining, w.size) / w.size : 0);
      this.waveBar.setFillStyle(0xff4d6d, 1);
    } else {
      const next = w.wave + 1;
      this.waveSub.setText(w.phase === 'intro' ? `Get ready · wave 1 in ${seconds}s` : `Clear · wave ${next} in ${seconds}s`);
      this.waveSub.setColor('#5dffa8');
      const span = w.phase === 'intro' ? Math.max(1, w.nextWaveStep) : Math.max(1, w.nextWaveStep - w.waveStartStep);
      const done = w.phase === 'intro' ? v.step : v.step - w.waveStartStep;
      this.waveBar.width = 220 * Math.min(1, Math.max(0, done / span));
      this.waveBar.setFillStyle(0x5dffa8, 1);
    }

    if (w.wave > this.lastWave) {
      this.lastWave = w.wave;
      this.showBanner(`WAVE ${w.wave}`, `${w.size} enemies incoming`, '#ffffff');
    } else if (w.wave > 0 && !fighting && this.clearedShown < w.wave) {
      this.clearedShown = w.wave;
      this.showBanner(`WAVE ${w.wave} CLEARED`, `next wave in ${seconds}s`, '#5dffa8');
    }
  }

  private showBanner(title: string, sub: string, color: string): void {
    this.banner.setText(title).setColor(color);
    this.bannerSub.setText(sub);
    this.scene.tweens.killTweensOf([this.banner, this.bannerSub]);
    for (const [target, delay] of [
      [this.banner, 0],
      [this.bannerSub, 60],
    ] as const) {
      target.setAlpha(0).setScale(0.9);
      this.scene.tweens.chain({
        targets: target,
        tweens: [
          { alpha: 1, scale: 1, duration: 220, delay, ease: 'Back.easeOut' },
          { alpha: 0, duration: 500, delay: 1300 },
        ],
      });
    }
  }

  setMoney(money: number): void {
    if (money === this.lastMoney) return;
    const up = money > this.lastMoney && this.lastMoney >= 0;
    this.lastMoney = money;
    this.money.setText(`$${money}`);
    if (up) this.scene.tweens.add({ targets: this.money, scale: { from: 1.18, to: 1 }, duration: 180 });
  }

  setCore(left: number, total: number): void {
    if (left === this.lastCore) return;
    const hurt = this.lastCore >= 0 && left < this.lastCore;
    this.lastCore = left;
    this.core.setText(`${left} / ${total}`);
    const f = left / total;
    this.core.setColor(f > 0.66 ? '#5dffa8' : f > 0.33 ? '#ffc94d' : '#ff4d6d');
    if (hurt) this.scene.tweens.add({ targets: this.core, scale: { from: 1.4, to: 1 }, duration: 260 });
  }

  setStatus(s: string): void {
    this.status.setText(s);
  }
}
