/**
 * The board screen: grid, path, towers, HUD and the tower palette.
 *
 * Draws only what the audio engine already decided. Pulses and layer changes arrive as
 * Tone.Draw callbacks (EngineListener), timed to when the sound is heard.
 */

import Phaser from 'phaser';
import type { AudibleState, AudioEngine, HitEvent } from '../audio/engine';
import type { Board, Tower } from '../game/board';
import { pathCells, type Cell } from '../game/grid';
import { TOWER_DEFS, TOWER_TYPES, type TowerType } from '../game/towers';
import { STEPS_PER_BAR } from '../music/patterns';
import { COLORS, FONT, GRID, MONO, PANEL, RENDER_SCALE, SCREEN } from './layout';
import { drawShape, hex } from './shapes';

const TOWER_SIZE = 34;
const DRAG_THRESHOLD = 6;

type LayerState = 'on' | 'queued' | 'leaving' | 'off';

/** Brightness of pattern steps in the track view, per layer state. */
const STEP_ALPHA: Record<LayerState, number> = { on: 0.55, leaving: 0.4, queued: 0.28, off: 0.14 };

interface TowerView {
  tower: Tower;
  container: Phaser.GameObjects.Container;
  glow: Phaser.GameObjects.Arc;
  ring: Phaser.GameObjects.Arc;
  body: Phaser.GameObjects.Graphics;
  outline: Phaser.GameObjects.Graphics;
  /** Visually live: flips when the entry bar is actually heard. */
  live: boolean;
}

interface PaletteButton {
  type: TowerType;
  rect: Phaser.Geom.Rectangle;
  bg: Phaser.GameObjects.Graphics;
}

type Drag =
  | { kind: 'new'; type: TowerType; x0: number; y0: number; moved: boolean }
  | { kind: 'move'; view: TowerView; x0: number; y0: number; moved: boolean };

export class GameScene extends Phaser.Scene {
  private views = new Map<number, TowerView>();
  private selected: TowerType | null = 'kick';
  private drag: Drag | null = null;
  private hoverCell: Cell | null = null;

  private pathGlow!: Phaser.GameObjects.Graphics;
  private cursor!: Phaser.GameObjects.Graphics;
  private ghost!: Phaser.GameObjects.Container;
  private ghostShape!: Phaser.GameObjects.Graphics;

  private barText!: Phaser.GameObjects.Text;
  private beatDots: Phaser.GameObjects.Arc[] = [];
  private chordText!: Phaser.GameObjects.Text;
  private bpmText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private layersText!: Phaser.GameObjects.Text;

  private palette: PaletteButton[] = [];
  private stepCells: Record<TowerType, Phaser.GameObjects.Rectangle[]> = { kick: [], clap: [], hats: [], bass: [] };
  private rowLabels = {} as Record<TowerType, Phaser.GameObjects.Text>;
  private playhead!: Phaser.GameObjects.Rectangle;
  private trashRect!: Phaser.Geom.Rectangle;
  private trash!: Phaser.GameObjects.Graphics;
  private trashText!: Phaser.GameObjects.Text;

  private audibleLayers: ReadonlySet<TowerType> = new Set();
  private playing = false;
  private lastStep = -1;

  constructor(
    private readonly board: Board,
    private readonly engine: AudioEngine,
  ) {
    super('game');
  }

