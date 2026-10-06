/** Core perk menu: opens next to the core, buy extra percussion. */

import Phaser from 'phaser';
import { DRUM_DEFS, PERK_DRUMS, type PerkDrum } from '../game/core';
import { COLORS, FONT, MONO, RENDER_SCALE } from './layout';

export interface PerkRowState {
  perk: PerkDrum;
  price: number;
  status: 'buy' | 'pending' | 'playing';
  affordable: boolean;
}

const ROW_H = 34;
const W = 220;

export class PerkMenu {
  private container: Phaser.GameObjects.Container;
  private rows: { perk: PerkDrum; bg: Phaser.GameObjects.Rectangle; price: Phaser.GameObjects.Text; rect: Phaser.Geom.Rectangle }[] = [];
  private x: number;
  private y: number;
  open = false;

  constructor(scene: Phaser.Scene, anchor: Phaser.Geom.Rectangle) {
    const h = 30 + PERK_DRUMS.length * ROW_H + 8;
    this.x = anchor.x - W - 8;
    this.y = Math.max(8, anchor.y + anchor.height / 2 - h / 2);
    const bg = scene.add.rectangle(0, 0, W, h, 0x121628, 0.98).setOrigin(0, 0).setStrokeStyle(1.5, 0x3b4370, 1);
    const title = scene.add.text(12, 9, 'CORE PERKS · +groove +health', {
      fontFamily: MONO,
      fontSize: '10px',
      color: COLORS.muted,
      resolution: RENDER_SCALE,
    });
    const items: Phaser.GameObjects.GameObject[] = [bg, title];
    PERK_DRUMS.forEach((perk, i) => {
      const ry = 28 + i * ROW_H;
      const rowBg = scene.add.rectangle(6, ry, W - 12, ROW_H - 4, 0xffffff, 0.04).setOrigin(0, 0);
      const dot = scene.add.circle(20, ry + (ROW_H - 4) / 2, 6, DRUM_DEFS[perk].color, 1);
      const name = scene.add.text(34, ry + 7, DRUM_DEFS[perk].name, {
        fontFamily: FONT,
        fontSize: '13px',
        fontStyle: 'bold',
        color: COLORS.text,
        resolution: RENDER_SCALE,
      });
      const price = scene.add
        .text(W - 16, ry + 8, '', { fontFamily: MONO, fontSize: '12px', color: COLORS.text, resolution: RENDER_SCALE })
        .setOrigin(1, 0);
      items.push(rowBg, dot, name, price);
      this.rows.push({ perk, bg: rowBg, price, rect: new Phaser.Geom.Rectangle(this.x + 6, this.y + ry, W - 12, ROW_H - 4) });
    });
    this.container = scene.add.container(this.x, this.y, items).setDepth(60).setVisible(false);
  }

  get bounds(): Phaser.Geom.Rectangle {
    return new Phaser.Geom.Rectangle(this.x, this.y, W, 30 + PERK_DRUMS.length * ROW_H + 8);
  }

  toggle(force?: boolean): void {
    this.open = force ?? !this.open;
    this.container.setVisible(this.open);
  }

  perkAt(x: number, y: number): PerkDrum | null {
    if (!this.open) return null;
    return this.rows.find((r) => r.rect.contains(x, y))?.perk ?? null;
  }

  refresh(states: PerkRowState[]): void {
    for (const st of states) {
      const row = this.rows.find((r) => r.perk === st.perk);
      if (!row) continue;
      if (st.status === 'playing') {
        row.price.setText('playing').setColor('#5dffa8');
        row.bg.setFillStyle(0x5dffa8, 0.08);
      } else if (st.status === 'pending') {
        row.price.setText('next bar').setColor('#ffc94d');
        row.bg.setFillStyle(0xffc94d, 0.08);
      } else {
        row.price.setText(`$${st.price}`).setColor(st.affordable ? COLORS.text : '#ff8da1');
        row.bg.setFillStyle(0xffffff, st.affordable ? 0.06 : 0.02);
      }
    }
  }
}
