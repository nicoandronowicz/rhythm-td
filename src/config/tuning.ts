/**
 * Every tunable number in the game lives here.
 *
 * The tuning panel (T key) edits these live. Defaults below are what ships;
 * panel edits are saved in the browser and can be copied as JSON.
 */

export const DEFAULT_TUNING = {
  transport: {
    /** Tempo offset on every song, BPM (0 = as written). */
    tempo: 0,
    /** Swing added on top of each song's own, 0..1. */
    swing: 0,
    /** Which notes swing: 16 = every second 16th, 8 = every second 8th. */
    swingGrid: 16,
  },
  mix: {
    master: -9,
    /** Trims on top of each song's own mix, dB. */
    core: 0,
    pad: 0,
    bass: 0,
    chords: 0,
    arp: 0,
    lead: 0,
    /** Risers, impacts and downlifters between sections. */
    fx: -8,
    /** Short room, long hall and tempo delay, return levels. */
    room: -6,
    hall: -4,
    delay: -6,
  },
  groove: {
    /** How hard the track breathes against the kick (×, 1 = as each song sets it). */
    pump: 1,
    /** Delay throw on the lead's last note of a phrase, dB above its normal send. */
    throw: 9,
  },
  atmo: {
    /** Trims on each song's noise floor and vinyl crackle, dB, and extra tape saturation. */
    noise: 0,
    crackle: 0,
    tape: 0,
  },
  lift: {
    /** Meter gained per kill and per combo hit (1 = full). */
    perKill: 0.045,
    perCombo: 0.006,
    /** Damage multiplier while lifted. */
    damage: 1.35,
    /** Length of a Lift, bars. */
    bars: 8,
  },
  rewards: {
    /** Shuffle: swing added and damage bonus. */
    shuffleSwing: 0.12,
    shuffleDamage: 0.1,
    /** Saturation: damage bonus for Bass and Lead. */
    saturationDamage: 0.25,
    /** Wide mix: range bonus for every tower. */
    wideRange: 0.15,
    /** Tip jar: extra money per kill. */
    tipJar: 3,
    /** Sidechain boost multiplier added. */
    sidechainBoost: 0.5,
    /** Long tail: extra stun steps for Chords. */
    longTailStun: 1,
    /** Hot hands: crit chance added to Call & response. */
    hotHands: 0.2,
  },






  engage: {
    /** A tower starts playing on its next step (1) or next beat (4) after an enemy enters its range. */
    quantize: 1,
    /** After the last enemy leaves, keep playing to the end of this many bars (1 = end of the current bar). */
    holdBars: 1,
    /** Volume of towers with nobody in range ("in the distance"), dB. -60 = silent. */
    idle: -9,
    /** Low-pass on idle towers, Hz. */
    idleCutoff: 1500,
    /** How long a tower takes to open up when it starts fighting, beats. */
    openBeats: 1,
    /** How long a tower takes to settle back to idle, beats. */
    closeBeats: 2,
    /** Low-pass on a tower fighting one enemy, Hz. Opens fully as more enemies come. */
    calmCutoff: 4500,
    /** Enemies in range for full brightness and punch. */
    fullIntensity: 4,
  },
  core: {
    /** Leaks each core layer can take before it drops out (perks first, the foundation last). */
    hpPerDrum: 3,
    /** Perk prices by tier (each song gives its three perks a tier). */
    perk1Cost: 60,
    perk2Cost: 80,
    perk3Cost: 100,
    /** Low-pass on the resting core between waves, Hz. */
    restCutoff: 3200,
    /** Resting core volume, dB. */
    restVolume: -3,
  },
  fx: {
    /** Bars for a tower to fully recover from noise or muffling once enemies stop. */
    recoverBars: 2,
    /** Hard caps: bitcrush mix, noise level (dB), lowest muffle filter (Hz). */
    maxCrush: 0.55,
    maxNoise: -12,
    muffleFloor: 450,
    /** Muffler wobble depth, octaves. */
    wobble: 1.5,
  },
  combos: {
    /** Sidechain (bass next to chords): damage multiplier on the half beat after each kick. */
    sidechainBoost: 1.5,
    /** How hard the chords and bass pump with the kick, dB. */
    sidechainPump: -9,
    /** Call and response (lead next to arp): crit chance on lead hits, and crit damage. */
    callCrit: 0.3,
    callCritDamage: 2,
    /** Full band (bass, chords and arp touching): extra range, 0.2 = +20%. */
    fullBandRange: 0.2,
  },
  economy: {
    startMoney: 120,
    /** Share of the cost given back when a tower is removed. */
    refund: 0.5,
    /** Share of the cost to repair a wreck. */
    repair: 0.5,
  },
  waves: {
    /** Waves to survive to win (0 = endless). Each level sets its own. */
    toWin: 0,
    /** Drums-only bars before the first wave. */
    firstDelayBars: 4,
    /** A wave lasts this many bars... */
    lengthBars: 16,
    /** ...then this many drums-only bars before the next one. */
    breakdownBars: 4,
    /** Enemies in wave 1, and how many more each wave. */
    countBase: 6,
    countGrowth: 2,
    /** 16ths between spawns. */
    spawnGap: 8,
    /** Enemy HP compounds this much per wave (0.2 = each wave 20% tougher than the last). */
    hpGrowth: 0.22,
    /** Mufflers appear from this wave on, as this share of the wave. */
    mufflerFromWave: 2,
    mufflerShare: 0.35,
  },
  static: {
    hp: 30,
    /** Cells per beat. */
    speed: 1.0,
    bounty: 6,
    /** Core damage when it gets through. */
    leak: 1,
    /** Reach for attacking towers, cells. */
    reach: 1.2,
    /** 16ths between attacks (4 = every beat). */
    attackEvery: 8,
    /** Tower HP taken per attack. */
    damage: 2,
    /** Noise and crush added to the tower per attack, 0..1. */
    effect: 0.25,
  },
  muffler: {
    hp: 55,
    speed: 0.75,
    bounty: 9,
    leak: 1,
    reach: 1.4,
    attackEvery: 4,
    damage: 0,
    /** Muffling added to the tower per attack, 0..1. Also shrinks its range. */
    effect: 0.3,
  },
  /** First Groove: one tower, the core, towers waking up. */
  level1: {
    /** Waves to survive (0 = endless). */
    waves: 3,
    startMoney: 120,
    /** Enemy HP multiplier for this level. */
    hpScale: 0.25,
    countBase: 3,
    countGrowth: 1,
    firstDelayBars: 6,
    /** Mufflers from this wave (0 = none). */
    mufflerFromWave: 0,
  },
  /** Stabs: chords, stun, money. */
  level2: {
    /** Waves to survive (0 = endless). */
    waves: 4,
    startMoney: 140,
    /** Enemy HP multiplier for this level. */
    hpScale: 0.6,
    countBase: 5,
    countGrowth: 2,
    firstDelayBars: 4,
    /** Mufflers from this wave (0 = none). */
    mufflerFromWave: 0,
  },
  /** Hook Line: arp, lead, upgrades. */
  level3: {
    /** Waves to survive (0 = endless). */
    waves: 4,
    startMoney: 170,
    /** Enemy HP multiplier for this level. */
    hpScale: 0.85,
    countBase: 6,
    countGrowth: 2,
    firstDelayBars: 4,
    /** Mufflers from this wave (0 = none). */
    mufflerFromWave: 0,
  },
  /** Interference: enemies attack, wrecks, repair, perks. */
  level4: {
    /** Waves to survive (0 = endless). */
    waves: 5,
    startMoney: 190,
    /** Enemy HP multiplier for this level. */
    hpScale: 0.9,
    countBase: 6,
    countGrowth: 2,
    firstDelayBars: 4,
    /** Mufflers from this wave (0 = none). */
    mufflerFromWave: 2,
  },
  /** Chemistry: combos, rewards, Lift. */
  level5: {
    /** Waves to survive (0 = endless). */
    waves: 6,
    startMoney: 220,
    /** Enemy HP multiplier for this level. */
    hpScale: 1.4,
    countBase: 7,
    countGrowth: 3,
    firstDelayBars: 4,
    /** Mufflers from this wave (0 = none). */
    mufflerFromWave: 2,
  },
  /** Chapter 2, Last Stop. */
  nb1: {
    /** Waves to survive (0 = endless). */
    waves: 7,
    startMoney: 220,
    /** Enemy HP multiplier for this level. */
    hpScale: 1.5,
    countBase: 7,
    countGrowth: 3,
    firstDelayBars: 4,
    /** Mufflers from this wave (0 = none). */
    mufflerFromWave: 2,
  },
  /** Chapter 2, Night Bus. */
  nb2: {
    /** Waves to survive (0 = endless). */
    waves: 8,
    startMoney: 240,
    /** Enemy HP multiplier for this level. */
    hpScale: 1.7,
    countBase: 8,
    countGrowth: 3,
    firstDelayBars: 4,
    /** Mufflers from this wave (0 = none). */
    mufflerFromWave: 2,
  },
  /** Chapter 3, Riverbed. */
  sr1: {
    /** Waves to survive (0 = endless). */
    waves: 7,
    startMoney: 230,
    /** Enemy HP multiplier for this level. */
    hpScale: 2.0,
    countBase: 7,
    countGrowth: 3,
    firstDelayBars: 4,
    /** Mufflers from this wave (0 = none). */
    mufflerFromWave: 2,
  },
  /** Chapter 3, Delta. */
  sr2: {
    /** Waves to survive (0 = endless). */
    waves: 8,
    startMoney: 250,
    /** Enemy HP multiplier for this level. */
    hpScale: 1.96,
    countBase: 8,
    countGrowth: 3,
    firstDelayBars: 4,
    /** Mufflers from this wave (0 = none). */
    mufflerFromWave: 2,
  },
  /** Chapter 4, Undertow. */
  lt1: {
    /** Waves to survive (0 = endless). */
    waves: 8,
    startMoney: 240,
    /** Enemy HP multiplier for this level. */
    hpScale: 1.9,
    countBase: 8,
    countGrowth: 3,
    firstDelayBars: 4,
    /** Mufflers from this wave (0 = none). */
    mufflerFromWave: 2,
  },
  /** Chapter 4, Low Tide. */
  lt2: {
    /** Waves to survive (0 = endless). */
    waves: 9,
    startMoney: 260,
    /** Enemy HP multiplier for this level. */
    hpScale: 1.6,
    countBase: 9,
    countGrowth: 2,
    firstDelayBars: 4,
    /** Mufflers from this wave (0 = none). */
    mufflerFromWave: 2,
  },
  /** Club Night: everything, no end. */
  endless: {
    /** Waves to survive (0 = endless). */
    waves: 0,
    startMoney: 160,
    /** Enemy HP multiplier for this level. */
    hpScale: 1,
    countBase: 6,
    countGrowth: 2,
    firstDelayBars: 6,
    /** Mufflers from this wave (0 = none). */
    mufflerFromWave: 2,
  },
  bassTower: {
    /** Tower health. */
    hp: 120,
    cost: 40,
    damage: 2,
    /** Damage is per bar at this many hits: a busier part splits it over more notes (music density never changes balance). */
    refHits: 4,
    /** Radius in cells. */
    range: 1.6,
    /** Steps an enemy is frozen on a hit. */
    stun: 0,
    /** Speed taken away on a hit, 0..0.9. */
    slow: 0.35,
    /** Steps the slow lasts. */
    slowSteps: 8,
    /** Range taken away at full muffling, 0..0.9. */
    muffleShrink: 0.2,
    /** Upgrade price, damage multiplier and extra range (cells). */
    upgradeCost: 50,
    upgradeDamage: 1.4,
    upgradeRange: 0.3,
  },
  chordsTower: {
    /** Tower health. */
    hp: 120,
    cost: 60,
    damage: 7,
    /** Damage is per bar at this many hits: a busier part splits it over more notes (music density never changes balance). */
    refHits: 3,
    range: 1.7,
    stun: 1,
    slow: 0,
    slowSteps: 0,
    muffleShrink: 0.2,
    /** Upgrade price, damage multiplier and extra range (cells). */
    upgradeCost: 70,
    upgradeDamage: 1.5,
    upgradeRange: 0.3,
  },
  arpTower: {
    /** Tower health. */
    hp: 90,
    cost: 50,
    damage: 3,
    /** Damage is per bar at this many hits: a busier part splits it over more notes (music density never changes balance). */
    refHits: 8,
    range: 3.2,
    stun: 0,
    slow: 0,
    slowSteps: 0,
    muffleShrink: 0.2,
    /** Upgrade price, damage multiplier and extra range (cells). */
    upgradeCost: 60,
    upgradeDamage: 1.3,
    upgradeRange: 0.4,
  },
  leadTower: {
    /** Tower health. */
    hp: 140,
    cost: 70,
    damage: 22,
    /** Damage is per bar at this many hits: a busier part splits it over more notes (music density never changes balance). */
    refHits: 3,
    range: 1.6,
    stun: 0,
    slow: 0,
    slowSteps: 0,
    muffleShrink: 0.2,
    /** Upgrade price, damage multiplier and extra range (cells). */
    upgradeCost: 80,
    upgradeDamage: 1.6,
    upgradeRange: 0.2,
  },
};

