/**
 * Right-hand panel: tower palette (with costs), the track view (what every layer plays this bar,
 * in the song's meter, with a playhead), the remove bin and a few hints.
 */

import Phaser from 'phaser';
import { TOWER_DEFS, TOWER_TYPES, type TowerType } from '../game/towers';
import type { SongDef } from '../music/song';
import { COLORS, FONT, MONO, PANEL, PANEL_Y, RENDER_SCALE } from './layout';
import { drawShape, hex } from './shapes';

export type RowState = 'on' | 'idle' | 'off';

interface PaletteButton {
  type: TowerType;
  rect: Phaser.Geom.Rectangle;
  bg: Phaser.GameObjects.Graphics;
  cost: Phaser.GameObjects.Text;
  dim: Phaser.GameObjects.Rectangle;
}

/** Brightness of pattern steps in the track view. */
const STEP_ALPHA: Record<RowState, number> = { on: 0.7, idle: 0.3, off: 0.12 };

const BUTTON_H = 56;
const BUTTON_GAP = 6;

export class Panel {
  private buttons: PaletteButton[] = [];
  private cells = new Map<string, Phaser.GameObjects.Rectangle[]>();
  private labels = new Map<string, Phaser.GameObjects.Text>();
  private steps = new Map<string, ReadonlySet<number>>();
  private colors = new Map<string, number>();
  private rowStates = new Map<string, RowState>();
  private playhead: Phaser.GameObjects.Rectangle;
  readonly trashRect: Phaser.Geom.Rectangle;
  private trash: Phaser.GameObjects.Graphics;
  private trashText: Phaser.GameObjects.Text;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly available: readonly TowerType[],
    private readonly song: SongDef,
  ) {
    const x = PANEL.x;
    const w = PANEL.width;
    const text = (tx: number, ty: number, s: string | string[], style: Phaser.Types.GameObjects.Text.TextStyle) =>
      scene.add.text(tx, ty, s, { resolution: RENDER_SCALE, ...style });
    const heading = (y: number, s: string) => text(x, y, s, { fontFamily: MONO, fontSize: '11px', color: COLORS.muted });

    heading(PANEL_Y - 22, 'TOWERS · click a cell, or drag');
    TOWER_TYPES.forEach((type, i) => {
      const def = TOWER_DEFS[type];
      const y = PANEL_Y + i * (BUTTON_H + BUTTON_GAP);
      const rect = new Phaser.Geom.Rectangle(x, y, w, BUTTON_H);
      const bg = scene.add.graphics();
      const icon = scene.add.graphics({ x: x + 30, y: y + BUTTON_H / 2 });
      drawShape(icon, def.shape, 26, def.color);
      text(x + 58, y + 9, def.name, { fontFamily: FONT, fontSize: '16px', fontStyle: 'bold', color: COLORS.text });
      text(x + 58, y + 31, def.role, { fontFamily: FONT, fontSize: '12px', color: COLORS.muted });
      const cost = text(x + w - 12, y + 10, '', { fontFamily: MONO, fontSize: '14px', color: COLORS.text }).setOrigin(1, 0);
      text(x + w - 12, y + 32, def.hotkey, { fontFamily: MONO, fontSize: '11px', color: COLORS.dim }).setOrigin(1, 0);
      const dim = scene.add.rectangle(x, y, w, BUTTON_H, COLORS.background, 0.55).setOrigin(0, 0).setVisible(false);
      this.buttons.push({ type, rect, bg, cost, dim });
      if (!available.includes(type)) {
        // Not in this level yet: covered, with a small note.
        scene.add.rectangle(x, y, w, BUTTON_H, COLORS.background, 0.78).setOrigin(0, 0);
        text(x + w - 12, y + 20, 'later level', { fontFamily: MONO, fontSize: '11px', color: COLORS.dim }).setOrigin(1, 0);
      }
    });

    // Track view.
    const trackY = PANEL_Y + 4 * (BUTTON_H + BUTTON_GAP) + 14;
    heading(trackY, 'TRACK');
    const spb = song.stepsPerBar;
    const groups = song.beats.length;
    const gap = 2;
    const left = x + 56;
    const cellW = Math.floor((w - 56 - (spb - 1) * gap - (groups - 1) * 3) / spb);
    const rowH = 14;
    const coreRows = [...song.core].reverse();
    const rows: { id: string; name: string; color: number }[] = [
      ...coreRows.map((l) => ({ id: l.id, name: l.name, color: l.color })),
      ...TOWER_TYPES.map((ty) => ({ id: ty, name: TOWER_DEFS[ty].name, color: TOWER_DEFS[ty].color })),
    ];
    // Beat group of each step, for the small gaps between beats.
    const groupOf: number[] = [];
    song.beats.forEach((len, g) => {
      for (let i = 0; i < len; i++) groupOf.push(g);
    });
    this.playhead = scene.add
      .rectangle(left, trackY + 17, cellW + 2, rowH * rows.length + 9, 0xffffff, 0.14)
      .setOrigin(0, 0)
      .setVisible(false);
    rows.forEach((row, r) => {
      // A small gap between the core and the towers.
      const y = trackY + 19 + r * rowH + (r >= coreRows.length ? 5 : 0);
      this.labels.set(
        row.id,
        text(x, y, row.name.toUpperCase().slice(0, 9), { fontFamily: MONO, fontSize: '10px', color: COLORS.dim }),
      );
      const cells: Phaser.GameObjects.Rectangle[] = [];
      for (let st = 0; st < spb; st++) {
        const cx = left + st * (cellW + gap) + (groupOf[st] ?? 0) * 3;
        cells.push(scene.add.rectangle(cx + 1, y, cellW, rowH - 4, 0xffffff, 0.05).setOrigin(0, 0));
      }
      this.cells.set(row.id, cells);
      this.steps.set(row.id, new Set());
      this.colors.set(row.id, row.color);
    });

    // Bin.
    const trashY = trackY + 19 + rows.length * rowH + 16;
    this.trashRect = new Phaser.Geom.Rectangle(x, trashY, w, 46);
    this.trash = scene.add.graphics();
    this.trashText = text(x + w / 2, trashY + 23, 'Drop here to remove', {
      fontFamily: FONT,
      fontSize: '13px',
      color: COLORS.dim,
    }).setOrigin(0.5);
    this.drawTrash(false, false);

    text(x, trashY + 56, ['Click a tower to upgrade · drag to move', 'Right-click to remove · click the core for perks', 'Space: pause · T: tuning · 1–4: pick tower'], {
      fontFamily: FONT,
      fontSize: '12px',
      color: COLORS.muted,
      lineSpacing: 5,
    });
  }

  buttonAt(x: number, y: number): TowerType | null {
    const b = this.buttons.find((b) => b.rect.contains(x, y));
    return b && this.available.includes(b.type) ? b.type : null;
  }

  refreshPalette(selected: TowerType | null, money: number, costOf: (t: TowerType) => number): void {
    for (const b of this.buttons) {
      const on = b.type === selected;
      const def = TOWER_DEFS[b.type];
      const cost = costOf(b.type);
      b.bg.clear();
      b.bg.fillStyle(on ? def.color : COLORS.panel, on ? 0.14 : 1);
      b.bg.fillRoundedRect(b.rect.x, b.rect.y, b.rect.width, b.rect.height, 10);
      b.bg.lineStyle(on ? 2 : 1, on ? def.color : COLORS.panelLine, 1);
      b.bg.strokeRoundedRect(b.rect.x, b.rect.y, b.rect.width, b.rect.height, 10);
      const locked = !this.available.includes(b.type);
      b.cost.setText(locked ? '' : `$${cost}`);
      const affordable = money >= cost;
      b.cost.setColor(affordable ? COLORS.text : '#ff8da1');
      b.dim.setVisible(!affordable && !locked);
    }
  }

  /** Flash a palette button red: not enough money. */
  denied(type: TowerType): void {
    const b = this.buttons.find((x) => x.type === type);
    if (!b) return;
    this.scene.tweens.add({ targets: b.cost, x: { from: b.cost.x - 6, to: b.cost.x }, duration: 220, ease: 'Bounce.easeOut' });
  }

  setStep(stepInBar: number): void {
    const first = this.cells.get(this.song.core[0]!.id)![stepInBar];
    if (!first) return;
    this.playhead.setVisible(true).setX(first.x - 1);
  }

  /** Which steps a row plays this bar. */
  setRowSteps(id: string, steps: readonly number[]): void {
    const prev = this.steps.get(id);
    if (prev && prev.size === steps.length && steps.every((x) => prev.has(x))) return;
    const set = new Set(steps);
    this.steps.set(id, set);
    const color = this.colors.get(id)!;
    const alpha = STEP_ALPHA[this.rowStates.get(id) ?? 'off'];
    this.cells.get(id)?.forEach((cell, st) => {
      const hit = set.has(st);
      cell.setFillStyle(hit ? color : 0xffffff, hit ? 1 : 0.05).setAlpha(hit ? alpha : 1);
    });
  }

  setRowState(id: string, state: RowState): void {
    if (this.rowStates.get(id) === state) return;
    this.rowStates.set(id, state);
    const label = this.labels.get(id)!;
    const color = this.colors.get(id) ?? 0xffffff;
    label.setColor(state === 'on' ? hex(color) : state === 'idle' ? COLORS.muted : COLORS.dim);
    const steps = this.steps.get(id)!;
    this.cells.get(id)!.forEach((cell, st) => {
      if (steps.has(st) && !this.scene.tweens.isTweening(cell)) cell.setAlpha(STEP_ALPHA[state]);
    });
  }

  flashStep(id: string, stepInBar: number): void {
    const cell = this.cells.get(id)?.[stepInBar];
    if (!cell) return;
    const rest = STEP_ALPHA[this.rowStates.get(id) ?? 'off'];
    this.scene.tweens.add({ targets: cell, alpha: { from: 1, to: rest }, duration: 220 });
  }

  drawTrash(visible: boolean, hot: boolean): void {
    const r = this.trashRect;
    this.trash.clear();
    this.trash.lineStyle(1.5, hot ? COLORS.invalid : COLORS.panelLine, visible ? 1 : 0.6);
    this.trash.fillStyle(hot ? COLORS.invalid : COLORS.panel, hot ? 0.18 : 0.6);
    this.trash.fillRoundedRect(r.x, r.y, r.width, r.height, 10);
    this.trash.strokeRoundedRect(r.x, r.y, r.width, r.height, 10);
    this.trashText.setColor(hot ? '#ff8da1' : visible ? COLORS.text : COLORS.dim);
  }
}
