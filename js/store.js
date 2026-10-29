// The one place data is read and written: a single versioned JSON document in localStorage.
// Weights are always kilograms.

import { today, uid, isYmd } from './util.js';
import { DAYS, seedPlans, thisWeek } from './plans.js';

export const KEY = 'liftboard:v1';
export const VERSION = 1;
const GROUP_IDS = ['chest', 'back', 'shoulders', 'legs', 'arms', 'core'];
const KINDS = ['weight', 'perdb', 'reps', 'time'];

export function fresh() {
  return {
    version: VERSION,
    settings: { unit: 'kg', standards: 'men', step: 2.5, stepLb: 5, theme: 'system', welcomed: false, installDismissed: false, bwAsked: false },
    bodyweight: [],
    entries: [],
    custom: [],
    pinned: [],
    hidden: [],
    plans: seedPlans(),
    lastBackup: null,
  };
}

const num = v => (typeof v === 'number' && isFinite(v) ? v : null);

function cleanEntry(e) {
  if (!e || typeof e !== 'object') return null;
  if (typeof e.id !== 'string' || !e.id) return null;
  if (e.type !== 'max' && e.type !== 'set') return null;
  if (typeof e.ex !== 'string' || !e.ex || !isYmd(e.date)) return null;
  const out = { id: e.id, type: e.type, ex: e.ex, date: e.date };
  for (const k of ['kg', 'reps', 'added', 'sec']) {
    const n = num(e[k]);
    if (n != null && n >= 0) out[k] = n;
  }
  if (out.kg == null && out.reps == null && out.sec == null) return null;
  return out;
}

function cleanCustom(c) {
  if (!c || typeof c.id !== 'string' || typeof c.name !== 'string' || !c.name.trim()) return null;
  const out = {
    id: c.id, name: c.name.trim().slice(0, 60),
    group: GROUP_IDS.includes(c.group) ? c.group : 'chest',
    kind: KINDS.includes(c.kind) ? c.kind : 'weight',
    equipment: typeof c.equipment === 'string' ? c.equipment : 'custom',
    custom: true, aliases: [],
  };
  if (typeof c.base === 'string' && num(c.factor) > 0) { out.base = c.base; out.factor = c.factor; }
  return out;
}

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

function cleanPlan(p) {
  if (!p || typeof p.id !== 'string' || !str(p.name, 40)) return null;
  const days = (Array.isArray(p.days) ? p.days : []).filter(d => d && typeof d.id === 'string').map(d => ({
    id: d.id, day: DAYS.includes(d.day) ? d.day : '', title: str(d.title, 60),
    items: (Array.isArray(d.items) ? d.items : []).filter(i => i && typeof i.id === 'string' && str(i.text, 80)).map(i => ({
      id: i.id, text: str(i.text, 80), detail: str(i.detail, 40), done: isYmd(i.done) ? i.done : null,
    })),
  }));
  const notes = (Array.isArray(p.notes) ? p.notes : []).map(n => str(n, 300)).filter(Boolean);
  return { id: p.id, name: str(p.name, 40), days, notes };
}

