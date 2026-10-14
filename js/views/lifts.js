// Tab 1: Lifts. Search, filter chips, pinned section, grouped exercise rows.

import * as store from '../store.js';
import { GROUPS, KIND_LABELS } from '../exercises.js';
import { library, stats, unit, exercise } from '../state.js';
import { ICONS, badge, toast, modal, onLongPress, entryParts, entryText } from '../ui.js';
import { esc, relDay, today, dayNum } from '../util.js';
import { BASE_NAMES, isWeightKind } from '../ranks.js';

let root, listEl, openSheet, openSettings;
let query = '';
let filter = 'all';
let backupSnoozed = false;

const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');

function matches(ex, q) {
  if (!q) return true;
  if (norm(ex.name).includes(q)) return true;
  return (ex.aliases || []).some(a => norm(a).includes(q));
}

export function initLifts(el, hooks) {
  root = el;
  ({ openSheet, openSettings } = hooks);
  const chips = [['all', 'All'], ['logged', 'Logged'], ...GROUPS.map(g => [g.id, g.name])];
  root.innerHTML = `
    <div class="lifts-top" id="lifts-top">
      <div class="search">${ICONS.search}
        <input id="search" type="search" placeholder="Search exercises" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="search" aria-label="Search exercises">
        <button type="button" class="clear" id="search-clear" aria-label="Clear search" hidden>${ICONS.x}</button>
      </div>
      <div class="chips" role="toolbar" aria-label="Filter">
        ${chips.map(([id, label]) => `<button type="button" class="chip" data-filter="${id}" aria-pressed="${id === filter}">${label}</button>`).join('')}
      </div>
    </div>
    <div id="lifts-list"></div>`;
  listEl = root.querySelector('#lifts-list');
  const input = root.querySelector('#search');
  const clearBtn = root.querySelector('#search-clear');
  input.addEventListener('input', () => {
    query = input.value;
    clearBtn.hidden = !query;
    renderLifts();
  });
  input.addEventListener('keydown', e => { if (e.key === 'Enter') input.blur(); });
  clearBtn.addEventListener('click', () => {
    input.value = query = '';
    clearBtn.hidden = true;
    renderLifts();
  });
  root.querySelector('.chips').addEventListener('click', e => {
    const b = e.target.closest('[data-filter]');
    if (!b) return;
    filter = b.dataset.filter;
    root.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', c === b));
    renderLifts();
    document.getElementById('main').scrollTop = 0;
  });

  listEl.addEventListener('click', e => {
    const row = e.target.closest('[data-ex]');
    if (row) return openSheet(row.dataset.ex);
    const act = e.target.closest('[data-act]');
    if (!act) return;
    const a = act.dataset.act;
    if (a === 'add-custom') addCustomFlow(act.dataset.name || '');
    else if (a === 'dismiss-install') store.setSetting('installDismissed', true);
    else if (a === 'backup') openSettings('backup');
    else if (a === 'snooze-backup') { backupSnoozed = true; renderLifts(); }
    else if (a === 'clear-search') root.querySelector('#search-clear').click();
  });
  onLongPress(listEl, '[data-ex]', row => quickSet(row.dataset.ex));

  // Keep sticky group headers just under the sticky search block.
  const top = root.querySelector('#lifts-top');
  const setH = () => document.documentElement.style.setProperty('--sticky-h', `${top.offsetHeight}px`);
  new ResizeObserver(setH).observe(top);
  setH();
}

function rowHTML(ex, st, u) {
  const s = st.byEx.get(ex.id);
  let val = '<span class="dash">—</span>', b = '', sub = 'Not logged yet';
  if (s) {
    sub = relDay(s.lastDate);
    if (s.best) {
      const p = entryParts(ex, s.best, u);
      val = `<b>${esc(p.num)}</b>${p.unit ? `<small>${esc(p.unit)}</small>` : ''}`;
      b = badge(s.tierIdx);
    } else if (s.bestSet) {
      const p = entryParts(ex, s.bestSet, u);
      val = `<span class="muted"><b>${esc(p.num)}</b>${p.unit ? `<small>${esc(p.unit)}</small>` : ''}<span class="tag">set</span></span>`;
    }
  }
  if (ex.custom) sub += ' · Custom';
  return `<button type="button" class="row" data-ex="${esc(ex.id)}">
    <div class="row-main"><div class="row-name"><span>${esc(ex.name)}</span>${s?.flame ? ICONS.flame : ''}</div><div class="row-sub">${esc(sub)}</div></div>
    <div class="row-val ${s && !s.best ? 'muted' : ''}">${val}</div>
    <div class="badge-slot">${b}</div>
  </button>`;
}

function bannersHTML() {
  const d = store.get();
  let out = '';
  if (navigator.standalone === false && !d.settings.installDismissed) {
    out += `<div class="banner"><p><b>Install Liftboard:</b> tap Share, then <b>Add to Home Screen</b>. Data logged in Safari stays in Safari.</p>
      <button type="button" class="x" data-act="dismiss-install" aria-label="Dismiss">${ICONS.x}</button></div>`;
  }
  if (d.entries.length && !backupSnoozed) {
    const first = d.entries.reduce((m, e) => (e.date < m ? e.date : m), today());
    const since = d.lastBackup || first;
    if (dayNum(today()) - dayNum(since) > 30) {
      out += `<div class="banner warn"><p>${d.lastBackup ? 'Last backup over 30 days ago.' : 'You have never backed up.'} Deleting the app deletes your logs.</p>
        <button type="button" class="btn primary" data-act="backup">Back up</button>
        <button type="button" class="x" data-act="snooze-backup" aria-label="Not now">${ICONS.x}</button></div>`;
    }
  }
  return out;
}

