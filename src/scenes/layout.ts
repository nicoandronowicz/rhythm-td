/** Screen layout in logical pixels. Visual only, no game rules here. */

export const SCREEN = { width: 1280, height: 720 };

/** Internal render scale so shapes and text stay sharp on retina screens. */
export const RENDER_SCALE = 2;

export const GRID = { x: 24, y: 104, cell: 40 };

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
