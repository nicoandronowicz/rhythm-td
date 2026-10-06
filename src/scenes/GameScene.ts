/**
 * The board screen. Draws only what the world and audio engine already decided:
 *  - every frame it reads the audible state (what is being heard now) and places enemies,
 *    lights playing towers, updates the HUD;
 *  - one-off effects (pulses, shots, kills) arrive as Tone.Draw callbacks.
 * Input (place, move, remove) goes straight to the world; it takes effect on the next tick.
 */

import Phaser from 'phaser';
import type { AudibleState, AudioEngine } from '../audio/engine';
import { tuning } from '../config/tuningStore';
import { DRUM_DEFS, type DrumType } from '../game/core';
import { ENEMY_DEFS } from '../game/enemies';
import { isCoreCell, type Cell } from '../game/grid';
import { TOWER_DEFS, TOWER_TYPES, type TowerType } from '../game/towers';
import { towerStats, type World } from '../game/world';
import { Hud } from './hud';
import { COLORS, GRID, MONO, RENDER_SCALE, SCREEN } from './layout';
import { Panel } from './panel';
import { drawShape } from './shapes';
import { CoreView, Effects, EnemyView, TOWER_SIZE, TowerView, toScreen } from './views';

const DRAG_THRESHOLD = 6;

type Drag =
  | { kind: 'new'; type: TowerType; x0: number; y0: number; moved: boolean }
  | { kind: 'move'; view: TowerView; x0: number; y0: number; moved: boolean };

export class GameScene extends Phaser.Scene {
  private towers = new Map<number, TowerView>();
  private enemies = new Map<number, EnemyView>();
  private selected: TowerType | null = 'bass';
  private drag: Drag | null = null;
  private hoverCell: Cell | null = null;

  private hud!: Hud;
  private panel!: Panel;
  private core!: CoreView;
  private fx!: Effects;
  private pathGlow!: Phaser.GameObjects.Graphics;
  private cursor!: Phaser.GameObjects.Graphics;
  private ghost!: Phaser.GameObjects.Container;
  private ghostShape!: Phaser.GameObjects.Graphics;
  private hoverLabel!: Phaser.GameObjects.Text;

  private playing = false;
  /** Audio time the run ended; the screen comes up two bars later. */
  private gameOverAt: number | null = null;
  private gameOverShown = false;
  private lastStep = -1;

  constructor(
    private readonly world: World,
    private readonly engine: AudioEngine,
  ) {
    super('game');
  }

  create(): void {
    const cam = this.cameras.main;
    cam.setZoom(RENDER_SCALE).setOrigin(0, 0);
    cam.setBackgroundColor(COLORS.background);
    this.input.mouse?.disableContextMenu();

    this.drawBoard();
    this.core = new CoreView(this, this.world.board.layout);
    this.hud = new Hud(this);
    this.panel = new Panel(this);
    this.fx = new Effects(this);

    this.cursor = this.add.graphics().setDepth(7);
    this.ghostShape = this.add.graphics();
    this.ghost = this.add.container(0, 0, [this.ghostShape]).setDepth(20).setVisible(false);
    this.hoverLabel = this.add
      .text(0, 0, '', { fontFamily: MONO, fontSize: '12px', color: COLORS.text, backgroundColor: '#121628', padding: { x: 6, y: 3 }, resolution: RENDER_SCALE })
      .setOrigin(0.5, 1)
      .setDepth(40)
      .setVisible(false);

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
      const t = this.hoverCell && this.world.board.towerAt(this.hoverCell);
      if (t) this.removeTower(t.id);
    };
    kb.on('keydown-DELETE', removeHovered);
    kb.on('keydown-BACKSPACE', removeHovered);