export type Tuning = typeof DEFAULT_TUNING;
export type TuningSection = keyof Tuning;
export type TuningPath = {
  [S in TuningSection]: `${S}.${keyof Tuning[S] & string}`;
}[TuningSection];

export interface TuningField {
  path: TuningPath;
  label: string;
  min: number;
  max: number;
  step: number;
  unit?: string;
  group: string;
  /** Collapsed by default in the panel. */
  advanced?: boolean;
  /** Discrete choices instead of a slider. */
  options?: { value: number; label: string }[];
}

export const TUNING_FIELDS: readonly TuningField[] = [
  { path: 'transport.tempo', label: 'Tempo offset', min: -20, max: 20, step: 1, unit: 'BPM', group: 'Groove' },
  { path: 'transport.swing', label: 'Extra swing', min: 0, max: 1, step: 0.01, unit: '%', group: 'Groove' },
  {
    path: 'transport.swingGrid',
    label: 'Swing on',
    min: 8,
    max: 16,
    step: 8,
    group: 'Groove',
    options: [
      { value: 16, label: '16ths' },
      { value: 8, label: '8ths' },
    ],
  },
  { path: 'groove.pump', label: 'Breathing pump', min: 0, max: 2, step: 0.05, unit: '×', group: 'Groove' },
  { path: 'groove.throw', label: 'Delay throw', min: 0, max: 20, step: 0.5, unit: 'dB', group: 'Groove' },

  { path: 'mix.master', label: 'Master', min: -40, max: 6, step: 0.5, unit: 'dB', group: 'Volume' },
  { path: 'mix.core', label: 'Core (drums)', min: -20, max: 12, step: 0.5, unit: 'dB', group: 'Volume' },
  { path: 'mix.pad', label: 'Pad', min: -20, max: 12, step: 0.5, unit: 'dB', group: 'Volume' },
  { path: 'mix.bass', label: 'Bass', min: -20, max: 12, step: 0.5, unit: 'dB', group: 'Volume' },
  { path: 'mix.chords', label: 'Chords', min: -20, max: 12, step: 0.5, unit: 'dB', group: 'Volume' },
  { path: 'mix.arp', label: 'Arp', min: -20, max: 12, step: 0.5, unit: 'dB', group: 'Volume' },
  { path: 'mix.lead', label: 'Lead', min: -20, max: 12, step: 0.5, unit: 'dB', group: 'Volume' },
  { path: 'mix.fx', label: 'Risers & impacts', min: -40, max: 6, step: 0.5, unit: 'dB', group: 'Volume' },
  { path: 'mix.room', label: 'Room reverb', min: -40, max: 6, step: 0.5, unit: 'dB', group: 'Volume' },
  { path: 'mix.hall', label: 'Hall reverb', min: -40, max: 6, step: 0.5, unit: 'dB', group: 'Volume' },
  { path: 'mix.delay', label: 'Delay', min: -40, max: 6, step: 0.5, unit: 'dB', group: 'Volume' },

  { path: 'engage.quantize', label: 'Comes in on', min: 1, max: 4, step: 3, group: 'Towers play', options: [{ value: 1, label: 'next 16th' }, { value: 4, label: 'next beat' }] },
  { path: 'engage.holdBars', label: 'Hold (bars)', min: 1, max: 4, step: 1, group: 'Towers play' },
  { path: 'engage.idle', label: 'Idle volume', min: -60, max: 0, step: 1, unit: 'dB', group: 'Towers play' },
  { path: 'engage.idleCutoff', label: 'Idle filter', min: 150, max: 20000, step: 50, unit: 'Hz', group: 'Towers play' },
  { path: 'engage.openBeats', label: 'Fade in', min: 0, max: 4, step: 0.25, unit: 'beats', group: 'Towers play' },
  { path: 'engage.closeBeats', label: 'Settle time', min: 0.25, max: 8, step: 0.25, unit: 'beats', group: 'Towers play' },
  { path: 'engage.calmCutoff', label: 'Filter, 1 enemy', min: 500, max: 20000, step: 50, unit: 'Hz', group: 'Towers play' },
  { path: 'engage.fullIntensity', label: 'Full open at', min: 1, max: 12, step: 1, unit: 'enemies', group: 'Towers play' },

  { path: 'core.hpPerDrum', label: 'Leaks per drum', min: 1, max: 20, step: 1, group: 'Core' },
  { path: 'core.perk1Cost', label: 'Perk price, tier 1', min: 0, max: 500, step: 5, group: 'Core' },
  { path: 'core.perk2Cost', label: 'Perk price, tier 2', min: 0, max: 500, step: 5, group: 'Core' },
  { path: 'core.perk3Cost', label: 'Perk price, tier 3', min: 0, max: 500, step: 5, group: 'Core' },
  { path: 'core.restCutoff', label: 'Resting filter', min: 150, max: 20000, step: 50, unit: 'Hz', group: 'Core' },
  { path: 'core.restVolume', label: 'Resting volume', min: -30, max: 0, step: 0.5, unit: 'dB', group: 'Core' },

  { path: 'atmo.noise', label: 'Noise floor trim', min: -30, max: 20, step: 1, unit: 'dB', group: 'Atmosphere' },
  { path: 'atmo.crackle', label: 'Vinyl crackle trim', min: -30, max: 20, step: 1, unit: 'dB', group: 'Atmosphere' },
  { path: 'atmo.tape', label: 'Extra tape', min: -1, max: 1, step: 0.01, group: 'Atmosphere' },

  { path: 'lift.perKill', label: 'Lift per kill', min: 0, max: 0.3, step: 0.005, group: 'Lift' },
  { path: 'lift.perCombo', label: 'Lift per combo hit', min: 0, max: 0.1, step: 0.001, group: 'Lift' },
  { path: 'lift.damage', label: 'Lift damage', min: 1, max: 3, step: 0.05, unit: '×', group: 'Lift' },
  { path: 'lift.bars', label: 'Lift length', min: 2, max: 16, step: 1, unit: 'bars', group: 'Lift' },

  { path: 'combos.sidechainBoost', label: 'Sidechain dmg', min: 1, max: 4, step: 0.05, unit: '×', group: 'Combos' },
  { path: 'combos.sidechainPump', label: 'Sidechain pump', min: -30, max: 0, step: 0.5, unit: 'dB', group: 'Combos' },
  { path: 'combos.callCrit', label: 'Call crit chance', min: 0, max: 1, step: 0.05, unit: '%', group: 'Combos' },
  { path: 'combos.callCritDamage', label: 'Call crit dmg', min: 1, max: 5, step: 0.1, unit: '×', group: 'Combos' },
  { path: 'combos.fullBandRange', label: 'Full band range', min: 0, max: 1, step: 0.05, unit: '%', group: 'Combos' },

  { path: 'fx.recoverBars', label: 'Recover time', min: 0.25, max: 16, step: 0.25, unit: 'bars', group: 'Enemy effects' },
  { path: 'fx.maxCrush', label: 'Max crush', min: 0, max: 1, step: 0.05, unit: '%', group: 'Enemy effects' },
  { path: 'fx.maxNoise', label: 'Max noise', min: -40, max: 0, step: 0.5, unit: 'dB', group: 'Enemy effects' },
  { path: 'fx.muffleFloor', label: 'Muffle floor', min: 100, max: 4000, step: 25, unit: 'Hz', group: 'Enemy effects' },
  { path: 'fx.wobble', label: 'Muffle wobble', min: 0, max: 4, step: 0.1, unit: 'oct', group: 'Enemy effects' },

  { path: 'waves.firstDelayBars', label: 'First wave after', min: 0, max: 16, step: 1, unit: 'bars', group: 'Waves' },
  { path: 'waves.lengthBars', label: 'Wave length', min: 4, max: 32, step: 1, unit: 'bars', group: 'Waves' },
  { path: 'waves.breakdownBars', label: 'Breakdown', min: 0, max: 16, step: 1, unit: 'bars', group: 'Waves' },
  { path: 'waves.countBase', label: 'Enemies, wave 1', min: 1, max: 40, step: 1, group: 'Waves' },
  { path: 'waves.countGrowth', label: '+ per wave', min: 0, max: 10, step: 1, group: 'Waves' },
  { path: 'waves.spawnGap', label: 'Spawn gap', min: 1, max: 32, step: 1, unit: '16ths', group: 'Waves' },
  { path: 'waves.hpGrowth', label: 'HP growth', min: 0, max: 1, step: 0.01, unit: '%', group: 'Waves' },
  { path: 'waves.mufflerFromWave', label: 'Mufflers from', min: 1, max: 20, step: 1, unit: 'wave', group: 'Waves' },
  { path: 'waves.mufflerShare', label: 'Muffler share', min: 0, max: 1, step: 0.05, unit: '%', group: 'Waves' },

  { path: 'economy.startMoney', label: 'Start money', min: 0, max: 1000, step: 10, group: 'Money' },
  { path: 'economy.refund', label: 'Refund on remove', min: 0, max: 1, step: 0.05, unit: '%', group: 'Money' },
  { path: 'economy.repair', label: 'Repair price', min: 0, max: 1, step: 0.05, unit: '%', group: 'Money' },

  ...levelFields('level1', 'Level 1 · First Groove'),
  ...levelFields('level2', 'Level 2 · Stabs'),
  ...levelFields('level3', 'Level 3 · Hook Line'),
  ...levelFields('level4', 'Level 4 · Interference'),
  ...levelFields('level5', 'Level 5 · Chemistry'),
  ...levelFields('nb1', 'Ch 2 · Last Stop'),
  ...levelFields('nb2', 'Ch 2 · Night Bus'),
  ...levelFields('sr1', 'Ch 3 · Riverbed'),
  ...levelFields('sr2', 'Ch 3 · Delta'),
  ...levelFields('lt1', 'Ch 4 · Undertow'),
  ...levelFields('lt2', 'Ch 4 · Low Tide'),
  ...levelFields('endless', 'Endless · Club Night'),
  ...rewardFields(),

  ...towerFields('bassTower', 'Bass tower'),
  ...towerFields('chordsTower', 'Chords tower'),
  ...towerFields('arpTower', 'Arp tower'),
  ...towerFields('leadTower', 'Lead tower'),

  ...enemyFields('static', 'Static'),
  ...enemyFields('muffler', 'Muffler'),
];

