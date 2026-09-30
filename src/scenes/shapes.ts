import Phaser from 'phaser';
import type { TowerShape } from '../game/towers';

/** Draw a tower shape centred on (0, 0). `size` is the full width. */
export function drawShape(
  g: Phaser.GameObjects.Graphics,
  shape: TowerShape,
  size: number,
  color: number,
  alpha = 1,
  outline = false,
): void {
  const r = size / 2;
  if (outline) g.lineStyle(2, color, alpha);
  else g.fillStyle(color, alpha);
  switch (shape) {
    case 'circle':
      outline ? g.strokeCircle(0, 0, r) : g.fillCircle(0, 0, r);
      break;
    case 'square': {
      const s = size * 0.86;
      outline ? g.strokeRect(-s / 2, -s / 2, s, s) : g.fillRect(-s / 2, -s / 2, s, s);
      break;
    }
    case 'triangle': {
      const h = size * 0.95;
      outline
        ? g.strokeTriangle(0, -h / 2, r, h / 2, -r, h / 2)
        : g.fillTriangle(0, -h / 2, r, h / 2, -r, h / 2);
      break;
    }
    case 'diamond': {
      const pts = [new Phaser.Math.Vector2(0, -r), new Phaser.Math.Vector2(r, 0), new Phaser.Math.Vector2(0, r), new Phaser.Math.Vector2(-r, 0)];
      outline ? g.strokePoints(pts, true, true) : g.fillPoints(pts, true, true);
      break;
    }
  }
}

export function hex(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}
