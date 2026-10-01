/**
 * Board visuals: the drum core, towers, enemies and attack effects.
 * Positions come in cell units (cell centre = col + 0.5) and are converted to screen pixels here.
 */

import Phaser from 'phaser';
import type { Tower } from '../game/board';
import { DRUM_DEFS, type DrumType } from '../game/core';
import { ENEMY_DEFS } from '../game/enemies';
import type { GridLayout } from '../game/grid';
import type { Point } from '../game/path';
import { TOWER_DEFS, type TowerType } from '../game/towers';
import type { EnemySnapshot } from '../game/world';
import { COLORS, FONT, GRID, MONO, RENDER_SCALE } from './layout';
import { drawShape } from './shapes';

export const TOWER_SIZE = 34;

export function toScreen(p: Point): Point {
  return { x: GRID.x + p.x * GRID.cell, y: GRID.y + p.y * GRID.cell };
}

// ---------- core ----------

export class CoreView {
  private pads = new Map<DrumType, Phaser.GameObjects.Arc>();
  private frame: Phaser.GameObjects.Graphics;
  readonly center: Point;

  constructor(
    private readonly scene: Phaser.Scene,
    layout: GridLayout,
  ) {
    const k = layout.core;
    const x = GRID.x + k.col * GRID.cell + 4;
    const y = GRID.y + k.row * GRID.cell + 4;
    const w = k.cols * GRID.cell - 8;
    const h = k.rows * GRID.cell - 8;
    this.center = { x: x + w / 2, y: y + h / 2 };
    this.frame = scene.add.graphics().setDepth(4);
    this.frame.fillStyle(0x1b1f36, 1).fillRoundedRect(x, y, w, h, 12);
    this.frame.lineStyle(2, 0x3b4370, 1).strokeRoundedRect(x, y, w, h, 12);
    scene.add
      .text(x + w / 2, y + 12, 'CORE', { fontFamily: MONO, fontSize: '11px', color: COLORS.muted, resolution: RENDER_SCALE })
      .setOrigin(0.5, 0)
      .setDepth(5);
    const drums: DrumType[] = ['kick', 'clap', 'hats'];
    drums.forEach((d, i) => {
      const py = y + 48 + i * 42;
      const r = d === 'kick' ? 15 : 11;
      this.pads.set(d, scene.add.circle(x + w / 2, py, r, DRUM_DEFS[d].color, 0.35).setDepth(5));
      scene.add
        .text(x + w / 2, py + r + 3, DRUM_DEFS[d].name.toLowerCase(), {
          fontFamily: FONT,
          fontSize: '10px',
          color: COLORS.dim,
          resolution: RENDER_SCALE,
        })
        .setOrigin(0.5, 0)
        .setDepth(5);
    });
  }

  pulse(drum: DrumType, velocity: number): void {
    const pad = this.pads.get(drum);
    if (!pad) return;
    this.scene.tweens.add({ targets: pad, scale: { from: 1 + 0.45 * velocity, to: 1 }, alpha: { from: 1, to: 0.35 }, duration: 180 });
  }

  /** Something reached the core. */
  hit(): void {
    const flash = this.scene.add.circle(this.center.x, this.center.y, 70, COLORS.invalid, 0.35).setDepth(6);
    this.scene.tweens.add({ targets: flash, alpha: 0, scale: 1.4, duration: 400, onComplete: () => flash.destroy() });
    this.scene.cameras.main.shake(120, 0.002);
  }
}

// ---------- towers ----------

export class TowerView {
  readonly container: Phaser.GameObjects.Container;
  private glow: Phaser.GameObjects.Arc;
  private ring: Phaser.GameObjects.Arc;
  private body: Phaser.GameObjects.Graphics;
  private outline: Phaser.GameObjects.Graphics;
  /** Went live: its entry bar has been heard. */
  live = false;
  /** Playing right now (an enemy in range, or holding to the bar end). */
  playing = false;