function towerFields(section: 'bassTower' | 'chordsTower' | 'arpTower' | 'leadTower', group: string): TuningField[] {
  return [
    { path: `${section}.hp`, label: 'Health', min: 1, max: 500, step: 1, group, advanced: true },
    { path: `${section}.cost`, label: 'Cost', min: 0, max: 500, step: 5, group, advanced: true },
    { path: `${section}.damage`, label: 'Damage', min: 0, max: 100, step: 0.5, group, advanced: true },
    { path: `${section}.refHits`, label: 'Damage per … hits', min: 1, max: 16, step: 1, unit: '/bar', group, advanced: true },
    { path: `${section}.range`, label: 'Range', min: 0.5, max: 8, step: 0.1, unit: 'cells', group, advanced: true },
    { path: `${section}.stun`, label: 'Stun', min: 0, max: 16, step: 1, unit: '16ths', group, advanced: true },
    { path: `${section}.slow`, label: 'Slow', min: 0, max: 0.9, step: 0.05, unit: '%', group, advanced: true },
    { path: `${section}.slowSteps`, label: 'Slow length', min: 0, max: 32, step: 1, unit: '16ths', group, advanced: true },
    { path: `${section}.muffleShrink`, label: 'Range lost muffled', min: 0, max: 0.9, step: 0.05, unit: '%', group, advanced: true },
    { path: `${section}.upgradeCost`, label: 'Upgrade price', min: 0, max: 500, step: 5, group, advanced: true },
    { path: `${section}.upgradeDamage`, label: 'Upgrade dmg', min: 1, max: 4, step: 0.05, unit: '×', group, advanced: true },
    { path: `${section}.upgradeRange`, label: 'Upgrade range', min: 0, max: 3, step: 0.1, unit: 'cells', group, advanced: true },
  ];
}

