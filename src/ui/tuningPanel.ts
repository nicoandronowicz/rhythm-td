/**
 * Tuning panel (T key). Built from TUNING_FIELDS, edits the tuning store live.
 */

import { TUNING_FIELDS, type TuningField } from '../config/tuning';
import { tuning } from '../config/tuningStore';

export function mountTuningPanel(root: HTMLElement, toggleButton: HTMLElement): void {
  const outputs = new Map<string, (v: number) => void>();

  const head = el('div', 'tp-head');
  const title = el('h2');
  title.textContent = 'Tuning';
  const close = el('button', 'tp-close') as HTMLButtonElement;
  close.type = 'button';
  close.textContent = '×';
  close.title = 'Close (T)';
  close.onclick = () => toggle(false);
  head.append(title, close);

  const actions = el('div', 'tp-actions');
  const copy = button('Copy as JSON');
  const reset = button('Reset');
  actions.append(copy, reset);
  const toast = el('div', 'tp-toast');

  root.append(head, actions, toast);

  const groups = new Map<string, HTMLElement>();
  for (const field of TUNING_FIELDS) {
    let group = groups.get(field.group);
    if (!group) {
      if (field.advanced) {
        const details = el('details', 'tp-group');
        const summary = el('summary');
        summary.textContent = field.group;
        details.append(summary);
        group = details;
      } else {
        group = el('section', 'tp-group');
        const h = el('h3');
        h.textContent = field.group;
        group.append(h);
      }
      groups.set(field.group, group);
      root.append(group);
    }
    group.append(row(field, outputs));
  }

  const note = el('p', 'tp-note');
  note.textContent = 'Changes apply live and are saved in this browser. Swing moves the in-between notes; the base patterns only have 8ths, so try "Swing on: 8ths" to hear it today.';
  root.append(note);

  copy.onclick = async () => {
    const json = tuning.toJSON();
    try {
      await navigator.clipboard.writeText(json);
      flash('Copied. Paste it to Claude.');
    } catch {
      window.prompt('Copy this:', json);
    }
  };
  reset.onclick = () => {
    tuning.reset();
    flash('Back to defaults.');
  };

  tuning.subscribe((path, value) => outputs.get(path)?.(value));

  function flash(msg: string) {
    toast.textContent = msg;
    window.setTimeout(() => {
      if (toast.textContent === msg) toast.textContent = '';
    }, 2500);
  }

  function toggle(force?: boolean) {
    const open = force ?? root.hidden;
    root.hidden = !open;
  }

  toggleButton.addEventListener('click', () => toggle());
  window.addEventListener('keydown', (e) => {
    if (e.key === 't' || e.key === 'T') {
      if (e.target instanceof HTMLInputElement && e.target.type === 'text') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      toggle();
    }
  });
}

function row(field: TuningField, outputs: Map<string, (v: number) => void>): HTMLElement {
  const r = el('div', 'tp-row');
  const id = `tp-${field.path.replace('.', '-')}`;
  const label = el('label') as HTMLLabelElement;
  label.textContent = field.label;
  label.htmlFor = id;
  const out = el('output');

  if (field.options) {
    const choice = el('div', 'tp-choice');
    choice.id = id;
    const buttons = field.options.map((o) => {
      const b = button(o.label);
      b.onclick = () => tuning.set(field.path, o.value);
      choice.append(b);
      return { b, value: o.value };
    });
    const update = (v: number) => {
      buttons.forEach(({ b, value }) => b.setAttribute('aria-pressed', String(value === v)));
      out.textContent = '';
    };
    update(tuning.get(field.path));
    outputs.set(field.path, update);
    r.append(label, choice, out);
    return r;
  }

  const input = el('input') as HTMLInputElement;
  input.type = 'range';
  input.id = id;
  input.min = String(field.min);
  input.max = String(field.max);
  input.step = String(field.step);
  input.addEventListener('input', () => tuning.set(field.path, Number(input.value)));
  // Keep Space/number keys from reaching the game while a slider is focused.
  input.addEventListener('keydown', (e) => e.stopPropagation());
  const update = (v: number) => {
    input.value = String(v);
    out.textContent = format(field, v);
  };
  update(tuning.get(field.path));
  outputs.set(field.path, update);
  r.append(label, input, out);
  return r;
}

function format(field: TuningField, v: number): string {
  if (field.unit === '%') return `${Math.round(v * 100)}%`;
  const decimals = field.step >= 1 ? 0 : field.step >= 0.1 ? 1 : field.step >= 0.01 ? 2 : 3;
  const n = v.toFixed(decimals);
  return field.unit ? `${n} ${field.unit}` : n;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (className) e.className = className;
  return e;
}

function button(text: string): HTMLButtonElement {
  const b = el('button');
  b.type = 'button';
  b.textContent = text;
  return b;
}
