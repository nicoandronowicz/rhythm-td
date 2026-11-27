/**
 * DOM screens over the game: title, level select, pause, end of run, the training coach and the
 * reward tray. Pure presentation; the app controller decides what to show.
 */

import { CHAPTERS, type LevelDef, type LevelId } from '../game/levels';
import { SONGS } from '../music/songs';
import { rewardById, type RewardId } from '../game/rewards';
import { TOWER_DEFS } from '../game/towers';

const root = () => document.getElementById('screens')!;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

function button(label: string, onClick: () => void, primary = false): HTMLButtonElement {
  const b = el('button', primary ? 'btn primary' : 'btn', label);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
}

const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

/** Swap the current screen for a new one (or none). `instant` skips the fade (keyboard-driven pause). */
function show(screen: HTMLElement | null, instant = false): void {
  const r = root();
  for (const old of Array.from(r.children) as HTMLElement[]) {
    if (instant) {
      old.remove();
      continue;
    }
    old.setAttribute('data-leaving', '');
    window.setTimeout(() => old.remove(), 260);
  }
  if (screen) r.append(screen);
}

export function hideScreens(instant = false): void {
  show(null, instant);
}

export function showTitle(onPlay: () => void): void {
  const s = el('div', 'screen');
  const inner = el('div', 'screen-inner');
  const title = el('h1', 'title');
  title.append('Rhythm', el('span', 'beat', 'TD'));
  const play = button('Play', onPlay, true);
  inner.append(
    title,
    el('p', 'subtitle', 'The defense is the track.'),
    play,
    el('p', 'fineprint', 'Sound on. Headphones or laptop speakers both work.'),
  );
  s.append(inner);
  show(s);
  play.focus();
}

/** Between the click and the first beat while a song's samples load. Usually a blink. */
export function showLoading(title: string, style: string): void {
  const s = el('div', 'screen');
  const inner = el('div', 'screen-inner');
  inner.append(el('h2', '', title), el('p', 'subtitle', style), el('p', 'fineprint', 'Loading the track…'));
  s.append(inner);
  show(s);
}

export function showLevels(levels: readonly LevelDef[], completed: ReadonlySet<LevelId>, onPick: (id: LevelId) => void): void {
  const s = el('div', 'screen tall');
  const inner = el('div', 'screen-inner');
  inner.append(el('h2', '', 'Pick a track'), el('p', 'subtitle', 'Four chapters, four songs. Chapter 1 teaches one idea per level. Club Night has no end.'));
  let index = 0;
  const card = (level: LevelDef) => {
    const c = el('button', level.id === 'endless' ? 'level-card endless' : 'level-card');
    c.type = 'button';
    // A short stagger that tapers off, so a long list never feels slow.
    c.style.animationDelay = `${Math.min(150, Math.round(55 * Math.log2(index++ + 1)))}ms`;
    c.append(
      el('span', 'num', level.id === 'endless' ? 'ENDLESS' : `LEVEL ${level.number}`),
      el('span', 'name', level.name),
      el('span', 'teaches', level.teaches),
    );
    const meta = el('span', 'meta');
    for (const t of level.towers) {
      const dot = el('span', 'dot');
      dot.style.background = hex(TOWER_DEFS[t].color);
      dot.title = TOWER_DEFS[t].name;
      meta.append(dot);
    }
    meta.append(level.towers.map((t) => TOWER_DEFS[t].name).join(' · '));
    c.append(meta);
    if (completed.has(level.id)) c.append(el('span', 'done', '✓ CLEARED'));
    c.addEventListener('click', () => onPick(level.id));
    return c;
  };
  const groups: { title: string; tag: string; blurb: string; levels: LevelDef[] }[] = [
    ...CHAPTERS.map((ch) => ({
      title: ch.name,
      tag: `CHAPTER ${ch.number}`,
      blurb: `${SONGS[ch.song].style}. ${ch.blurb}`,
      levels: levels.filter((l) => l.chapter === ch.number),
    })),
    { title: 'Club Night', tag: 'ENDLESS', blurb: 'Everything on, no end. How long can you keep the groove going?', levels: levels.filter((l) => l.chapter === 0) },
  ];
  let first: HTMLButtonElement | null = null;
  for (const g of groups) {
    if (!g.levels.length) continue;
    const section = el('section', 'chapter');
    const head = el('div', 'chapter-head');
    head.append(el('span', 'chapter-tag', g.tag), el('h3', '', g.title), el('p', 'chapter-blurb', g.blurb));
    const grid = el('div', 'levels');
    for (const l of g.levels) {
      const c = card(l);
      first ??= c;
      grid.append(c);
    }
    section.append(head, grid);
    inner.append(section);
  }
  s.append(inner);
  show(s);
  first?.focus();
}