function enemyFields(section: 'static' | 'muffler', group: string): TuningField[] {
  return [
    { path: `${section}.hp`, label: 'HP', min: 1, max: 500, step: 1, group, advanced: true },
    { path: `${section}.speed`, label: 'Speed', min: 0.1, max: 3, step: 0.05, unit: 'cells/beat', group, advanced: true },
    { path: `${section}.bounty`, label: 'Bounty', min: 0, max: 100, step: 1, group, advanced: true },
    { path: `${section}.leak`, label: 'Core damage', min: 0, max: 9, step: 1, group, advanced: true },
    { path: `${section}.reach`, label: 'Attack reach', min: 0, max: 5, step: 0.1, unit: 'cells', group, advanced: true },
    { path: `${section}.attackEvery`, label: 'Attacks every', min: 1, max: 16, step: 1, unit: '16ths', group, advanced: true },
    { path: `${section}.damage`, label: 'Tower damage', min: 0, max: 100, step: 1, group, advanced: true },
    { path: `${section}.effect`, label: 'Sound effect', min: 0, max: 1, step: 0.05, group, advanced: true },
  ];
}

type LevelSection = 'level1' | 'level2' | 'level3' | 'level4' | 'level5' | 'nb1' | 'nb2' | 'sr1' | 'sr2' | 'lt1' | 'lt2' | 'endless';

