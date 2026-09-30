/**
 * Live tuning values: defaults from tuning.ts, overridden by what the panel saved in localStorage.
 */

import { DEFAULT_TUNING, TUNING_FIELDS, type Tuning, type TuningField, type TuningPath } from './tuning';

const STORAGE_KEY = 'rhythm-td.tuning.v1';

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

type Listener = (path: TuningPath, value: number) => void;

export function cloneTuning(t: Tuning): Tuning {
  return JSON.parse(JSON.stringify(t)) as Tuning;
}

export function fieldFor(path: TuningPath): TuningField | undefined {
  return TUNING_FIELDS.find((f) => f.path === path);
}

export function clampToField(path: TuningPath, value: number): number {
  const field = fieldFor(path);
  if (!field) return value;
  if (field.options) {
    return field.options.some((o) => o.value === value) ? value : field.options[0]!.value;
  }
  return Math.min(field.max, Math.max(field.min, value));
}

export function readPath(t: Tuning, path: TuningPath): number {
  const [section, key] = path.split('.') as [keyof Tuning, string];
  return (t[section] as Record<string, number>)[key]!;
}

function writePath(t: Tuning, path: TuningPath, value: number): void {
  const [section, key] = path.split('.') as [keyof Tuning, string];
  (t[section] as Record<string, number>)[key] = value;
}

/**
 * Merge saved values onto defaults. Unknown keys and non-numbers are ignored,
 * values are clamped to the panel range, so old or hand-edited saves can't break the game.
 */
export function mergeTuning(defaults: Tuning, saved: unknown): Tuning {
  const out = cloneTuning(defaults);
  if (!saved || typeof saved !== 'object') return out;
  const src = saved as Record<string, unknown>;
  for (const section of Object.keys(out) as (keyof Tuning)[]) {
    const savedSection = src[section];
    if (!savedSection || typeof savedSection !== 'object') continue;
    for (const key of Object.keys(out[section])) {
      const v = (savedSection as Record<string, unknown>)[key];
      if (typeof v === 'number' && Number.isFinite(v)) {
        const path = `${section}.${key}` as TuningPath;
        writePath(out, path, clampToField(path, v));
      }
    }
  }
  return out;
}

export class TuningStore {
  private values: Tuning;
  private listeners = new Set<Listener>();

  constructor(private storage: KeyValueStorage | null) {
    this.values = mergeTuning(DEFAULT_TUNING, this.loadSaved());
  }

  get current(): Readonly<Tuning> {
    return this.values;
  }

  get(path: TuningPath): number {
    return readPath(this.values, path);
  }

  set(path: TuningPath, value: number): void {
    const v = clampToField(path, value);
    if (this.get(path) === v) return;
    writePath(this.values, path, v);
    this.save();
    this.listeners.forEach((fn) => fn(path, v));
  }

  reset(): void {
    this.values = cloneTuning(DEFAULT_TUNING);
    this.storage?.removeItem(STORAGE_KEY);
    for (const f of TUNING_FIELDS) this.listeners.forEach((fn) => fn(f.path, this.get(f.path)));
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  toJSON(): string {
    return JSON.stringify(this.values, null, 2);
  }

  private loadSaved(): unknown {
    try {
      const raw = this.storage?.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  private save(): void {
    try {
      this.storage?.setItem(STORAGE_KEY, JSON.stringify(this.values));
    } catch {
      // Storage full or blocked: tuning still works for this session.
    }
  }
}

function browserStorage(): KeyValueStorage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

/** The game's single tuning store. */
export const tuning = new TuningStore(browserStorage());
