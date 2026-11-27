import { describe, expect, it } from 'vitest';
import { DEFAULT_TUNING, TUNING_FIELDS } from '../src/config/tuning';
import { mergeTuning, readPath, TuningStore, type KeyValueStorage } from '../src/config/tuningStore';

function memoryStorage(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

describe('tuning', () => {
  it('ships the musical spec', () => {
    // Each song sets its own tempo and swing; tuning only offsets them.
    expect(DEFAULT_TUNING.transport.tempo).toBe(0);
    expect(DEFAULT_TUNING.transport.swing).toBe(0);
  });

  it('every panel field points at a real value inside its range', () => {
    for (const f of TUNING_FIELDS) {
      const v = readPath(DEFAULT_TUNING, f.path);
      expect(typeof v, f.path).toBe('number');
      if (f.options) expect(f.options.map((o) => o.value), f.path).toContain(v);
      else {
        expect(v, f.path).toBeGreaterThanOrEqual(f.min);
        expect(v, f.path).toBeLessThanOrEqual(f.max);
      }
    }
  });

  it('merges saved values, ignores junk and clamps to range', () => {
    const merged = mergeTuning(DEFAULT_TUNING, {
      transport: { tempo: 4, swing: 'lots', nope: 3 },
      mix: { bass: 999 },
      bogus: { a: 1 },
    });
    expect(merged.transport.tempo).toBe(4);
    expect(merged.transport.swing).toBe(DEFAULT_TUNING.transport.swing);
    expect(merged.mix.bass).toBe(12);
    expect(DEFAULT_TUNING.transport.tempo).toBe(0); // defaults untouched
  });

  it('survives broken saved JSON', () => {
    const storage = memoryStorage();
    storage.setItem('rhythm-td.tuning.v2', '{not json');
    expect(new TuningStore(storage).get('transport.tempo')).toBe(0);
  });

  it('saves, notifies, reloads and resets', () => {
    const storage = memoryStorage();
    const store = new TuningStore(storage);
    const seen: [string, number][] = [];
    store.subscribe((p, v) => seen.push([p, v]));
    store.set('transport.tempo', 2);
    expect(seen).toEqual([['transport.tempo', 2]]);
    expect(new TuningStore(storage).get('transport.tempo')).toBe(2);
    store.reset();
    expect(store.get('transport.tempo')).toBe(0);
    expect(new TuningStore(storage).get('transport.tempo')).toBe(0);
  });

  it('snaps choice fields to a valid option', () => {
    const store = new TuningStore(memoryStorage());
    store.set('transport.swingGrid', 12);
    expect([8, 16]).toContain(store.get('transport.swingGrid'));
  });

  it('copies as JSON that loads back', () => {
    const store = new TuningStore(memoryStorage());
    store.set('mix.arp', -10);
    const again = mergeTuning(DEFAULT_TUNING, JSON.parse(store.toJSON()));
    expect(again.mix.arp).toBe(-10);
  });
});
