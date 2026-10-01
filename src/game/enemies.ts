/** Enemy definitions as data. Numbers (HP, speed, bounty) live in tuning. */

export type EnemyType = 'static' | 'muffler';

export interface EnemyDef {
  type: EnemyType;
  name: string;
  color: number;
  shape: 'spike' | 'blob';
}

export const ENEMY_DEFS: Record<EnemyType, EnemyDef> = {
  static: { type: 'static', name: 'Static', color: 0xe8ecff, shape: 'spike' },
  muffler: { type: 'muffler', name: 'Muffler', color: 0x6f7bd6, shape: 'blob' },
};

export const ENEMY_TYPES: readonly EnemyType[] = ['static', 'muffler'];
