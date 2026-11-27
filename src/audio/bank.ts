/**
 * Sample bank: loads the CC0 sample groups listed in public/samples/manifest.json, on demand.
 * Decoded buffers are cached for the whole page and work in any audio context (live or offline).
 */

import * as Tone from 'tone';

interface PitchedEntry {
  kind: 'pitched';
  notes: Record<string, string>;
}
interface PercEntry {
  kind: 'perc';
  arts: Record<string, string[]>;
}
type Entry = PitchedEntry | PercEntry;

export interface LoadedGroup {
  kind: 'pitched' | 'perc';
  /** Sorted by note. */
  notes: { midi: number; buffer: AudioBuffer }[];
  arts: Map<string, AudioBuffer[]>;
}

const base = () => `${import.meta.env.BASE_URL ?? '/'}samples/`;
let manifest: Promise<Record<string, Entry>> | null = null;
const groups = new Map<string, Promise<LoadedGroup>>();
const loaded = new Map<string, LoadedGroup>();
const reversed = new WeakMap<AudioBuffer, AudioBuffer>();

function getManifest(): Promise<Record<string, Entry>> {
  manifest ??= fetch(`${base()}manifest.json`).then((r) => {
    if (!r.ok) throw new Error(`Sample manifest: ${r.status}`);
    return r.json() as Promise<Record<string, Entry>>;
  });
  return manifest;
}

async function decode(path: string): Promise<AudioBuffer> {
  const res = await fetch(`${base()}${path}`);
  if (!res.ok) throw new Error(`Sample ${path}: ${res.status}`);
  const data = await res.arrayBuffer();
  const ctx = Tone.getContext().rawContext as unknown as BaseAudioContext;
  return ctx.decodeAudioData(data);
}

export function loadGroup(id: string): Promise<LoadedGroup> {
  let p = groups.get(id);
  if (!p) {
    p = (async () => {
      const entry = (await getManifest())[id];
      if (!entry) throw new Error(`Unknown sample group "${id}"`);
      const g: LoadedGroup = { kind: entry.kind, notes: [], arts: new Map() };
      if (entry.kind === 'pitched') {
        const list = await Promise.all(Object.entries(entry.notes).map(async ([m, path]) => ({ midi: Number(m), buffer: await decode(path) })));
        g.notes = list.sort((a, b) => a.midi - b.midi);
      } else {
        for (const [art, paths] of Object.entries(entry.arts)) g.arts.set(art, await Promise.all(paths.map(decode)));
      }
      loaded.set(id, g);
      return g;
    })();
    groups.set(id, p);
  }
  return p;
}

/** A group that has finished loading (null until then: the voice stays silent rather than glitching). */
export function group(id: string): LoadedGroup | null {
  return loaded.get(id) ?? null;
}

/** The sample nearest to a note, and the playback rate that tunes it. */
export function nearest(g: LoadedGroup, midi: number): { buffer: AudioBuffer; rate: number } | null {
  if (!g.notes.length) return null;
  let best = g.notes[0]!;
  for (const n of g.notes) if (Math.abs(n.midi - midi) < Math.abs(best.midi - midi)) best = n;
  return { buffer: best.buffer, rate: Math.pow(2, (midi - best.midi) / 12) };
}

export function reverseOf(buf: AudioBuffer): AudioBuffer {
  let r = reversed.get(buf);
  if (!r) {
    r = new AudioBuffer({ length: buf.length, numberOfChannels: buf.numberOfChannels, sampleRate: buf.sampleRate });
    for (let c = 0; c < buf.numberOfChannels; c++) {
      const src = buf.getChannelData(c);
      const dst = r.getChannelData(c);
      for (let i = 0; i < src.length; i++) dst[i] = src[src.length - 1 - i]!;
    }
    reversed.set(buf, r);
  }
  return r;
}
