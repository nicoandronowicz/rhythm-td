/**
 * Every tunable number in the game lives here.
 *
 * The tuning panel (T key) edits these live. Defaults below are what ships;
 * panel edits are saved in the browser and can be copied as JSON.
 */

export const DEFAULT_TUNING = {
  transport: {
    bpm: 124,
    /** 0 = straight, 1 = hard shuffle. */
    swing: 0,
    /** Which notes swing: 16 = every second 16th, 8 = every second 8th. */
    swingGrid: 16,
  },
  mix: {
    master: -7,
    kick: -3,
    clap: 2,
    hats: -7,
    bass: -5,
    chords: -3,
    arp: -7,
    lead: -2,
    shaker: -11.5,
    rim: 0,
    openhat: -11,
    /** Shared short room reverb, return level. */
    room: -10,
    /** Shared dotted-8th delay, return level. */
    delay: -12,
  },
  sends: {
    /** Per-instrument send levels into the shared room and delay, dB (-60 = off). */
    clapRoom: -8,
    chordsRoom: -6,
    chordsDelay: -60,
    arpRoom: -14,
    arpDelay: -8,
    leadRoom: -12,
    leadDelay: -10,
    /** Delay feedback, 0..0.9. */
    delayFeedback: 0.32,
  },
  velocity: {
    normal: 0.82,
    accent: 1,
    ghost: 0.35,
    /** Random velocity wobble on hats, 0..1. Keeps them from sounding like a machine gun. */
    hatJitter: 0.12,
  },
  kick: {
    /** How far above the tuned note the pitch sweep starts, in octaves. */
    sweep: 2.8,
    /** Pitch sweep time, seconds. */
    sweepTime: 0.055,
    /** Body length, seconds. */
    decay: 0.4,
    /** Saturation, 0..1. Adds harmonics so the kick reads on laptop speakers. */
    drive: 0.6,
    /** Click transient level, dB. */
    click: -12,
  },
  clap: {
    /** Band-pass centre, Hz. */
    tone: 1250,
    /** Gap between the 3 hand hits, seconds. */
    spread: 0.009,
    /** Tail length, seconds. */
    tail: 0.2,
  },
  hats: {
    /** High-pass cutoff, Hz. */
    tone: 7200,
    /** Length, seconds. */
    decay: 0.09,
    /** Metallic ring layered under the noise, dB relative. */
    metal: -14,
    /** Stereo position, -1 left .. 1 right. */
    pan: 0.18,
  },
  bass: {
    /** Filter floor, Hz. */
    cutoff: 450,
    /** Filter envelope amount, octaves above the floor. */
    envelope: 2,
    /** Filter resonance. */
    resonance: 3,
    /** Filter envelope decay, seconds. */
    pluck: 0.16,
    /** Note length, in 16ths. */
    length: 1.6,
    /** Saturation on the mid layer, 0..1. */
    drive: 0.7,
    /** Mid layer (octave up, what laptops hear), dB. */
    mid: 2,
    /** Low cut on the mid layer, Hz. Higher = leaner mid layer, more room for the sub. */
    midLowCut: 160,
    /** Sub sine on the root, dB. */
    sub: -3,
  },
  shaker: {
    /** Band centre, Hz. */
    tone: 8000,
    /** Length, seconds. */
    decay: 0.04,
  },
  rim: {
    /** Length, seconds. */
    decay: 0.06,
  },
  openhat: {
    /** Length, seconds. */
    decay: 0.3,
  },
  chords: {
    /** Filter opening at the start of the stab, Hz. */
    tone: 3200,
    /** Where the filter settles, Hz. */
    body: 900,
    /** Stab length, seconds. */
    decay: 0.24,
    /** Detune between the two saws, cents. */
    detune: 9,
    /** Organ (sine) layer under the saws, dB. */
    organ: -6,
  },
  arp: {
    /** Filter opening, Hz. */
    tone: 4200,
    /** Note length, seconds. */
    decay: 0.11,
    /** Filter resonance. */
    resonance: 4,
  },
  lead: {
    /** Filter opening, Hz. */
    tone: 3600,
    /** Note length, seconds. */
    decay: 0.32,
    /** Detune between the two saws, cents. */
    detune: 12,
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
    /** Leaks each drum can take before it drops out (perks, then hats, then clap, then kick). */
    hpPerDrum: 3,
    /** Perk prices. */
    shakerCost: 60,
    rimCost: 80,
    openhatCost: 100,
    /** Low-pass on the resting core between waves, Hz. */
    restCutoff: 900,
    /** Resting core volume, dB. */
    restVolume: -6,
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
  bassTower: {
    /** Tower health. */
    hp: 120,
    cost: 40,
    damage: 2,
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
  { path: 'transport.bpm', label: 'BPM', min: 90, max: 150, step: 1, group: 'Groove' },
  { path: 'transport.swing', label: 'Swing', min: 0, max: 1, step: 0.01, unit: '%', group: 'Groove' },
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

  { path: 'mix.master', label: 'Master', min: -40, max: 6, step: 0.5, unit: 'dB', group: 'Volume' },
  { path: 'mix.kick', label: 'Kick', min: -40, max: 6, step: 0.5, unit: 'dB', group: 'Volume' },
  { path: 'mix.clap', label: 'Clap', min: -40, max: 6, step: 0.5, unit: 'dB', group: 'Volume' },
  { path: 'mix.hats', label: 'Hats', min: -40, max: 6, step: 0.5, unit: 'dB', group: 'Volume' },
  { path: 'mix.bass', label: 'Bass', min: -40, max: 6, step: 0.5, unit: 'dB', group: 'Volume' },
  { path: 'mix.chords', label: 'Chords', min: -40, max: 6, step: 0.5, unit: 'dB', group: 'Volume' },
  { path: 'mix.arp', label: 'Arp', min: -40, max: 6, step: 0.5, unit: 'dB', group: 'Volume' },
  { path: 'mix.lead', label: 'Lead', min: -40, max: 6, step: 0.5, unit: 'dB', group: 'Volume' },
  { path: 'mix.shaker', label: 'Shaker', min: -40, max: 6, step: 0.5, unit: 'dB', group: 'Volume' },
  { path: 'mix.rim', label: 'Rim', min: -40, max: 6, step: 0.5, unit: 'dB', group: 'Volume' },
  { path: 'mix.openhat', label: 'Open hat', min: -40, max: 6, step: 0.5, unit: 'dB', group: 'Volume' },
  { path: 'mix.room', label: 'Room reverb', min: -40, max: 0, step: 0.5, unit: 'dB', group: 'Volume' },
  { path: 'mix.delay', label: 'Delay', min: -40, max: 0, step: 0.5, unit: 'dB', group: 'Volume' },

  { path: 'engage.quantize', label: 'Comes in on', min: 1, max: 4, step: 3, group: 'Towers play', options: [{ value: 1, label: 'next 16th' }, { value: 4, label: 'next beat' }] },
  { path: 'engage.holdBars', label: 'Hold (bars)', min: 1, max: 4, step: 1, group: 'Towers play' },
  { path: 'engage.idle', label: 'Idle volume', min: -60, max: 0, step: 1, unit: 'dB', group: 'Towers play' },
  { path: 'engage.idleCutoff', label: 'Idle filter', min: 150, max: 20000, step: 50, unit: 'Hz', group: 'Towers play' },
  { path: 'engage.openBeats', label: 'Fade in', min: 0, max: 4, step: 0.25, unit: 'beats', group: 'Towers play' },
  { path: 'engage.closeBeats', label: 'Settle time', min: 0.25, max: 8, step: 0.25, unit: 'beats', group: 'Towers play' },
  { path: 'engage.calmCutoff', label: 'Filter, 1 enemy', min: 500, max: 20000, step: 50, unit: 'Hz', group: 'Towers play' },
  { path: 'engage.fullIntensity', label: 'Full open at', min: 1, max: 12, step: 1, unit: 'enemies', group: 'Towers play' },

  { path: 'core.hpPerDrum', label: 'Leaks per drum', min: 1, max: 20, step: 1, group: 'Core' },
  { path: 'core.shakerCost', label: 'Shaker price', min: 0, max: 500, step: 5, group: 'Core' },
  { path: 'core.rimCost', label: 'Rim price', min: 0, max: 500, step: 5, group: 'Core' },
  { path: 'core.openhatCost', label: 'Open hat price', min: 0, max: 500, step: 5, group: 'Core' },
  { path: 'core.restCutoff', label: 'Resting filter', min: 150, max: 20000, step: 50, unit: 'Hz', group: 'Core' },
  { path: 'core.restVolume', label: 'Resting volume', min: -30, max: 0, step: 0.5, unit: 'dB', group: 'Core' },

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

  ...towerFields('bassTower', 'Bass tower'),
  ...towerFields('chordsTower', 'Chords tower'),
  ...towerFields('arpTower', 'Arp tower'),
  ...towerFields('leadTower', 'Lead tower'),

  ...enemyFields('static', 'Static'),
  ...enemyFields('muffler', 'Muffler'),


  { path: 'velocity.normal', label: 'Normal hit', min: 0, max: 1, step: 0.01, group: 'Dynamics', advanced: true },
  { path: 'velocity.accent', label: 'Accent hit', min: 0, max: 1, step: 0.01, group: 'Dynamics', advanced: true },
  { path: 'velocity.ghost', label: 'Ghost hit', min: 0, max: 1, step: 0.01, group: 'Dynamics', advanced: true },
  { path: 'velocity.hatJitter', label: 'Hat wobble', min: 0, max: 0.5, step: 0.01, group: 'Dynamics', advanced: true },

  { path: 'kick.sweep', label: 'Pitch sweep', min: 0.5, max: 5, step: 0.1, unit: 'oct', group: 'Kick', advanced: true },
  { path: 'kick.sweepTime', label: 'Sweep time', min: 0.005, max: 0.15, step: 0.001, unit: 's', group: 'Kick', advanced: true },
  { path: 'kick.decay', label: 'Decay', min: 0.1, max: 1.2, step: 0.01, unit: 's', group: 'Kick', advanced: true },
  { path: 'kick.drive', label: 'Drive', min: 0, max: 1, step: 0.01, group: 'Kick', advanced: true },
  { path: 'kick.click', label: 'Click', min: -40, max: 0, step: 0.5, unit: 'dB', group: 'Kick', advanced: true },

  { path: 'clap.tone', label: 'Tone', min: 500, max: 3000, step: 10, unit: 'Hz', group: 'Clap', advanced: true },
  { path: 'clap.spread', label: 'Spread', min: 0.003, max: 0.025, step: 0.001, unit: 's', group: 'Clap', advanced: true },
  { path: 'clap.tail', label: 'Tail', min: 0.05, max: 0.5, step: 0.01, unit: 's', group: 'Clap', advanced: true },

  { path: 'hats.tone', label: 'Tone', min: 3000, max: 12000, step: 50, unit: 'Hz', group: 'Hats', advanced: true },
  { path: 'hats.decay', label: 'Decay', min: 0.02, max: 0.4, step: 0.005, unit: 's', group: 'Hats', advanced: true },
  { path: 'hats.metal', label: 'Metal', min: -40, max: 0, step: 0.5, unit: 'dB', group: 'Hats', advanced: true },
  { path: 'hats.pan', label: 'Pan', min: -1, max: 1, step: 0.01, group: 'Hats', advanced: true },

  { path: 'bass.cutoff', label: 'Cutoff', min: 60, max: 1000, step: 5, unit: 'Hz', group: 'Bass', advanced: true },
  { path: 'bass.envelope', label: 'Env amount', min: 0, max: 6, step: 0.1, unit: 'oct', group: 'Bass', advanced: true },
  { path: 'bass.resonance', label: 'Resonance', min: 0.5, max: 12, step: 0.1, group: 'Bass', advanced: true },
  { path: 'bass.pluck', label: 'Pluck', min: 0.03, max: 0.6, step: 0.01, unit: 's', group: 'Bass', advanced: true },
  { path: 'bass.length', label: 'Length', min: 0.5, max: 4, step: 0.1, unit: '16ths', group: 'Bass', advanced: true },
  { path: 'bass.drive', label: 'Drive', min: 0, max: 1, step: 0.01, group: 'Bass', advanced: true },
  { path: 'bass.midLowCut', label: 'Mid low cut', min: 40, max: 400, step: 5, unit: 'Hz', group: 'Bass', advanced: true },
  { path: 'bass.mid', label: 'Mid layer', min: -40, max: 6, step: 0.5, unit: 'dB', group: 'Bass', advanced: true },
  { path: 'bass.sub', label: 'Sub', min: -40, max: 6, step: 0.5, unit: 'dB', group: 'Bass', advanced: true },

  { path: 'shaker.tone', label: 'Tone', min: 3000, max: 14000, step: 100, unit: 'Hz', group: 'Shaker', advanced: true },
  { path: 'shaker.decay', label: 'Decay', min: 0.01, max: 0.2, step: 0.005, unit: 's', group: 'Shaker', advanced: true },
  { path: 'rim.decay', label: 'Decay', min: 0.01, max: 0.3, step: 0.005, unit: 's', group: 'Rim', advanced: true },
  { path: 'openhat.decay', label: 'Decay', min: 0.05, max: 1, step: 0.01, unit: 's', group: 'Open hat', advanced: true },
  { path: 'chords.tone', label: 'Tone', min: 500, max: 9000, step: 50, unit: 'Hz', group: 'Chords', advanced: true },
  { path: 'chords.body', label: 'Body', min: 200, max: 4000, step: 25, unit: 'Hz', group: 'Chords', advanced: true },
  { path: 'chords.decay', label: 'Decay', min: 0.05, max: 1.2, step: 0.01, unit: 's', group: 'Chords', advanced: true },
  { path: 'chords.detune', label: 'Detune', min: 0, max: 40, step: 1, unit: 'ct', group: 'Chords', advanced: true },
  { path: 'chords.organ', label: 'Organ layer', min: -40, max: 6, step: 0.5, unit: 'dB', group: 'Chords', advanced: true },

  { path: 'arp.tone', label: 'Tone', min: 500, max: 12000, step: 50, unit: 'Hz', group: 'Arp', advanced: true },
  { path: 'arp.decay', label: 'Decay', min: 0.03, max: 0.6, step: 0.01, unit: 's', group: 'Arp', advanced: true },
  { path: 'arp.resonance', label: 'Resonance', min: 0.5, max: 15, step: 0.1, group: 'Arp', advanced: true },

  { path: 'lead.tone', label: 'Tone', min: 500, max: 12000, step: 50, unit: 'Hz', group: 'Lead', advanced: true },
  { path: 'lead.decay', label: 'Decay', min: 0.05, max: 1.5, step: 0.01, unit: 's', group: 'Lead', advanced: true },
  { path: 'lead.detune', label: 'Detune', min: 0, max: 40, step: 1, unit: 'ct', group: 'Lead', advanced: true },

  { path: 'sends.clapRoom', label: 'Clap → room', min: -60, max: 0, step: 0.5, unit: 'dB', group: 'Sends', advanced: true },
  { path: 'sends.chordsRoom', label: 'Chords → room', min: -60, max: 0, step: 0.5, unit: 'dB', group: 'Sends', advanced: true },
  { path: 'sends.chordsDelay', label: 'Chords → delay', min: -60, max: 0, step: 0.5, unit: 'dB', group: 'Sends', advanced: true },
  { path: 'sends.arpRoom', label: 'Arp → room', min: -60, max: 0, step: 0.5, unit: 'dB', group: 'Sends', advanced: true },
  { path: 'sends.arpDelay', label: 'Arp → delay', min: -60, max: 0, step: 0.5, unit: 'dB', group: 'Sends', advanced: true },
  { path: 'sends.leadRoom', label: 'Lead → room', min: -60, max: 0, step: 0.5, unit: 'dB', group: 'Sends', advanced: true },
  { path: 'sends.leadDelay', label: 'Lead → delay', min: -60, max: 0, step: 0.5, unit: 'dB', group: 'Sends', advanced: true },
  { path: 'sends.delayFeedback', label: 'Delay feedback', min: 0, max: 0.9, step: 0.01, group: 'Sends', advanced: true },
];

function towerFields(section: 'bassTower' | 'chordsTower' | 'arpTower' | 'leadTower', group: string): TuningField[] {
  return [
    { path: `${section}.hp`, label: 'Health', min: 1, max: 500, step: 1, group, advanced: true },
    { path: `${section}.cost`, label: 'Cost', min: 0, max: 500, step: 5, group, advanced: true },
    { path: `${section}.damage`, label: 'Damage', min: 0, max: 100, step: 0.5, group, advanced: true },
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
