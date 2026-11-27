/** Screen layout in logical pixels. Visual only, no game rules here. */

export const SCREEN = { width: 1280, height: 720 };

/** Internal render scale so shapes and text stay sharp on retina screens. */
export const RENDER_SCALE = 2;

/**
 * The board's top-left corner, cell size and tower size. Each level's map is centred in the board area;
 * bigger maps get smaller cells (40 px at most) so every map fits the same screen.
 */
export const GRID = { x: 24, y: 104, cell: 40, w: 880, h: 560, tower: 24 };

/** Board area: left of the side panel, under the HUD. */
const BOARD_AREA = { x: 24, y: 96, w: 900, h: 608 };

export function setGridFor(layout: { cols: number; rows: number }): void {
  GRID.cell = Math.min(40, Math.floor(BOARD_AREA.w / layout.cols), Math.floor(BOARD_AREA.h / layout.rows));
  GRID.tower = Math.round(GRID.cell * 0.6);
  GRID.w = layout.cols * GRID.cell;
  GRID.h = layout.rows * GRID.cell;
  GRID.x = Math.round(BOARD_AREA.x + (BOARD_AREA.w - GRID.w) / 2);
  GRID.y = Math.round(BOARD_AREA.y + (BOARD_AREA.h - GRID.h) / 2);
}

/** Left edge of the HUD and the panel headings. */
export const HUD_X = 24;
/** Top of the side panel. */
export const PANEL_Y = 104;

export const PANEL = { x: 948, width: 308 };

export const COLORS = {
  background: 0x0b0d17,
  cell: 0x151a2c,
  cellLine: 0x20273f,
  path: 0x1d1830,
  pathLine: 0x6c4dff,
  text: '#e9ecff',
  muted: '#7d86ad',
  dim: '#4a5275',
  valid: 0x5dffa8,
  invalid: 0xff4d6d,
  panel: 0x121628,
  panelLine: 0x262d4a,
};

export const FONT = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
export const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';