    this.engine.addListener({
      onHit: (e) => {
        if (e.instrument in DRUM_DEFS) this.core.pulse(e.instrument as DrumType, e.velocity);
        this.panel.flashStep(e.instrument, e.step % 16);
        for (const v of this.towers.values()) {
          if (v.tower.type === e.instrument && v.playing) v.pulse(e.velocity);
        }
      },
      onAttack: (a) => {
        const view = this.towers.get(a.towerId);
        if (!view) return;
        this.fx.attack(a.type, view.screen, a.points.map(toScreen), towerStats(tuning.current, a.type).range);
      },
      onKill: (k) => this.fx.kill(toScreen(k.point), k.bounty, ENEMY_DEFS[k.type].color),
      onLeak: () => this.core.hit(),
      onEnemyAttack: (a) => {
        const view = this.towers.get(a.towerId);
        if (!view) return;
        this.fx.enemyAttack(a.type, toScreen(a.from), view.screen);
        view.struck(a.type === 'static');
      },
    });

    this.select('bass');
  }

  override update(): void {
    const playing = this.engine.isPlaying;
    if (playing !== this.playing) {
      this.playing = playing;
      this.hud.setStatus(playing ? '' : 'PAUSED · space to resume');
    }
    this.hud.setMoney(this.world.money);
    this.panel.refreshPalette(this.selected, this.world.money, (t) => towerStats(tuning.current, t).cost);

    const a = this.engine.audible();
    if (a) {
      if (a.step !== this.lastStep) {
        this.lastStep = a.step;
        this.onAudibleStep(a);
      }
      this.drawEnemies(a);
      if (a.gameOver && this.gameOverAt === null) this.gameOverAt = a.time + a.stepSeconds * 32;
      if (this.gameOverAt !== null && !this.gameOverShown && this.engine.now() >= this.gameOverAt) {
        this.gameOverShown = true;
        this.showGameOver();
      }
    }
    for (const view of this.towers.values()) {
      view.sync();
      if (!view.live && view.tower.state === 'live' && this.engine.isAudiblyLive(view.tower.id)) view.goLive();
    }
  }

  private showGameOver(): void {
    const n = this.world.wavesSurvived;
    const box = document.getElementById('gameover')!;
    document.getElementById('gameover-text')!.textContent =
      n === 0 ? 'The core fell before the first wave was through.' : `You held the groove through ${n} wave${n === 1 ? '' : 's'}.`;
    box.hidden = false;
    const btn = document.getElementById('restart-button') as HTMLButtonElement;
    btn.onclick = () => window.location.reload();
    btn.focus();
  }

  // ---------- following the audio ----------

  private onAudibleStep(a: AudibleState): void {
    const { pos } = a;
    this.hud.setStep(pos.bar, pos.beat, pos.sixteenth, a.chord);
    this.hud.setWaves({ status: a.waves, step: a.step, stepSeconds: a.stepSeconds, remaining: a.waves.pending + a.enemies.length });
    const perDrum = Math.max(1, Math.round(tuning.current.core.hpPerDrum));
    this.hud.setCore(a.drums.hats + a.drums.clap + a.drums.kick, perDrum * 3);
    this.core.setHealth(a.drums, perDrum);
    this.core.setResting(a.core === 'resting');
    this.panel.setStep(pos.stepInBar);

    for (const d of ['kick', 'clap', 'hats'] as const) {
      this.panel.setRowState(d, a.drums[d] <= 0 ? 'off' : a.core === 'resting' ? 'idle' : 'on');
    }
    for (const type of TOWER_TYPES) {
      const mode = a.layers[type].mode;
      this.panel.setRowState(type, mode === 'fighting' ? 'on' : mode === 'idle' ? 'idle' : 'off');
    }
    for (const v of this.towers.values()) v.setPlaying(a.playingTowers.has(v.tower.id));

    if (pos.sixteenth === 0) {
      const downbeat = pos.beat === 0;
      this.tweens.add({ targets: this.pathGlow, alpha: { from: downbeat ? 0.7 : 0.45, to: 0.22 }, duration: 380, ease: 'Quad.easeOut' });
      for (const v of this.towers.values()) v.blink();
    }
  }

  /** Enemies glide between ticks: last heard position plus the move it is making toward the next step. */
  private drawEnemies(a: AudibleState): void {
    const now = this.engine.now();
    const f = Math.min(Math.max((now - a.time) / a.stepSeconds, 0), 1);
    const seen = new Set<number>();
    for (const e of a.enemies) {
      seen.add(e.id);
      let view = this.enemies.get(e.id);
      if (!view) {
        view = new EnemyView(this, e);
        this.enemies.set(e.id, view);
      }
      const p = this.world.path.pointAt(e.progress + e.nextMove * f);
      view.update(toScreen(p), e);
    }
    for (const [id, view] of this.enemies) {
      if (!seen.has(id)) {
        view.destroy();
        this.enemies.delete(id);
      }
    }
  }

  // ---------- board ----------

  private drawBoard(): void {
    const layout = this.world.board.layout;
    const g = this.add.graphics();
    for (let c = 0; c < layout.cols; c++) {
      for (let r = 0; r < layout.rows; r++) {
        if (isCoreCell(layout, { col: c, row: r })) continue;
        const x = GRID.x + c * GRID.cell;
        const y = GRID.y + r * GRID.cell;
        g.fillStyle(this.world.board.isPath({ col: c, row: r }) ? COLORS.path : COLORS.cell, 1);
        g.fillRoundedRect(x + 2, y + 2, GRID.cell - 4, GRID.cell - 4, 6);
      }
    }
    this.pathGlow = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.22);
    const pts = this.world.path.points.map(toScreen);
    this.pathGlow.lineStyle(4, COLORS.pathLine, 1);
    this.pathGlow.beginPath();
    this.pathGlow.moveTo(pts[0]!.x, pts[0]!.y);
    for (const p of pts.slice(1)) this.pathGlow.lineTo(p.x, p.y);
    this.pathGlow.strokePath();
    this.add.text(pts[0]!.x + 24, pts[0]!.y - 30, 'IN', {
      fontFamily: MONO,
      fontSize: '11px',
      color: COLORS.muted,
      resolution: RENDER_SCALE,
    });
  }

  private placeTower(type: TowerType, cell: Cell): void {
    const r = this.world.place(type, cell, tuning.current);
    if (r.ok) {
      this.towers.set(r.tower.id, new TowerView(this, r.tower));
      return;
    }
    if (r.reason === 'money') {
      this.panel.denied(type);
      this.fx.say(toScreen({ x: cell.col + 0.5, y: cell.row + 0.5 }), 'Not enough money');
    }
  }

  private removeTower(id: number): void {
    const view = this.towers.get(id);
    const refund = this.world.remove(id, tuning.current);
    if (refund === null || !view) return;
    this.towers.delete(id);
    if (refund > 0) this.fx.say(view.screen, `+$${refund}`, '#5dffa8');
    view.remove();
  }

  private repairTower(view: TowerView): void {
    const r = this.world.repair(view.tower.id, tuning.current);
    if (r.ok) {
      view.sync();
      this.fx.say(view.screen, 'Repairing · back next bar', '#5dffa8');
    } else if (r.reason === 'money') {
      this.fx.say(view.screen, 'Not enough money');
    }
  }

  // ---------- input ----------

  private select(type: TowerType | null): void {
    this.selected = type;
    this.refreshCursor();
  }

  private onDown(p: Phaser.Input.Pointer): void {
    const x = p.worldX;
    const y = p.worldY;
    const button = this.panel.buttonAt(x, y);
    if (button) {
      this.select(button);
      this.drag = { kind: 'new', type: button, x0: x, y0: y, moved: false };
      return;
    }
    const cell = this.cellAt(x, y);
    if (!cell) return;
    const tower = this.world.board.towerAt(cell);
    if (tower) {
      if (p.rightButtonDown()) {
        this.removeTower(tower.id);
        return;
      }
      const view = this.towers.get(tower.id);
      if (view) this.drag = { kind: 'move', view, x0: x, y0: y, moved: false };
      return;
    }
    if (p.rightButtonDown()) return;
    if (this.selected && this.world.canBuild(cell)) this.placeTower(this.selected, cell);
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
        this.panel.drawTrash(d.kind === 'move', d.kind === 'move' && this.panel.trashRect.contains(x, y));
      }
    }
    this.refreshCursor();
  }

  private onUp(p: Phaser.Input.Pointer): void {
    const d = this.drag;
    this.drag = null;
    this.ghost.setVisible(false);
    this.panel.drawTrash(false, false);
    if (!d || !d.moved) {
      if (d?.kind === 'move') {
        d.view.container.setAlpha(1);
        if (d.view.isWreck) this.repairTower(d.view);
      }
      this.refreshCursor();
      return;
    }
    const x = p.worldX;
    const y = p.worldY;
    const cell = this.cellAt(x, y);
    if (d.kind === 'new') {
      if (cell && this.world.canBuild(cell)) this.placeTower(d.type, cell);
    } else {
      const view = d.view;
      view.container.setAlpha(1);
      if (this.panel.trashRect.contains(x, y)) this.removeTower(view.tower.id);
      else if (cell && this.world.move(view.tower.id, cell)) view.moveTo(cell.col, cell.row);
    }
    this.refreshCursor();
  }

  /** Cell highlight and range preview under the pointer. */
  private refreshCursor(): void {
    const g = this.cursor;
    g.clear();
    this.hoverLabel.setVisible(false);
    const cell = this.hoverCell;
    if (!cell) return;
    const d = this.drag;
    const center = toScreen({ x: cell.col + 0.5, y: cell.row + 0.5 });
    const occupant = this.world.board.towerAt(cell);
    if (!d?.moved && occupant) {
      this.strokeCell(g, cell, 0xffffff, 0.35);
      if (occupant.state === 'wreck') {
        const cost = this.world.repairCost(occupant, tuning.current);
        this.hoverLabel.setText(`Click to repair · $${cost}`).setPosition(center.x, center.y - 32).setVisible(true);
        return;
      }
      g.fillStyle(TOWER_DEFS[occupant.type].color, 0.06);
      const r = this.world.rangeOf(occupant, tuning.current) * GRID.cell;
      g.fillCircle(center.x, center.y, r);
      g.lineStyle(1.5, TOWER_DEFS[occupant.type].color, 0.5);
      g.strokeCircle(center.x, center.y, r);
      return;
    }
    const type = d?.moved ? (d.kind === 'new' ? d.type : d.view.tower.type) : this.selected;
    if (!type) return;
    const ignore = d?.moved && d.kind === 'move' ? d.view.tower.id : undefined;
    const ok = this.world.canBuild(cell, ignore);
    this.strokeCell(g, cell, ok ? COLORS.valid : COLORS.invalid, 0.8);
    if (!ok) return;
    this.strokeRange(g, center, type);
    if (!d?.moved) {
      g.fillStyle(TOWER_DEFS[type].color, 0.22);
      g.fillCircle(center.x, center.y, TOWER_SIZE / 2);
    }
  }

  private strokeRange(g: Phaser.GameObjects.Graphics, center: { x: number; y: number }, type: TowerType): void {
    const r = towerStats(tuning.current, type).range * GRID.cell;
    g.fillStyle(TOWER_DEFS[type].color, 0.06);
    g.fillCircle(center.x, center.y, r);
    g.lineStyle(1.5, TOWER_DEFS[type].color, 0.5);
    g.strokeCircle(center.x, center.y, r);
  }

  private strokeCell(g: Phaser.GameObjects.Graphics, cell: Cell, color: number, alpha: number): void {
    g.lineStyle(2, color, alpha);
    g.strokeRoundedRect(GRID.x + cell.col * GRID.cell + 2, GRID.y + cell.row * GRID.cell + 2, GRID.cell - 4, GRID.cell - 4, 6);
  }

  private cellAt(x: number, y: number): Cell | null {
    const { cols, rows } = this.world.board.layout;
    const col = Math.floor((x - GRID.x) / GRID.cell);
    const row = Math.floor((y - GRID.y) / GRID.cell);
    if (col < 0 || row < 0 || col >= cols || row >= rows) return null;
    return { col, row };
  }
}

function keyName(digit: string): string {
  return ['ZERO', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE'][Number(digit)] ?? digit;
}

export const GAME_SIZE = { width: SCREEN.width * RENDER_SCALE, height: SCREEN.height * RENDER_SCALE };