// Upgrade and sanitise any stored or imported document. Throws on something that is not ours.
export function migrate(d) {
  if (d == null) return null;
  if (typeof d !== 'object' || Array.isArray(d)) throw new Error('Not a Liftboard file');
  if (typeof d.version !== 'number' || !Array.isArray(d.entries)) throw new Error('Not a Liftboard file');
  if (d.version > VERSION) throw new Error('This file is from a newer version of the app');
  // Future: if (d.version === 1) { …; d.version = 2; }
  const base = fresh();
  const s = { ...base.settings, ...(d.settings && typeof d.settings === 'object' ? d.settings : {}) };
  if (s.unit !== 'kg' && s.unit !== 'lb') s.unit = 'kg';
  if (s.standards !== 'men' && s.standards !== 'women') s.standards = 'men';
  if (![1, 1.25, 2.5, 5].includes(s.step)) s.step = 2.5;
  if (![1, 1.25, 2.5, 5].includes(s.stepLb)) s.stepLb = 5;
  if (!['system', 'dark', 'light'].includes(s.theme)) s.theme = 'system';
  const ids = new Set();
  const entries = [];
  for (const raw of d.entries) {
    const e = cleanEntry(raw);
    if (e && !ids.has(e.id)) { ids.add(e.id); entries.push(e); }
  }
  const bodyweight = (Array.isArray(d.bodyweight) ? d.bodyweight : [])
    .filter(b => b && isYmd(b.date) && num(b.kg) > 0)
    .map(b => ({ date: b.date, kg: b.kg }));
  const custom = (Array.isArray(d.custom) ? d.custom : []).map(cleanCustom).filter(Boolean);
  // Documents saved before plans existed get the starter plans.
  const plans = Array.isArray(d.plans) ? d.plans.map(cleanPlan).filter(Boolean) : base.plans;
  const strs = a => (Array.isArray(a) ? [...new Set(a.filter(x => typeof x === 'string'))] : []);
  return {
    version: VERSION, settings: s, bodyweight, entries, custom,
    pinned: strs(d.pinned), hidden: strs(d.hidden), plans,
    lastBackup: isYmd(d.lastBackup) ? d.lastBackup : null,
  };
}

let storageOk = true;
function load() {
  try {
    return migrate(JSON.parse(localStorage.getItem(KEY))) ?? fresh();
  } catch (err) {
    console.error('Could not read saved data', err);
    // Keep a copy of whatever was there so a bug can never silently wipe it.
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) localStorage.setItem(`${KEY}:corrupt-${Date.now()}`, raw);
    } catch { storageOk = false; }
    return fresh();
  }
}

let data = load();
const listeners = new Set();
export const on = fn => (listeners.add(fn), () => listeners.delete(fn));
const emit = (type, detail) => listeners.forEach(fn => fn(type, detail));

export const get = () => data;
export const settings = () => data.settings;
export const isStorageOk = () => storageOk;

let rev = 0;
export const revision = () => rev;

let askedPersist = false;
export function save(type = 'change') {
  rev++;
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    storageOk = true;
  } catch (err) {
    storageOk = false;
    console.error(err);
    emit('error', 'Could not save: phone storage is full or blocked. Export a backup now.');
  }
  if (!askedPersist && data.entries.length && navigator.storage?.persist) {
    askedPersist = true;
    navigator.storage.persist().catch(() => {});
  }
  emit(type);
}

// ---- Entries ----
export function addEntry(fields) {
  const e = cleanEntry({ id: uid('e'), ...fields });
  if (!e) throw new Error('Invalid entry');
  data.entries.push(e);
  save();
  return e;
}
export function updateEntry(id, fields) {
  const i = data.entries.findIndex(e => e.id === id);
  if (i < 0) return null;
  const next = cleanEntry({ ...fields, id, type: data.entries[i].type, ex: data.entries[i].ex });
  if (!next) return null;
  data.entries[i] = next;
  save();
  return next;
}
export function deleteEntry(id) {
  const index = data.entries.findIndex(e => e.id === id);
  if (index < 0) return null;
  const [entry] = data.entries.splice(index, 1);
  save();
  return { entry, index };
}
export function restoreEntry({ entry, index }) {
  if (data.entries.some(e => e.id === entry.id)) return;
  data.entries.splice(Math.min(index, data.entries.length), 0, entry);
  save();
}

// ---- Settings and bodyweight ----
export function setSetting(key, value) {
  data.settings[key] = value;
  save();
}
export function setBodyweight(kg, date = today()) {
  data.bodyweight = data.bodyweight.filter(b => b.date !== date);
  if (kg > 0) data.bodyweight.push({ date, kg });
  data.bodyweight.sort((a, b) => (a.date < b.date ? -1 : 1));
  save();
}
// Current bodyweight entry (latest by date), or null.
export function currentBodyweight() {
  const t = today();
  let pick = null;
  for (const b of data.bodyweight) if (b.date <= t && (!pick || b.date >= pick.date)) pick = b;
  return pick ?? data.bodyweight[data.bodyweight.length - 1] ?? null;
}