export function showPause(actions: { resume: () => void; restart: () => void; levels: () => void }): void {
  // Pause is usually opened with Esc: no entrance animation for keyboard actions.
  const s = el('div', 'screen dim instant');
  const inner = el('div', 'screen-inner');
  const resume = button('Resume', actions.resume, true);
  const row = el('div', 'row');
  row.append(resume, button('Restart level', actions.restart), button('Level select', actions.levels));
  inner.append(el('h2', '', 'Paused'), el('p', 'subtitle', 'The track waits for you.'), row);
  s.append(inner);
  show(s, true);
  resume.focus();
}

export interface EndStats {
  victory: boolean;
  level: LevelDef;
  waves: number;
  kills: number;
  core: { left: number; total: number };
  hasNext: boolean;
}

export function showEnd(stats: EndStats, actions: { next: () => void; retry: () => void; levels: () => void }): void {
  const s = el('div', 'screen dim');
  const inner = el('div', 'screen-inner');
  const title = stats.victory ? (stats.level.id === 'endless' ? 'What a night' : 'Track complete') : 'The beat stopped';
  const sub = stats.victory
    ? `${stats.level.name}: you kept the groove going.`
    : stats.waves === 0
      ? 'The core fell before the first wave was through.'
      : `You held the groove through ${stats.waves} wave${stats.waves === 1 ? '' : 's'}.`;
  const statRow = el('div', 'stats');
  const stat = (value: string, label: string) => {
    const d = el('div', 'stat');
    d.append(el('b', '', value), el('span', '', label));
    return d;
  };
  statRow.append(stat(String(stats.waves), 'waves'), stat(String(stats.kills), 'kills'), stat(`${stats.core.left}/${stats.core.total}`, 'core'));
  const row = el('div', 'row');
  let first: HTMLButtonElement;
  if (stats.victory && stats.hasNext) {
    first = button('Next level', actions.next, true);
    row.append(first, button('Replay', actions.retry), button('Level select', actions.levels));
  } else {
    first = button(stats.victory ? 'Play again' : 'Try again', actions.retry, true);
    row.append(first, button('Level select', actions.levels));
  }
  inner.append(el('h2', '', title), el('p', 'subtitle', sub), statRow, row);
  s.append(inner);
  show(s);
  first.focus();
}

// ---------- coach ----------

export function showCoach(text: string | null, onOk: () => void): void {
  const box = document.getElementById('coach')!;
  if (!text) {
    box.hidden = true;
    return;
  }
  const p = box.querySelector('.coach-text')!;
  const changed = box.hidden || p.textContent !== text;
  p.textContent = text;
  (box.querySelector('.coach-ok') as HTMLButtonElement).onclick = onOk;
  if (changed) {
    box.hidden = false;
    box.setAttribute('data-enter', '');
    requestAnimationFrame(() => requestAnimationFrame(() => box.removeAttribute('data-enter')));
  }
}

// ---------- rewards ----------

export function showRewards(offer: readonly RewardId[] | null, onPick: (id: RewardId) => void): void {
  const tray = document.getElementById('rewards')!;
  const cards = tray.querySelector('.rewards-cards')!;
  if (!offer || offer.length === 0) {
    tray.hidden = true;
    cards.replaceChildren();
    return;
  }
  if (!tray.hidden && cards.getAttribute('data-offer') === offer.join(',')) return;
  cards.setAttribute('data-offer', offer.join(','));
  cards.replaceChildren(
    ...offer.map((id) => {
      const r = rewardById(id);
      const card = el('button', 'reward-card');
      card.type = 'button';
      card.style.setProperty('--card', hex(r.color));
      card.append(el('span', 'name', r.name), el('span', 'game', r.game), el('span', 'sound', `♪ ${r.sound}`));
      card.addEventListener('click', () => onPick(id));
      return card;
    }),
  );
  tray.hidden = false;
  tray.setAttribute('data-enter', '');
  requestAnimationFrame(() => requestAnimationFrame(() => tray.removeAttribute('data-enter')));
}

export function setInGameChrome(visible: boolean): void {
  document.getElementById('ingame')!.hidden = !visible;
}
