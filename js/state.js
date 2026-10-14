// Derived state shared by the views: the exercise library (built-in + custom) and computed stats.
// Recomputed lazily after any save; one source of truth means no stale Max or rank.

import * as store from './store.js';
import { EXERCISES } from './exercises.js';
import { computeAll } from './stats.js';
import { today } from './util.js';

let cache = null, cacheRev = -1, cacheDay = '';

export function library() {
  return [...EXERCISES, ...store.get().custom];
}
export function exercise(id) {
  return EXERCISES.find(e => e.id === id) ?? store.get().custom.find(c => c.id === id) ?? null;
}
export function stats() {
  const t = today();
  if (!cache || cacheRev !== store.revision() || cacheDay !== t) {
    cache = computeAll(store.get(), library(), t);
    cacheRev = store.revision();
    cacheDay = t;
  }
  return cache;
}
export const unit = () => store.settings().unit;
export const stepFor = u => (u === 'lb' ? store.settings().stepLb : store.settings().step);