// ---- Exercises: custom, pinned, hidden ----
export function addCustom(c) {
  const slug = c.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'exercise';
  const item = cleanCustom({ ...c, id: `c_${slug}-${Date.now().toString(36)}` });
  if (!item) throw new Error('Invalid exercise');
  data.custom.push(item);
  save();
  return item;
}
export function updateCustom(id, fields) {
  const i = data.custom.findIndex(c => c.id === id);
  if (i < 0) return;
  const next = cleanCustom({ ...data.custom[i], ...fields, id });
  if (next) data.custom[i] = next;
  save();
}
// Removes the exercise and its entries; returns what is needed to undo.
export function deleteCustom(id) {
  const index = data.custom.findIndex(c => c.id === id);
  if (index < 0) return null;
  const snapshot = { custom: data.custom[index], index, entries: data.entries.filter(e => e.ex === id), pinned: data.pinned.includes(id), hidden: data.hidden.includes(id) };
  data.custom.splice(index, 1);
  data.entries = data.entries.filter(e => e.ex !== id);
  data.pinned = data.pinned.filter(x => x !== id);
  data.hidden = data.hidden.filter(x => x !== id);
  save();
  return snapshot;
}
export function restoreCustom(snap) {
  if (data.custom.some(c => c.id === snap.custom.id)) return;
  data.custom.splice(snap.index, 0, snap.custom);
  data.entries.push(...snap.entries);
  if (snap.pinned) data.pinned.push(snap.custom.id);
  if (snap.hidden) data.hidden.push(snap.custom.id);
  save();
}
export function togglePin(id) {
  data.pinned = data.pinned.includes(id) ? data.pinned.filter(x => x !== id) : [...data.pinned, id];
  save();
}
export function setHidden(id, hidden) {
  data.hidden = data.hidden.filter(x => x !== id);
  if (hidden) { data.hidden.push(id); data.pinned = data.pinned.filter(x => x !== id); }
  save();
}

// ---- Personal plans (saved as 'plans' so only the Plans tab redraws) ----
const plan = pid => data.plans.find(p => p.id === pid);
const planDay = (pid, did) => plan(pid)?.days.find(d => d.id === did);
const savePlans = () => save('plans');
// Weekdays in order, then undated lists.
const dayRank = d => (d.day ? DAYS.indexOf(d.day) : 7);
const sortDays = p => p.days.sort((a, b) => dayRank(a) - dayRank(b));

