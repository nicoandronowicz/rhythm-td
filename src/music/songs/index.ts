import type { SongDef, SongId } from '../song';
import { AFTERHOURS } from './afterhours';
import { NIGHTBUS } from './nightbus';
import { LOWTIDE } from './lowtide';
import { SEVENRIVERS } from './sevenrivers';

export const SONGS: Record<SongId, SongDef> = {
  afterhours: AFTERHOURS,
  nightbus: NIGHTBUS,
  sevenrivers: SEVENRIVERS,
  lowtide: LOWTIDE,
};

export function songById(id: SongId): SongDef {
  const s = SONGS[id];
  if (!s) throw new Error(`Unknown song "${id}"`);
  return s;
}
