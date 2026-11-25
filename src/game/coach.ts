/**
 * The training coach: shows one tip at a time, in the order the level lists them, each only once.
 * Pure: the scene fires triggers and renders `current`.
 */

import type { CoachStep, CoachTrigger } from './levels';

export class Coach {
  private queue: CoachStep[] = [];
  private shown = new Set<CoachStep>();
  current: CoachStep | null = null;

  constructor(private readonly steps: readonly CoachStep[]) {}

  /** Something happened. Returns true if the visible tip changed. */
  fire(trigger: CoachTrigger): boolean {
    const before = this.current;
    if (this.current?.until === trigger) this.current = null;
    for (const step of this.steps) {
      if (step.on === trigger && !this.shown.has(step) && !this.queue.includes(step)) this.queue.push(step);
    }
    if (!this.current) this.advance();
    // A step that is waiting on its own trigger gives way when its trigger fires and a new tip is queued.
    else if (this.queue.length > 0 && !this.current.until) this.advance();
    return before !== this.current;
  }

  /** "Got it". */
  dismiss(): void {
    this.current = null;
    this.advance();
  }

  private advance(): void {
    const next = this.queue.shift() ?? null;
    if (next) this.shown.add(next);
    this.current = next;
  }
}
