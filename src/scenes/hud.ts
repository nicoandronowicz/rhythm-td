/** Top bar: bar, beat, chord, wave, money, enemies. */

import Phaser from 'phaser';
import type { WaveStatus } from '../game/waves';
import { COLORS, FONT, GRID, HUD_X, MONO, RENDER_SCALE } from './layout';

export interface WaveView {
  status: WaveStatus;
  step: number;
  stepSeconds: number;
  /** Enemies still to deal with: not spawned yet plus on the path. */
  remaining: number;
  /** Waves to win (0 = endless). */
  toWin: number;
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
  private liftBar: Phaser.GameObjects.Rectangle | null = null;
  private liftLabel: Phaser.GameObjects.Text | null = null;
  private liftState = '';

  constructor(
    private readonly scene: Phaser.Scene,
    liftEnabled = false,
    onLift: () => void = () => {},
  ) {
    const y = 26;
    const text = (x: number, ty: number, s: string, style: Phaser.Types.GameObjects.Text.TextStyle) =>
      scene.add.text(x, ty, s, { resolution: RENDER_SCALE, ...style });
    const label = (x: number, s: string) => text(x, y - 10, s, { fontFamily: MONO, fontSize: '11px', color: COLORS.muted });
    const big = { fontFamily: MONO, fontSize: '30px', fontStyle: 'bold', color: COLORS.text };
    const mid = { fontFamily: MONO, fontSize: '18px', color: COLORS.text };

    const x0 = HUD_X;
    label(x0, 'BAR');
    this.bar = text(x0, y + 4, '–', big);
    label(x0 + 74, 'BEAT');
    for (let i = 0; i < 4; i++) this.beatDots.push(scene.add.circle(x0 + 82 + i * 22, y + 24, 6, 0xffffff, 0.12));
    label(x0 + 180, 'CHORD');
    this.chord = text(x0 + 180, y + 7, '–', { fontFamily: FONT, fontSize: '24px', fontStyle: 'bold', color: COLORS.text });

    // Wave block: big number, what's happening, and a progress bar.
    label(x0 + 296, 'WAVE');
    this.wave = text(x0 + 296, y + 4, '–', { ...big, fontSize: '34px' });
    this.waveSub = text(x0 + 366, y + 4, '', { fontFamily: FONT, fontSize: '14px', fontStyle: 'bold', color: COLORS.text });
    scene.add.rectangle(x0 + 366, y + 32, 210, 6, 0xffffff, 0.1).setOrigin(0, 0.5);
    this.waveBar = scene.add.rectangle(x0 + 366, y + 32, 0, 6, 0x5dffa8, 1).setOrigin(0, 0.5);

    label(x0 + 596, 'MONEY');
    this.money = text(x0 + 596, y + 11, '', { ...mid, color: '#5dffa8' });
    label(x0 + 690, 'CORE');
    this.core = text(x0 + 690, y + 11, '', { ...mid, color: '#5dffa8' });

    // Lift meter: fills with kills and combo hits; click it (or press L) when full.
    if (liftEnabled) {
      this.liftLabel = text(x0 + 780, y - 10, 'LIFT · L', { fontFamily: MONO, fontSize: '11px', color: COLORS.muted });
      const back = scene.add.rectangle(x0 + 780, y + 22, 110, 12, 0xffffff, 0.1).setOrigin(0, 0.5);
      this.liftBar = scene.add.rectangle(x0 + 780, y + 22, 0, 12, 0xffc94d, 1).setOrigin(0, 0.5);
      back.setInteractive({ useHandCursor: true }).on('pointerdown', onLift);
    }
    this.status = text(x0 + 900, y - 10, '', { fontFamily: MONO, fontSize: '12px', color: '#ffc94d' }).setOrigin(1, 0);

    // Big centred banner over the board for wave starts and clears.
    const cx = GRID.x + GRID.w / 2;
    const cy = GRID.y + GRID.h * 0.4;
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
    this.wave.setText(v.toWin > 0 ? `${w.wave}/${v.toWin}` : String(w.wave));
    this.wave.setFontSize(v.toWin > 0 ? 26 : 34);
    if (fighting) {
      this.waveSub.setText(`${v.remaining} left · next wave ${seconds}s`);
      this.waveSub.setColor(COLORS.text);
      this.waveBar.width = 210 * (w.size > 0 ? 1 - Math.min(v.remaining, w.size) / w.size : 0);
      this.waveBar.setFillStyle(0xff4d6d, 1);
    } else {
      const next = w.wave + 1;
      const last = v.toWin > 0 && w.wave >= v.toWin;
      this.waveSub.setText(
        w.phase === 'intro' ? `Get ready · wave 1 in ${seconds}s` : last ? 'Last wave cleared!' : `Clear · wave ${next} in ${seconds}s`,
      );
      this.waveSub.setColor('#5dffa8');
      const span = w.phase === 'intro' ? Math.max(1, w.nextWaveStep) : Math.max(1, w.nextWaveStep - w.waveStartStep);
      const done = w.phase === 'intro' ? v.step : v.step - w.waveStartStep;
      this.waveBar.width = 210 * Math.min(1, Math.max(0, done / span));
      this.waveBar.setFillStyle(0x5dffa8, 1);
    }

    if (w.wave > this.lastWave) {
      this.lastWave = w.wave;
      this.showBanner(`WAVE ${w.wave}`, `${w.size} enemies incoming`, '#ffffff');
    } else if (w.wave > 0 && !fighting && this.clearedShown < w.wave) {
      this.clearedShown = w.wave;
      if (v.toWin > 0 && w.wave >= v.toWin) this.showBanner('TRACK COMPLETE', 'you kept the groove going', '#5dffa8');
      else this.showBanner(`WAVE ${w.wave} CLEARED`, `next wave in ${seconds}s`, '#5dffa8');
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

  setLift(hype: number, lifted: boolean, pending: boolean): void {
    if (!this.liftBar || !this.liftLabel) return;
    this.liftBar.width = 110 * Math.min(1, lifted ? 1 : hype);
    const state = lifted ? 'lifted' : pending ? 'pending' : hype >= 1 ? 'ready' : 'filling';
    if (state === this.liftState) return;
    this.liftState = state;
    this.scene.tweens.killTweensOf(this.liftBar);
    this.liftBar.setAlpha(1);
    if (state === 'ready') {
      this.liftLabel.setText('LIFT READY · L').setColor('#ffc94d');
      this.scene.tweens.add({ targets: this.liftBar, alpha: 0.45, yoyo: true, repeat: -1, duration: 242 });
    } else if (state === 'pending') {
      this.liftLabel.setText('LIFT · next phrase').setColor('#ffc94d');
    } else if (state === 'lifted') {
      this.liftLabel.setText('LIFTED').setColor('#5dffa8');
      this.liftBar.setFillStyle(0x5dffa8, 1);
    } else {
      this.liftLabel.setText('LIFT · L').setColor(COLORS.muted);
      this.liftBar.setFillStyle(0xffc94d, 1);
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