export function togglePlanItem(pid, itemId) {
  const item = plan(pid)?.days.flatMap(d => d.items).find(i => i.id === itemId);
  if (!item) return false;
  item.done = item.done === thisWeek() ? null : thisWeek();
  savePlans();
  return !!item.done;
}
export function clearPlanWeek(pid) {
  for (const d of plan(pid)?.days ?? []) for (const i of d.items) i.done = null;
  savePlans();
}
export function addPerson(name) {
  const p = cleanPlan({ id: uid('p'), name, days: [], notes: [] });
  if (!p) throw new Error('Invalid name');
  data.plans.push(p);
  savePlans();
  return p;
}
export function renamePerson(pid, name) {
  const p = plan(pid);
  if (p && str(name, 40)) { p.name = str(name, 40); savePlans(); }
}
export function deletePerson(pid) {
  const index = data.plans.findIndex(p => p.id === pid);
  if (index < 0) return null;
  const [person] = data.plans.splice(index, 1);
  savePlans();
  return { person, index };
}
export function restorePerson({ person, index }) {
  if (data.plans.some(p => p.id === person.id)) return;
  data.plans.splice(Math.min(index, data.plans.length), 0, person);
  savePlans();
}
export function addPlanDay(pid, day, title) {
  const p = plan(pid);
  if (!p) return null;
  const d = { id: uid('d'), day: DAYS.includes(day) ? day : '', title: str(title, 60), items: [] };
  p.days.push(d);
  sortDays(p);
  savePlans();
  return d;
}
export function updatePlanDay(pid, did, day, title) {
  const d = planDay(pid, did);
  if (!d) return;
  d.day = DAYS.includes(day) ? day : '';
  d.title = str(title, 60);
  sortDays(plan(pid));
  savePlans();
}
export function deletePlanDay(pid, did) {
  const p = plan(pid);
  if (!p) return;
  p.days = p.days.filter(d => d.id !== did);
  savePlans();
}
export function addPlanItem(pid, did, text, detail = '') {
  const d = planDay(pid, did);
  if (!d || !str(text, 80)) return null;
  const item = { id: uid('i'), text: str(text, 80), detail: str(detail, 40), done: null };
  d.items.push(item);
  savePlans();
  return item;
}
export function updatePlanItem(pid, did, itemId, text, detail = '') {
  const item = planDay(pid, did)?.items.find(i => i.id === itemId);
  if (!item || !str(text, 80)) return;
  item.text = str(text, 80);
  item.detail = str(detail, 40);
  savePlans();
}
export function deletePlanItem(pid, did, itemId) {
  const d = planDay(pid, did);
  const index = d?.items.findIndex(i => i.id === itemId) ?? -1;
  if (index < 0) return null;
  const [item] = d.items.splice(index, 1);
  savePlans();
  return { pid, did, item, index };
}
export function restorePlanItem({ pid, did, item, index }) {
  const d = planDay(pid, did);
  if (!d || d.items.some(i => i.id === item.id)) return;
  d.items.splice(Math.min(index, d.items.length), 0, item);
  savePlans();
}
export function setPlanNotes(pid, notes) {
  const p = plan(pid);
  if (!p) return;
  p.notes = notes.map(n => str(n, 300)).filter(Boolean);
  savePlans();
}

// ---- Backup ----
export function exportFile() {
  const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
  return new File([blob], `liftboard-${today()}.json`, { type: 'application/json' });
}
export function markBackup() {
  data.lastBackup = today();
  save();
}
// Validate an import; returns a clean document plus a summary for the confirm step.
export function parseImport(text) {
  let raw;
  try { raw = JSON.parse(text); } catch { throw new Error("That file isn't valid JSON"); }
  const d = migrate(raw);
  if (!d) throw new Error('Not a Liftboard file');
  const dates = d.entries.map(e => e.date).sort();
  return {
    data: d,
    count: d.entries.length,
    sets: d.entries.filter(e => e.type === 'set').length,
    maxes: d.entries.filter(e => e.type === 'max').length,
    from: dates[0] ?? null,
    to: dates[dates.length - 1] ?? null,
  };
}
export function importData(incoming, mode) {
  if (mode === 'replace') {
    data = structuredClone(incoming);
    data.settings.welcomed = true;
  } else {
    const ids = new Set(data.entries.map(e => e.id));
    for (const e of incoming.entries) if (!ids.has(e.id)) { data.entries.push(e); ids.add(e.id); }
    const bw = new Map(data.bodyweight.map(b => [b.date, b]));
    for (const b of incoming.bodyweight) if (!bw.has(b.date)) bw.set(b.date, b);
    data.bodyweight = [...bw.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
    const cids = new Set(data.custom.map(c => c.id));
    for (const c of incoming.custom) if (!cids.has(c.id)) data.custom.push(c);
    data.pinned = [...new Set([...data.pinned, ...incoming.pinned])];
    data.hidden = [...new Set([...data.hidden, ...incoming.hidden])];
    const pids = new Set(data.plans.map(p => p.id));
    for (const p of incoming.plans) if (!pids.has(p.id)) data.plans.push(p);
  }
  save('import');
}
export function deleteAll() {
  const keep = { unit: data.settings.unit, theme: data.settings.theme };
  data = fresh();
  Object.assign(data.settings, keep, { welcomed: true, installDismissed: true });
  save('reset');
}

// Dev helper: replace data (used by the ?dev sample filler).
export function replaceAll(d) {
  data = migrate(d);
  save('import');
}
