/**
 * The core: the foundation of the song you defend. Each song lists its core layers in drop-out order
 * (the first drops first; the last is the foundation, and losing it ends the run). Layers without a
 * perk always play; perks are extra layers you buy.
 */

import type { Tuning } from '../config/tuning';
import type { CoreLayerDef, SongDef } from '../music/song';

export type CoreLayerId = string;

export function baseLayers(song: SongDef): CoreLayerDef[] {
  return song.core.filter((l) => !l.perk);
}

/** Perks, cheapest first. */
export function perkLayers(song: SongDef): CoreLayerDef[] {
  return song.core.filter((l) => l.perk).sort((a, b) => a.perk!.tier - b.perk!.tier);
}

/** The last layer standing: when it drops, the run is over. */
export function foundation(song: SongDef): CoreLayerDef {
  return song.core[song.core.length - 1]!;
}

export function coreLayer(song: SongDef, id: CoreLayerId): CoreLayerDef | undefined {
  return song.core.find((l) => l.id === id);
}

export function perkCost(layer: CoreLayerDef, t: Readonly<Tuning>): number {
  const tier = layer.perk?.tier ?? 1;
  return t.core[`perk${tier}Cost`];
}