export function renderLifts() {
  if (!listEl) return;
  const st = stats();
  const u = unit();
  const d = store.get();
  const hidden = new Set(d.hidden);
  const q = norm(query);
  const all = library().filter(e => !hidden.has(e.id));
  const visible = all.filter(e => matches(e, q) && (filter === 'all' || (filter === 'logged' ? st.byEx.has(e.id) : e.group === filter)));

  let html = bannersHTML();
  if (filter === 'all' && !q) {
    const pinned = d.pinned.map(id => all.find(e => e.id === id)).filter(Boolean);
    if (pinned.length) {
      html += `<h2 class="group-h">Pinned · ${pinned.length}</h2><div class="rows">${pinned.map(e => rowHTML(e, st, u)).join('')}</div>`;
    }
  }
  for (const g of GROUPS) {
    const list = visible.filter(e => e.group === g.id);
    if (!list.length) continue;
    html += `<h2 class="group-h">${g.name} · ${list.length}</h2><div class="rows">${list.map(e => rowHTML(e, st, u)).join('')}</div>`;
  }
  if (!visible.length) {
    if (q) {
      html += `<div class="empty"><p>No exercise matches “${esc(query)}”.</p>
        <button type="button" class="btn primary" data-act="add-custom" data-name="${esc(query)}">${ICONS.plus} Add “${esc(query)}”</button></div>`;
    } else if (filter === 'logged') {
      html += `<div class="empty"><p>Nothing logged yet. Tap any exercise to log your first set.</p></div>`;
    }
  }
  html += `<div class="rows" style="margin-top:16px"><button type="button" class="row add-row" data-act="add-custom">${ICONS.plus} Add custom exercise</button></div>`;
  listEl.innerHTML = html;
}

// Long-press a row: log the last set again, dated today.
function quickSet(id) {
  const ex = exercise(id);
  const s = stats().byEx.get(id);
  if (!ex) return;
  if (!s?.lastSet) {
    toast(`No set to repeat yet. Tap ${ex.name} to log one.`);
    return;
  }
  const { kg, reps, added, sec } = s.lastSet;
  const e = store.addEntry({ type: 'set', ex: id, date: today(), kg, reps, added, sec });
  toast(`Logged ${ex.name}: ${entryText(ex, e, unit())}`, {
    action: 'Undo', duration: 5000,
    onAction: () => store.deleteEntry(e.id),
  });
}

// ---- Custom exercise form (add and edit) ----
export function customForm(c = {}) {
  const groups = GROUPS.map(g => `<option value="${g.id}" ${c.group === g.id ? 'selected' : ''}>${g.name}</option>`).join('');
  const kinds = Object.entries(KIND_LABELS).map(([k, l]) => `<option value="${k}" ${c.kind === k ? 'selected' : ''}>${l}</option>`).join('');
  const bases = [['', 'Not ranked'], ...Object.entries(BASE_NAMES)].map(([k, l]) => `<option value="${k}" ${(c.base || '') === k ? 'selected' : ''}>${k ? `Like ${l}` : l}</option>`).join('');
  return `<form class="custom-form" novalidate>
    <div class="field"><label for="cf-name">Name</label><input class="input" id="cf-name" name="name" maxlength="60" required value="${esc(c.name || '')}" autocomplete="off"></div>
    <div class="field"><label for="cf-group">Muscle group</label><select class="input" id="cf-group" name="group">${groups}</select></div>
    <div class="field"><label for="cf-kind">Logged as</label><select class="input" id="cf-kind" name="kind">${kinds}</select></div>
    <div class="field cf-rank"><label for="cf-base">Rank against</label><select class="input" id="cf-base" name="base">${bases}</select></div>
    <div class="field cf-factor"><label for="cf-factor">Factor (1.0 = same thresholds as the base lift)</label><input class="input" id="cf-factor" name="factor" type="number" inputmode="decimal" step="0.05" min="0.05" max="5" value="${c.factor ?? 1}"></div>
  </form>`;
}

export function wireCustomForm(wrap) {
  const f = wrap.querySelector('form');
  const sync = () => {
    const weighted = isWeightKind(f.kind.value);
    wrap.querySelector('.cf-rank').hidden = !weighted;
    wrap.querySelector('.cf-factor').hidden = !weighted || !f.base.value;
  };
  f.kind.addEventListener('change', sync);
  f.base.addEventListener('change', sync);
  sync();
  setTimeout(() => f.name.focus(), 50);
}

export function readCustomForm(wrap) {
  const f = wrap.querySelector('form');
  const name = f.name.value.trim();
  const out = { name, group: f.group.value, kind: f.kind.value };
  const factor = parseFloat(f.factor.value);
  if (isWeightKind(out.kind) && f.base.value && factor > 0) { out.base = f.base.value; out.factor = Math.round(factor * 100) / 100; }
  else { out.base = undefined; out.factor = undefined; }
  return out;
}

function validName(wrap) {
  const input = wrap.querySelector('#cf-name');
  if (input.value.trim()) return true;
  input.focus();
  input.style.borderColor = 'var(--danger)';
  return false;
}

async function addCustomFlow(name) {
  const res = await modal({
    title: 'Add custom exercise',
    body: customForm({ name, group: filter in { chest: 1, back: 1, shoulders: 1, legs: 1, arms: 1, core: 1 } ? filter : 'chest', kind: 'weight' }),
    onMount: wireCustomForm,
    actions: [{ label: 'Cancel', value: null }, { label: 'Add', kind: 'primary', validate: validName, value: readCustomForm }],
  });
  if (!res) return;
  const item = store.addCustom(res);
  if (query) root.querySelector('#search-clear').click();
  openSheet(item.id);
}
export { validName };
