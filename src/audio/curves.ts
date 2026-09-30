/** Pure shaping helpers for the audio layer (no Tone.js, unit tested). */

/** Soft-clip curve for saturation. drive 0 = clean, 1 = heavy. Peak stays at 1. */
export function driveCurve(drive: number): (x: number) => number {
  const k = Math.max(0, drive) * 8;
  if (k < 0.01) return (x) => x;
  const norm = Math.tanh(k);
  return (x) => Math.tanh(k * x) / norm;
}

/** Linear up to the knee, then a smooth tanh shoulder that approaches (never passes) full scale. */
export function safetyCurve(x: number): number {
  const knee = 0.84;
  const a = Math.abs(x);
  if (a <= knee) return x;
  const over = (a - knee) / (1 - knee);
  return Math.sign(x) * (knee + (1 - knee) * Math.tanh(over));
}

export function dbToGain(db: number): number {
  return Math.pow(10, db / 20);
}