function levelFields(section: LevelSection, group: string): TuningField[] {
  return [
    { path: `${section}.waves`, label: 'Waves to win', min: 0, max: 30, step: 1, group, advanced: true },
    { path: `${section}.startMoney`, label: 'Start money', min: 0, max: 1000, step: 10, group, advanced: true },
    { path: `${section}.hpScale`, label: 'Enemy HP ×', min: 0.1, max: 3, step: 0.05, group, advanced: true },
    { path: `${section}.countBase`, label: 'Enemies, wave 1', min: 1, max: 40, step: 1, group, advanced: true },
    { path: `${section}.countGrowth`, label: '+ per wave', min: 0, max: 10, step: 1, group, advanced: true },
    { path: `${section}.firstDelayBars`, label: 'First wave after', min: 0, max: 16, step: 1, unit: 'bars', group, advanced: true },
    { path: `${section}.mufflerFromWave`, label: 'Mufflers from', min: 0, max: 20, step: 1, unit: 'wave', group, advanced: true },
  ];
}

function rewardFields(): TuningField[] {
  const group = 'Rewards';
  return [
    { path: 'rewards.shuffleSwing', label: 'Shuffle swing', min: 0, max: 0.5, step: 0.01, group, advanced: true },
    { path: 'rewards.shuffleDamage', label: 'Shuffle damage', min: 0, max: 1, step: 0.01, unit: '%', group, advanced: true },
    { path: 'rewards.saturationDamage', label: 'Saturation dmg', min: 0, max: 1, step: 0.01, unit: '%', group, advanced: true },
    { path: 'rewards.wideRange', label: 'Wide mix range', min: 0, max: 1, step: 0.01, unit: '%', group, advanced: true },
    { path: 'rewards.tipJar', label: 'Tip jar', min: 0, max: 20, step: 1, group, advanced: true },
    { path: 'rewards.sidechainBoost', label: 'Sidechain+', min: 0, max: 2, step: 0.05, group, advanced: true },
    { path: 'rewards.longTailStun', label: 'Long tail stun', min: 0, max: 8, step: 1, unit: '16ths', group, advanced: true },
    { path: 'rewards.hotHands', label: 'Hot hands crit', min: 0, max: 1, step: 0.05, unit: '%', group, advanced: true },
  ];
}