  constructor(
    private readonly scene: Phaser.Scene,
    readonly tower: Tower,
  ) {
    const def = TOWER_DEFS[tower.type];
    const p = toScreen({ x: tower.col + 0.5, y: tower.row + 0.5 });
    this.glow = scene.add.circle(0, 0, GRID.cell * 0.5, def.color, 1).setAlpha(0);
    this.ring = scene.add.circle(0, 0, TOWER_SIZE / 2).setStrokeStyle(2, def.color, 1).setAlpha(0);
    this.ring.isFilled = false;
    this.body = scene.add.graphics();
    drawShape(this.body, def.shape, TOWER_SIZE, def.color);
    this.outline = scene.add.graphics();
    drawShape(this.outline, def.shape, TOWER_SIZE + 8, def.color, 0.9, true);
    this.container = scene.add.container(p.x, p.y, [this.glow, this.ring, this.body, this.outline]).setDepth(10);
    this.applyLook();
    this.container.setScale(0.6);
    scene.tweens.add({ targets: this.container, scale: 1, duration: 180, ease: 'Back.easeOut' });
  }

  get screen(): Point {
    return { x: this.container.x, y: this.container.y };
  }

  moveTo(col: number, row: number): void {
    const p = toScreen({ x: col + 0.5, y: row + 0.5 });
    this.container.setPosition(p.x, p.y);
    this.scene.tweens.add({ targets: this.container, scale: { from: 1.25, to: 1 }, duration: 160, ease: 'Back.easeOut' });
  }

  goLive(): void {
    this.live = true;
    this.scene.tweens.killTweensOf([this.outline, this.body, this.glow]);
    this.applyLook();
    this.scene.tweens.add({ targets: this.body, scale: { from: 1.5, to: 1 }, duration: 300, ease: 'Back.easeOut' });
  }

  setPlaying(playing: boolean): void {
    if (playing === this.playing) return;
    this.playing = playing;
    this.applyLook();
  }

  /** Queued towers blink on the beat until their bar. */
  blink(): void {
    if (this.live) return;
    this.scene.tweens.add({ targets: this.outline, alpha: { from: 1, to: 0.3 }, duration: 300 });
  }

  pulse(velocity: number): void {
    if (!this.live) return;
    this.scene.tweens.add({ targets: this.body, scale: { from: 1 + 0.35 * velocity, to: 1 }, duration: 170, ease: 'Cubic.easeOut' });
    this.scene.tweens.add({ targets: this.glow, alpha: { from: 0.4 * velocity, to: this.restGlow() }, duration: 260 });
    this.scene.tweens.add({ targets: this.ring, alpha: { from: 0.8 * velocity, to: 0 }, scale: { from: 1, to: 2.2 }, duration: 300 });
  }

  remove(): void {
    this.scene.tweens.killTweensOf([this.container, this.body, this.glow, this.ring, this.outline]);
    this.scene.tweens.add({
      targets: this.container,
      scale: 0.2,
      alpha: 0,
      duration: 200,
      ease: 'Cubic.easeIn',
      onComplete: () => this.container.destroy(),
    });
  }

  private restGlow(): number {
    return this.live && this.playing ? 0.1 : 0;
  }

  private applyLook(): void {
    this.body.setAlpha(!this.live ? 0.28 : this.playing ? 1 : 0.55);
    this.outline.setAlpha(this.live ? 0 : 0.8);
    this.glow.setAlpha(this.restGlow());
  }
}

// ---------- enemies ----------

export class EnemyView {
  private container: Phaser.GameObjects.Container;
  private body: Phaser.GameObjects.Shape;
  private hpBack: Phaser.GameObjects.Rectangle;
  private hpBar: Phaser.GameObjects.Rectangle;
  private status: Phaser.GameObjects.Arc;
  private lastHp: number;

  constructor(
    private readonly scene: Phaser.Scene,
    e: EnemySnapshot,
  ) {
    const def = ENEMY_DEFS[e.type];
    this.body =
      def.shape === 'spike'
        ? scene.add.star(0, 0, 7, 6, 13, def.color)
        : scene.add.ellipse(0, 0, 28, 21, def.color);
    this.status = scene.add.circle(0, 0, 17).setStrokeStyle(2, 0xffffff, 1).setAlpha(0);
    this.status.isFilled = false;
    this.hpBack = scene.add.rectangle(-14, -22, 28, 4, 0x000000, 0.6).setOrigin(0, 0.5);
    this.hpBar = scene.add.rectangle(-14, -22, 28, 4, 0x5dffa8, 1).setOrigin(0, 0.5);
    this.container = scene.add.container(0, 0, [this.status, this.body, this.hpBack, this.hpBar]).setDepth(15);
    this.lastHp = e.hp;
  }