  create(): void {
    const cam = this.cameras.main;
    cam.setZoom(RENDER_SCALE).setOrigin(0, 0);
    cam.setBackgroundColor(COLORS.background);
    this.input.mouse?.disableContextMenu();

    this.drawGrid();
    this.drawHud();
    this.drawPanel();

    this.cursor = this.add.graphics().setDepth(5);
    this.ghostShape = this.add.graphics();
    this.ghost = this.add.container(0, 0, [this.ghostShape]).setDepth(20).setVisible(false);

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onDown(p));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onMove(p));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.onUp(p));
    this.input.on('gameout', () => {
      this.hoverCell = null;
      this.refreshCursor();
    });

    const kb = this.input.keyboard!;
    TOWER_TYPES.forEach((type) => kb.on(`keydown-${keyName(TOWER_DEFS[type].hotkey)}`, () => this.select(type)));
    kb.on('keydown-ESC', () => this.select(null));
    kb.on('keydown-SPACE', () => this.engine.togglePause());
    const removeHovered = () => {
      const t = this.hoverCell && this.board.towerAt(this.hoverCell);
      if (t) this.removeTower(t.id);
    };
    kb.on('keydown-DELETE', removeHovered);
    kb.on('keydown-BACKSPACE', removeHovered);

    this.engine.addListener({ onHit: (e) => this.onHit(e) });

    this.select('kick');
    this.refreshLayers();
  }

  override update(): void {
    const playing = this.engine.isPlaying;
    if (playing !== this.playing) {
      this.playing = playing;
      this.statusText.setText(playing ? '' : 'PAUSED · space to resume');
    }

    // Follow the audio clock: what is being heard right now.
    const audible = this.engine.audible();
    if (audible && audible.step !== this.lastStep) {
      this.lastStep = audible.step;
      this.onAudibleStep(audible);
    }
    for (const view of this.views.values()) {
      if (!view.live && this.engine.isAudiblyLive(view.tower.id)) this.goLive(view);
    }
  }

  // ---------- drawing ----------

  private drawGrid(): void {
    const { cols, rows } = this.board.layout;
    const g = this.add.graphics();
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        const x = GRID.x + c * GRID.cell;
        const y = GRID.y + r * GRID.cell;
        const onPath = this.board.isPath({ col: c, row: r });
        g.fillStyle(onPath ? COLORS.path : COLORS.cell, 1);
        g.fillRoundedRect(x + 2, y + 2, GRID.cell - 4, GRID.cell - 4, 6);
      }
    }

    // Path centre line, pulsing with the beat.
    this.pathGlow = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.25);
    const cells = pathCells(this.board.layout);
    const wp = this.board.layout.waypoints.map((w) => this.cellCenter(w));
    this.pathGlow.lineStyle(6, COLORS.pathLine, 1);
    this.pathGlow.beginPath();
    this.pathGlow.moveTo(wp[0]!.x, wp[0]!.y);
    for (const p of wp.slice(1)) this.pathGlow.lineTo(p.x, p.y);
    this.pathGlow.strokePath();
    for (const c of cells) {
      const p = this.cellCenter(c);
      this.pathGlow.fillStyle(COLORS.pathLine, 0.12);
      this.pathGlow.fillRoundedRect(p.x - GRID.cell / 2 + 2, p.y - GRID.cell / 2 + 2, GRID.cell - 4, GRID.cell - 4, 6);
    }

    // Entry and exit marks.
    const first = wp[0]!;
    const last = wp[wp.length - 1]!;
    this.add.text(first.x + 34, first.y - 40, 'IN', { fontFamily: MONO, fontSize: '11px', color: COLORS.muted, resolution: RENDER_SCALE });
    this.add.text(last.x - 62, last.y - 40, 'OUT', { fontFamily: MONO, fontSize: '11px', color: COLORS.muted, resolution: RENDER_SCALE });
  }

  private drawHud(): void {
    const y = 26;
    const label = (x: number, text: string) =>
      this.add.text(x, y - 10, text, { fontFamily: MONO, fontSize: '11px', color: COLORS.muted, resolution: RENDER_SCALE });
    label(GRID.x, 'BAR');
    this.barText = this.add.text(GRID.x, y + 4, '–', {
      fontFamily: MONO,
      fontSize: '34px',
      fontStyle: 'bold',
      color: COLORS.text,
      resolution: RENDER_SCALE,
    });

    label(GRID.x + 96, 'BEAT');
    for (let i = 0; i < 4; i++) {
      this.beatDots.push(this.add.circle(GRID.x + 104 + i * 26, y + 26, 8, 0xffffff, 0.12));
    }

    label(GRID.x + 232, 'CHORD');
    this.chordText = this.add.text(GRID.x + 232, y + 8, '–', {
      fontFamily: FONT,
      fontSize: '26px',
      fontStyle: 'bold',
      color: COLORS.text,
      resolution: RENDER_SCALE,
    });

    label(GRID.x + 352, 'TEMPO');
    this.bpmText = this.add.text(GRID.x + 352, y + 12, '', {
      fontFamily: MONO,
      fontSize: '18px',
      color: COLORS.text,
      resolution: RENDER_SCALE,
    });

    label(GRID.x + 462, 'LAYERS');
    this.layersText = this.add.text(GRID.x + 462, y + 12, '0 / 4', {
      fontFamily: MONO,
      fontSize: '18px',
      color: COLORS.text,
      resolution: RENDER_SCALE,
    });

    this.statusText = this.add.text(GRID.x + 900, y + 14, '', {
      fontFamily: MONO,
      fontSize: '13px',
      color: '#ffc94d',
      resolution: RENDER_SCALE,
    });
    this.statusText.setOrigin(1, 0);
  }

  private drawPanel(): void {
    const x = PANEL.x;
    const w = PANEL.width;
    const heading = (y: number, text: string) =>
      this.add.text(x, y, text, { fontFamily: MONO, fontSize: '11px', color: COLORS.muted, resolution: RENDER_SCALE });

    heading(GRID.y - 22, 'TOWERS · click a cell, or drag');
    TOWER_TYPES.forEach((type, i) => {
      const def = TOWER_DEFS[type];
      const y = GRID.y + i * 70;
      const rect = new Phaser.Geom.Rectangle(x, y, w, 62);
      const bg = this.add.graphics();
      const icon = this.add.graphics({ x: x + 34, y: y + 31 });
      drawShape(icon, def.shape, 28, def.color);
      this.add.text(x + 66, y + 12, def.name, {
        fontFamily: FONT,
        fontSize: '17px',
        fontStyle: 'bold',
        color: COLORS.text,
        resolution: RENDER_SCALE,
      });
      this.add.text(x + 66, y + 35, def.role, { fontFamily: FONT, fontSize: '12px', color: COLORS.muted, resolution: RENDER_SCALE });
      this.add
        .text(x + w - 14, y + 12, def.hotkey, { fontFamily: MONO, fontSize: '13px', color: COLORS.dim, resolution: RENDER_SCALE })
        .setOrigin(1, 0);
      this.palette.push({ type, rect, bg });
    });

    // Track view: the 16 steps of every layer, with a playhead.
    const trackY = GRID.y + 4 * 70 + 26;
    heading(trackY, 'TRACK');
    const cellW = 15;
    const gap = 2;
    const left = x + 34;
    const rowH = 22;
    this.playhead = this.add
      .rectangle(left, trackY + 18, cellW + 2, rowH * 4 + 2, 0xffffff, 0.14)
      .setOrigin(0, 0)
      .setVisible(false);
    TOWER_TYPES.forEach((type, r) => {
      const def = TOWER_DEFS[type];
      const y = trackY + 20 + r * rowH;
      this.rowLabels[type] = this.add.text(x, y + 1, def.name.slice(0, 4).toUpperCase(), {
        fontFamily: MONO,
        fontSize: '10px',
        color: COLORS.dim,
        resolution: RENDER_SCALE,
      });
      for (let s = 0; s < STEPS_PER_BAR; s++) {
        const hit = def.patterns.base[s] !== null;
        const cx = left + s * (cellW + gap) + (s >= 4 ? Math.floor(s / 4) * 3 : 0);
        const cell = this.add
          .rectangle(cx + 1, y, cellW, rowH - 6, hit ? def.color : 0xffffff, hit ? 1 : 0.05)
          .setOrigin(0, 0)
          .setAlpha(hit ? STEP_ALPHA.off : 1);
        this.stepCells[type].push(cell);
      }
    });

    // Trash.
    const trashY = trackY + 20 + 4 * rowH + 22;
    this.trashRect = new Phaser.Geom.Rectangle(x, trashY, w, 56);
    this.trash = this.add.graphics();
    this.trashText = this.add
      .text(x + w / 2, trashY + 28, 'Drop here to remove', { fontFamily: FONT, fontSize: '13px', color: COLORS.dim, resolution: RENDER_SCALE })
      .setOrigin(0.5);
    this.drawTrash(false, false);

    this.add.text(
      x,
      trashY + 70,
      ['Drag a tower to move it', 'Right-click or drop in the bin to remove', 'Space: pause · T: tuning · 1–4: pick tower'],
      { fontFamily: FONT, fontSize: '12px', color: COLORS.muted, lineSpacing: 6, resolution: RENDER_SCALE },
    );
  }

  private drawTrash(visible: boolean, hot: boolean): void {
    const r = this.trashRect;
    this.trash.clear();
    this.trash.lineStyle(1.5, hot ? COLORS.invalid : COLORS.panelLine, visible ? 1 : 0.6);
    this.trash.fillStyle(hot ? COLORS.invalid : COLORS.panel, hot ? 0.18 : 0.6);
    this.trash.fillRoundedRect(r.x, r.y, r.width, r.height, 10);
    this.trash.strokeRoundedRect(r.x, r.y, r.width, r.height, 10);
    this.trashText.setColor(hot ? '#ff8da1' : visible ? COLORS.text : COLORS.dim);
  }

  private refreshPalette(): void {
    for (const b of this.palette) {
      const on = b.type === this.selected;
      const def = TOWER_DEFS[b.type];
      b.bg.clear();
      b.bg.fillStyle(on ? def.color : COLORS.panel, on ? 0.14 : 1);
      b.bg.fillRoundedRect(b.rect.x, b.rect.y, b.rect.width, b.rect.height, 10);
      b.bg.lineStyle(on ? 2 : 1, on ? def.color : COLORS.panelLine, 1);
      b.bg.strokeRoundedRect(b.rect.x, b.rect.y, b.rect.width, b.rect.height, 10);
    }
  }

  // ---------- towers ----------

  private addView(tower: Tower): TowerView {
    const def = TOWER_DEFS[tower.type];
    const p = this.cellCenter(tower);
    const glow = this.add.circle(0, 0, GRID.cell * 0.5, def.color, 1);
    const ring = this.add.circle(0, 0, TOWER_SIZE / 2).setStrokeStyle(2, def.color, 1).setAlpha(0);
    ring.isFilled = false;
    const body = this.add.graphics();
    drawShape(body, def.shape, TOWER_SIZE, def.color);
    const outline = this.add.graphics();
    drawShape(outline, def.shape, TOWER_SIZE + 8, def.color, 0.9, true);
    const container = this.add.container(p.x, p.y, [glow, ring, body, outline]).setDepth(10);
    const view: TowerView = { tower, container, glow, ring, body, outline, live: tower.state === 'live' };
    this.views.set(tower.id, view);
    this.applyLiveLook(view);
    if (!view.live) {
      container.setScale(0.6);
      this.tweens.add({ targets: container, scale: 1, duration: 180, ease: 'Back.easeOut' });
    }
    return view;
  }

  private applyLiveLook(view: TowerView): void {
    view.body.setAlpha(view.live ? 1 : 0.28);
    view.outline.setAlpha(view.live ? 0 : 0.8);
    view.glow.setAlpha(view.live ? 0.08 : 0);
  }

  private placeTower(type: TowerType, cell: Cell): void {
    const tower = this.board.place(type, cell);
    if (tower) {
      this.addView(tower);
      this.refreshLayers();
    }
  }

  private removeTower(id: number): void {
    const view = this.views.get(id);
    if (!this.board.remove(id) || !view) return;
    this.views.delete(id);
    this.tweens.killTweensOf([view.container, view.body, view.glow, view.ring]);
    this.tweens.add({
      targets: view.container,
      scale: 0.2,
      alpha: 0,
      duration: 200,
      ease: 'Cubic.easeIn',
      onComplete: () => view.container.destroy(),
    });
    this.refreshLayers();
  }

  // ---------- engine events (already on audio time) ----------

  private goLive(view: TowerView): void {
    view.live = true;
    this.tweens.killTweensOf([view.outline, view.body, view.glow]);
    this.applyLiveLook(view);
    this.tweens.add({ targets: view.body, scale: { from: 1.6, to: 1 }, duration: 320, ease: 'Back.easeOut' });
    this.tweens.add({ targets: view.glow, alpha: { from: 0.6, to: 0.08 }, scale: { from: 1.8, to: 1 }, duration: 500 });
  }

  private onAudibleStep(e: AudibleState): void {
    this.audibleLayers = e.active;
    const { pos } = e;

    this.barText.setText(String(pos.bar + 1));
    this.chordText.setText(e.chord);
    this.bpmText.setText(`${Math.round(this.engine.bpm)} BPM`);

    this.playhead.setVisible(true);
    const first = this.stepCells.kick[pos.stepInBar]!;
    this.playhead.setX(first.x - 1);

    if (pos.sixteenth === 0) {
      this.beatDots.forEach((d, i) => {
        d.setFillStyle(0xffffff, i === pos.beat ? 0.95 : i < pos.beat ? 0.3 : 0.12);
      });
      const downbeat = pos.beat === 0;
      this.tweens.add({ targets: this.pathGlow, alpha: { from: downbeat ? 0.75 : 0.5, to: 0.25 }, duration: 380, ease: 'Quad.easeOut' });

      // Queued towers blink on each beat until their bar comes.
      for (const view of this.views.values()) {
        if (view.live) continue;
        this.tweens.add({ targets: view.outline, alpha: { from: 1, to: 0.3 }, duration: 300 });
      }
    }
    this.refreshLayers();
  }

  private onHit(e: HitEvent): void {
    const v = e.velocity;
    for (const view of this.views.values()) {
      if (!view.live || view.tower.type !== e.type) continue;
      this.tweens.add({ targets: view.body, scale: { from: 1 + 0.38 * v, to: 1 }, duration: 170, ease: 'Cubic.easeOut' });
      this.tweens.add({ targets: view.glow, alpha: { from: 0.4 * v, to: 0.08 }, duration: 260, ease: 'Quad.easeOut' });
      this.tweens.add({ targets: view.ring, alpha: { from: 0.8 * v, to: 0 }, scale: { from: 1, to: 2.3 }, duration: 320, ease: 'Quad.easeOut' });
    }
    const cell = this.stepCells[e.type][e.step % STEPS_PER_BAR];
    if (cell) this.tweens.add({ targets: cell, alpha: { from: 1, to: STEP_ALPHA.on }, duration: 200 });
  }

  private layerState(type: TowerType): LayerState {
    const has = this.board.all().some((t) => t.type === type);
    const audible = this.audibleLayers.has(type);
    if (audible) return has ? 'on' : 'leaving';
    return has ? 'queued' : 'off';
  }

  private refreshLayers(): void {
    let on = 0;
    for (const type of TOWER_TYPES) {
      const state = this.layerState(type);
      if (state === 'on' || state === 'leaving') on++;
      const def = TOWER_DEFS[type];
      const label = this.rowLabels[type];
      const color = state === 'on' ? hex(def.color) : state === 'off' ? COLORS.dim : COLORS.muted;
      label.setColor(color);
      label.setText(`${def.name.slice(0, 4).toUpperCase()}${state === 'queued' ? '+' : state === 'leaving' ? '-' : ''}`);
      const alpha = STEP_ALPHA[state];
      this.stepCells[type].forEach((cell, s) => {
        if (def.patterns.base[s] !== null && !this.tweens.isTweening(cell)) cell.setAlpha(alpha);
      });
    }
    this.layersText.setText(`${on} / 4`);
  }

  // ---------- input ----------

  private select(type: TowerType | null): void {
    this.selected = type;
    this.refreshPalette();
    this.refreshCursor();
  }

  private onDown(p: Phaser.Input.Pointer): void {
    const x = p.worldX;
    const y = p.worldY;
    const button = this.palette.find((b) => b.rect.contains(x, y));
    if (button) {
      this.select(button.type);
      this.drag = { kind: 'new', type: button.type, x0: x, y0: y, moved: false };
      return;
    }
    const cell = this.cellAt(x, y);
    if (!cell) return;
    const tower = this.board.towerAt(cell);
    if (tower) {
      if (p.rightButtonDown()) {
        this.removeTower(tower.id);
        return;
      }
      const view = this.views.get(tower.id);
      if (view) this.drag = { kind: 'move', view, x0: x, y0: y, moved: false };
      return;
    }
    if (p.rightButtonDown()) return;
    if (this.selected && this.board.canPlace(cell)) this.placeTower(this.selected, cell);
  }

  private onMove(p: Phaser.Input.Pointer): void {
    const x = p.worldX;
    const y = p.worldY;
    this.hoverCell = this.cellAt(x, y);
    const d = this.drag;
    if (d) {
      if (!d.moved && Math.hypot(x - d.x0, y - d.y0) > DRAG_THRESHOLD) {
        d.moved = true;
        const type = d.kind === 'new' ? d.type : d.view.tower.type;
        this.ghostShape.clear();
        drawShape(this.ghostShape, TOWER_DEFS[type].shape, TOWER_SIZE, TOWER_DEFS[type].color, 0.85);
        this.ghost.setVisible(true);
        if (d.kind === 'move') d.view.container.setAlpha(0.25);
      }
      if (d.moved) {
        this.ghost.setPosition(x, y);
        this.drawTrash(d.kind === 'move', d.kind === 'move' && this.trashRect.contains(x, y));
      }
    }
    this.refreshCursor();
  }

  private onUp(p: Phaser.Input.Pointer): void {
    const d = this.drag;
    this.drag = null;
    this.ghost.setVisible(false);
    this.drawTrash(false, false);
    if (!d || !d.moved) {
      if (d?.kind === 'move') d.view.container.setAlpha(1);
      this.refreshCursor();
      return;
    }
    const x = p.worldX;
    const y = p.worldY;
    const cell = this.cellAt(x, y);
    if (d.kind === 'new') {
      if (cell && this.board.canPlace(cell)) this.placeTower(d.type, cell);
    } else {
      const view = d.view;
      view.container.setAlpha(1);
      if (this.trashRect.contains(x, y)) {
        this.removeTower(view.tower.id);
      } else if (cell && this.board.move(view.tower.id, cell)) {
        const c = this.cellCenter(cell);
        view.container.setPosition(c.x, c.y);
        this.tweens.add({ targets: view.container, scale: { from: 1.25, to: 1 }, duration: 160, ease: 'Back.easeOut' });
      }
    }
    this.refreshCursor();
  }

  /** Cell highlight under the pointer: where a tower would go, green if OK, red if not. */
  private refreshCursor(): void {
    const g = this.cursor;
    g.clear();
    const cell = this.hoverCell;
    if (!cell) return;
    const d = this.drag;
    const type = d?.moved ? (d.kind === 'new' ? d.type : d.view.tower.type) : this.selected;
    const ignore = d?.moved && d.kind === 'move' ? d.view.tower.id : undefined;
    const occupied = this.board.towerAt(cell);
    if (!d?.moved && occupied) {
      // Hovering an existing tower: subtle outline, it can be dragged.
      this.strokeCell(g, cell, 0xffffff, 0.35);
      return;
    }
    if (!type) return;
    const ok = this.board.canPlace(cell, ignore);
    this.strokeCell(g, cell, ok ? COLORS.valid : COLORS.invalid, 0.8);
    if (ok && !d?.moved) {
      const c = this.cellCenter(cell);
      g.fillStyle(TOWER_DEFS[type].color, 0.22);
      g.fillCircle(c.x, c.y, TOWER_SIZE / 2);
    }
  }

  private strokeCell(g: Phaser.GameObjects.Graphics, cell: Cell, color: number, alpha: number): void {
    g.lineStyle(2, color, alpha);
    g.strokeRoundedRect(GRID.x + cell.col * GRID.cell + 2, GRID.y + cell.row * GRID.cell + 2, GRID.cell - 4, GRID.cell - 4, 6);
  }

  // ---------- helpers ----------

  private cellAt(x: number, y: number): Cell | null {
    const col = Math.floor((x - GRID.x) / GRID.cell);
    const row = Math.floor((y - GRID.y) / GRID.cell);
    if (col < 0 || row < 0 || col >= this.board.layout.cols || row >= this.board.layout.rows) return null;
    return { col, row };
  }

  private cellCenter(c: Cell): { x: number; y: number } {
    return { x: GRID.x + (c.col + 0.5) * GRID.cell, y: GRID.y + (c.row + 0.5) * GRID.cell };
  }
}

function keyName(digit: string): string {
  return ['ZERO', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE'][Number(digit)] ?? digit;
}

export const GAME_SIZE = { width: SCREEN.width * RENDER_SCALE, height: SCREEN.height * RENDER_SCALE };