  update(screen: Point, e: EnemySnapshot): void {
    this.container.setPosition(screen.x, screen.y);
    const f = Math.max(0, e.hp / e.maxHp);
    this.hpBar.width = 28 * f;
    this.hpBar.setFillStyle(f > 0.5 ? 0x5dffa8 : f > 0.25 ? 0xffc94d : 0xff4d6d);
    if (e.hp < this.lastHp) {
      this.scene.tweens.add({ targets: this.body, scale: { from: 1.35, to: 1 }, duration: 120 });
      this.lastHp = e.hp;
    }
    if (e.stunned) this.status.setStrokeStyle(2, 0xffc94d, 1).setAlpha(0.9);
    else if (e.slowed) this.status.setStrokeStyle(2, 0xa970ff, 1).setAlpha(0.7);
    else this.status.setAlpha(0);
  }

  destroy(): void {
    this.container.destroy();
  }
}

// ---------- effects ----------

export class Effects {
  constructor(private readonly scene: Phaser.Scene) {}

  attack(type: TowerType, from: Point, targets: Point[], rangeCells: number): void {
    const color = TOWER_DEFS[type].color;
    const def = TOWER_DEFS[type];
    if (def.target === 'area') {
      const ring = this.scene.add.circle(from.x, from.y, rangeCells * GRID.cell).setDepth(8);
      ring.isFilled = false;
      ring.setStrokeStyle(type === 'bass' ? 3 : 2, color, 0.7);
      this.scene.tweens.add({
        targets: ring,
        scale: { from: 0.3, to: 1 },
        alpha: { from: 0.9, to: 0 },
        duration: type === 'bass' ? 420 : 260,
        ease: 'Quad.easeOut',
        onComplete: () => ring.destroy(),
      });
      return;
    }
    const g = this.scene.add.graphics().setDepth(12);
    g.lineStyle(type === 'lead' ? 4 : 1.5, color, 1);
    for (const t of targets) g.lineBetween(from.x, from.y, t.x, t.y);
    this.scene.tweens.add({ targets: g, alpha: 0, duration: type === 'lead' ? 180 : 110, onComplete: () => g.destroy() });
    if (type === 'lead') {
      for (const t of targets) {
        const hit = this.scene.add.circle(t.x, t.y, 14, color, 0.6).setDepth(16);
        this.scene.tweens.add({ targets: hit, scale: 1.8, alpha: 0, duration: 200, onComplete: () => hit.destroy() });
      }
    }
  }

  kill(at: Point, bounty: number, color: number): void {
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const dot = this.scene.add.circle(at.x, at.y, 3, color, 1).setDepth(16);
      this.scene.tweens.add({
        targets: dot,
        x: at.x + Math.cos(a) * 26,
        y: at.y + Math.sin(a) * 26,
        alpha: 0,
        duration: 320,
        ease: 'Quad.easeOut',
        onComplete: () => dot.destroy(),
      });
    }
    if (bounty > 0) {
      const txt = this.scene.add
        .text(at.x, at.y - 10, `+$${bounty}`, { fontFamily: MONO, fontSize: '13px', color: '#5dffa8', resolution: RENDER_SCALE })
        .setOrigin(0.5)
        .setDepth(17);
      this.scene.tweens.add({ targets: txt, y: at.y - 34, alpha: 0, duration: 700, onComplete: () => txt.destroy() });
    }
  }

  /** Short message near a point (e.g. "Not enough money"). */
  say(at: Point, message: string, color = '#ff8da1'): void {
    const txt = this.scene.add
      .text(at.x, at.y - 24, message, { fontFamily: FONT, fontSize: '13px', color, resolution: RENDER_SCALE })
      .setOrigin(0.5)
      .setDepth(30);
    this.scene.tweens.add({ targets: txt, y: at.y - 44, alpha: 0, delay: 500, duration: 500, onComplete: () => txt.destroy() });
  }
}
