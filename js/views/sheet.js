// The exercise detail sheet: the only place data is entered.

import * as store from '../store.js';
import { GROUPS } from '../exercises.js';
import { stats, unit, stepFor, exercise } from '../state.js';
import { TIERS, isRanked, isWeightKind, isBwAdjusted, entryValue, tierTargets } from '../ranks.js';
import { maxSeries } from '../stats.js';
import { maxChart, fmtValue } from '../charts.js';
import { ICONS, badge, toast, modal, confirmDialog, confetti, rankCardBlob, shareFile, onLongPress, entryParts, entryText } from '../ui.js';
import { customForm, wireCustomForm, readCustomForm, validName } from './lifts.js';
import { esc, today, fmtShort, fmtDay, toDisplay, fromDisplay, fmtNum, fmtSec } from '../util.js';

let wrap, sheet, hooks;
let exId = null;
let form = {};
let celebrate = null; // { max: {text, gain}, rankup: { ...rankInfo, tierUp } }
let maxOpen = false;
let editingId = null;
let flashId = null;

export const openExerciseId = () => exId;

export function initSheet(hookFns) {
  hooks = hookFns;
  wrap = document.getElementById('sheet-wrap');
  sheet = document.getElementById('sheet');
  wrap.querySelector('[data-close]').addEventListener('click', closeSheet);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && exId && !document.querySelector('.modal-wrap')) closeSheet(); });
  sheet.addEventListener('click', onClick);
  sheet.addEventListener('input', onInput);
  sheet.addEventListener('change', onInput);
  sheet.addEventListener('submit', e => e.preventDefault());
  wireSteppers();
  wireSwipeDown();
  wireHistoryGestures();
}

// ---- Open / close ----
export function openSheet(id) {
  const ex = exercise(id);
  if (!ex) return;
  exId = id;
  celebrate = null;
  editingId = null;
  flashId = null;
  maxOpen = false;
  resetForm(ex);
  renderSheet();
  wrap.hidden = false;
  sheet.style.transform = '';
  requestAnimationFrame(() => requestAnimationFrame(() => wrap.classList.add('open')));
  sheet.querySelector('.sheet-body').scrollTop = 0;
}

export function closeSheet() {
  if (!exId) return;
  exId = null;
  wrap.classList.remove('open');
  sheet.style.transform = '';
  const done = () => { if (!exId) { wrap.hidden = true; sheet.innerHTML = ''; } };
  setTimeout(done, 320);
}

function resetForm(ex) {
  const s = stats().byEx.get(ex.id);
  const best = s?.best, last = s?.lastSet;
  const t = today();
  form = { maxDate: t, setDate: t };
  if (isWeightKind(ex.kind)) {
    form.maxKg = best?.kg ?? s?.bestSet?.kg ?? null;
    form.setKg = last?.kg ?? null;
    form.setReps = last?.reps ?? null;
  } else if (ex.kind === 'time') {
    form.maxSec = best?.sec ?? null;
    form.setSec = last?.sec ?? null;
  } else {
    form.maxReps = best?.reps ?? null;
    form.maxAdded = best?.added ?? null;
    form.setReps = last?.reps ?? null;
    form.setAdded = last?.added ?? null;
  }
}

// ---- Field helpers ----
// type: 'w' weight (kg in form, display unit on screen), 'n' whole number, 's' seconds
function fieldValue(type, v, u) {
  if (v == null || v === '') return '';
  return type === 'w' ? fmtNum(toDisplay(v, u)) : String(v);
}
function stepper(name, label, type, value, u, { optional = false } = {}) {
  const mode = type === 'w' ? 'decimal' : 'numeric';
  const ph = optional ? '0' : type === 'w' ? u : type === 's' ? 'sec' : 'reps';
  return `<div class="field"><label for="f-${name}">${label}</label><div class="stepper">
    <button type="button" data-step="-1" data-for="${name}" data-type="${type}" aria-label="Decrease ${label}">${ICONS.minus}</button>
    <input id="f-${name}" data-field="${name}" data-type="${type}" type="text" inputmode="${mode}" autocomplete="off" placeholder="${ph}" value="${fieldValue(type, value, u)}">
    <button type="button" data-step="1" data-for="${name}" data-type="${type}" aria-label="Increase ${label}">${ICONS.plus}</button>
  </div></div>`;
}
const dateField = (name, value) =>
  `<div class="field"><label for="f-${name}">Date</label><input class="input" id="f-${name}" data-field="${name}" data-type="d" type="date" max="${today()}" value="${value}"></div>`;

function parseField(type, raw, u) {
  const v = String(raw).trim().replace(',', '.');
  if (v === '') return null;
  if (type === 'd') return v;
  const n = Number(v);
  if (!isFinite(n) || n < 0) return NaN;
  if (type === 'w') return fromDisplay(n, u);
  return type === 'n' ? Math.round(n) : Math.round(n);
}

function onInput(e) {
  const el = e.target.closest('[data-field]');
  if (!el || el.closest('.hist-edit')) return;
  const v = parseField(el.dataset.type, el.value, unit());
  form[el.dataset.field] = el.dataset.type === 'd' ? (v || today()) : v;
}

function stepBy(name, type, dir) {
  const u = unit();
  const input = sheet.querySelector(`[data-field="${name}"]`);
  if (!input) return;
  let cur = form[name];
  if (cur == null || isNaN(cur)) cur = 0;
  let next;
  if (type === 'w') {
    const step = stepFor(u);
    const shown = toDisplay(cur, u);
    // Snap to the step grid first, so 101.3 + 2.5 → 102.5, not 103.8.
    const snapped = dir > 0 ? Math.floor(shown / step + 1e-9) * step + step : Math.ceil(shown / step - 1e-9) * step - step;
    next = fromDisplay(Math.max(0, Math.round(snapped * 1000) / 1000), u);
  } else {
    next = Math.max(0, cur + dir * (type === 's' ? 5 : 1));
  }
  form[name] = next;
  input.value = fieldValue(type, next, u);
}

function wireSteppers() {
  let timer = null, interval = null;
  const stop = () => { clearTimeout(timer); clearInterval(interval); timer = interval = null; };
  sheet.addEventListener('pointerdown', e => {
    const b = e.target.closest('[data-step]');
    if (!b || e.button > 0) return;
    e.preventDefault(); // keep the keyboard where it is
    const go = () => stepBy(b.dataset.for, b.dataset.type, +b.dataset.step);
    go();
    stop();
    timer = setTimeout(() => { interval = setInterval(go, 90); }, 450);
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => sheet.addEventListener(t, stop, true));
  // Keyboard users: Enter/Space on a stepper button.
  sheet.addEventListener('keydown', e => {
    const b = e.target.closest?.('[data-step]');
    if (b && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); stepBy(b.dataset.for, b.dataset.type, +b.dataset.step); }
  });
}

// ---- Rendering ----
export function renderSheet() {
  if (!exId) return;
  const ex = exercise(exId);
  if (!ex) { closeSheet(); return; }
  const st = stats();
  const s = st.byEx.get(exId);
  const u = unit();
  const bodyScroll = sheet.querySelector('.sheet-body')?.scrollTop ?? 0;
  const focusId = document.activeElement?.closest?.('#sheet') ? document.activeElement.id : null;
  const group = GROUPS.find(g => g.id === ex.group)?.name ?? '';
  const ranked = isRanked(ex);

  // Header rank line
  let rank;
  if (!ranked) {
    rank = `<div class="grow"><div class="meta"><span>Not ranked</span></div><p class="note" style="margin:0">${ex.custom ? 'Edit this exercise and pick a base lift to rank it.' : ''}</p></div>`;
  } else if (!s?.best) {
    rank = `<div class="grow"><div class="meta"><span><b>Unranked</b></span><span>Log a Max to get ranked</span></div><div class="bar"><i style="width:0"></i></div></div>`;
  } else {
    const r = s.rank;
    const next = r.nextName ? `${r.pct}% to ${r.nextName}` : 'Top tier';
    rank = `${badge(r.tierIdx, 'md', r.div)}<div class="grow tier-${r.tierIdx}"><div class="meta"><span class="tier-text">${r.name}</span><span>${next}</span></div>
      <div class="bar"><i style="width:${r.nextName ? r.pct : 100}%"></i></div></div>`;
  }

  // Celebration
  let cel = '';
  if (celebrate?.max) cel += `<div class="celebrate" role="status"><h3>New Max!</h3><p>${esc(celebrate.max.text)}${celebrate.max.gain ? ` · ${esc(celebrate.max.gain)}` : ''}</p></div>`;
  if (celebrate?.rankup) {
    const r = celebrate.rankup;
    cel += `<div class="celebrate rankup tier-${r.tierIdx}" role="status">${badge(r.tierIdx, 'md', r.div)}<div class="grow"><h3>${r.tierUp ? 'Rank up' : 'Promoted'}: ${r.name}</h3><p>${esc(ex.name)}</p></div>
      <button type="button" class="btn" data-act="share-rankup">${ICONS.share} Share</button></div>`;
  }

  // Sets card: first in the sheet, with today's sets so far.
  let setFields;
  if (isWeightKind(ex.kind)) setFields = `${stepper('setKg', ex.kind === 'perdb' ? `Per DB (${u})` : `Weight (${u})`, 'w', form.setKg, u)}${stepper('setReps', 'Reps', 'n', form.setReps, u)}`;
  else if (ex.kind === 'time') setFields = `<div class="full">${stepper('setSec', 'Seconds', 's', form.setSec, u)}</div>`;
  else setFields = `${stepper('setReps', 'Reps', 'n', form.setReps, u)}${stepper('setAdded', `Added (${u})`, 'w', form.setAdded, u, { optional: true })}`;
  const todaySets = s ? s.sets.filter(e => e.date === st.today) : [];
  let setsSoFar = '';
  if (todaySets.length) {
    setsSoFar = `<div class="today"><div class="lbl">Today · ${todaySets.length} ${todaySets.length === 1 ? 'set' : 'sets'}</div><div class="today-sets">${todaySets.map((e, i) =>
      `<button type="button" class="pill" data-entry="${esc(e.id)}" aria-label="Edit set ${i + 1}: ${esc(entryText(ex, e, u))}"><i>${i + 1}</i>${esc(entryText(ex, e, u, true))}</button>`).join('')}</div></div>`;
  } else if (s?.lastSet) {
    setsSoFar = `<p class="hint">Last time: <b>${esc(entryText(ex, s.lastSet, u))}</b> on ${fmtShort(s.lastSet.date)}</p>`;
  }
  const setCard = `<form class="card" id="set-card" autocomplete="off">
    <div class="card-h"><h3>Log a set</h3><span class="aside">Training log · doesn't change rank</span></div>
    ${setsSoFar}
    <div class="form-grid">${setFields}<div class="full">${dateField('setDate', form.setDate)}</div></div>
    <div class="save-row"><button type="button" class="btn primary block" data-act="save-set">Save set${todaySets.length && form.setDate === st.today ? ` ${todaySets.length + 1}` : ''}</button></div>
  </form>`;

  // Max card: a compact summary; the form opens on demand.
  const maxP = entryParts(ex, s?.best, u);
  let est = '';
  if (isWeightKind(ex.kind)) { if (s?.bestEst) est = `Est. from sets <b>${fmtNum(toDisplay(s.bestEst, u), 1)} ${u}</b>`; }
  else if (s?.bestSet) est = `Best set <b>${esc(entryText(ex, s.bestSet, u))}</b>`;
  const meta = [est, `Trained <b>${s?.timesTrained ?? 0}</b> ${s?.timesTrained === 1 ? 'day' : 'days'}`].filter(Boolean).join(' · ');
  let suggest = '';
  if (isWeightKind(ex.kind) && s?.bestEst && (!s.best || s.bestEst > s.best.kg + 0.01)) {
    const step = stepFor(u);
    const shown = Math.round(toDisplay(s.bestEst, u) / step) * step;
    suggest = s.best
      ? `<p class="hint">Your sets suggest about <b>${fmtNum(shown)} ${u}</b>. Time to test a new max?</p>`
      : `<p class="hint">Your sets suggest about <b>${fmtNum(shown)} ${u}</b>. Log a Max to get ranked.</p>`;
  }
  const bestLine = s?.best
    ? `<div class="bigmax">${esc(maxP.num)}${maxP.unit ? ` <small>${esc(maxP.unit)}</small>` : ''} <span class="date">· ${fmtShort(s.best.date)}</span></div>`
    : `<div class="bigmax"><small>No Max yet</small></div>`;
  let maxForm = '';
  if (maxOpen) {
    const maxLabel = ex.kind === 'perdb' ? `Per dumbbell (${u})` : `Weight (${u})`;
    let maxFields;
    if (isWeightKind(ex.kind)) maxFields = `<div class="full">${stepper('maxKg', maxLabel, 'w', form.maxKg, u)}</div>`;
    else if (ex.kind === 'time') maxFields = `<div class="full">${stepper('maxSec', 'Longest hold (seconds)', 's', form.maxSec, u)}</div>`;
    else maxFields = `${stepper('maxReps', 'Max reps', 'n', form.maxReps, u)}${stepper('maxAdded', `Added (${u})`, 'w', form.maxAdded, u, { optional: true })}`;
    maxForm = `<form class="max-form" autocomplete="off"><div class="form-grid">${maxFields}<div class="full">${dateField('maxDate', form.maxDate)}</div></div>
      <div class="save-row"><button type="button" class="btn primary block" data-act="save-max">Save max</button></div></form>`;
  }
  const maxCard = `<div class="card" id="max-card">
    <div class="card-h"><h3>${ICONS.crown.replace('<svg', '<svg style="display:inline;width:18px;height:18px;vertical-align:-2px;margin-right:4px"')}Max</h3><span class="aside">${ex.kind === 'time' ? 'Longest hold' : ex.kind === 'reps' ? 'Most reps in one set' : 'Heaviest single'}${ranked ? ' · sets your rank' : ''}</span></div>
    <div class="max-row">${bestLine}<button type="button" class="btn ${maxOpen ? '' : 'primary-soft'}" data-act="toggle-max" aria-expanded="${maxOpen}">${maxOpen ? 'Cancel' : s?.best ? 'New Max' : 'Log Max'}</button></div>
    <p class="max-meta">${meta}</p>
    ${suggest}${maxForm}
  </div>`;

  const rankCard = ranked ? rankCardHTML(ex, s, st, u) : '';

  // Mini chart
  const hasChart = s && (s.maxes.length || s.sets.length);
  const mini = hasChart ? `<div class="card"><div class="card-h"><h3>Max over time</h3><span class="aside">Tap for full chart</span></div>
    <div class="mini" data-act="full-chart" role="button" aria-label="Open full chart"><canvas id="mini-chart"></canvas></div></div>` : '';

  // History
  let hist = '';
  if (s?.entries.length) {
    const days = new Map();
    for (let i = s.entries.length - 1; i >= 0; i--) {
      const e = s.entries[i];
      if (!days.has(e.date)) days.set(e.date, []);
      days.get(e.date).push(e);
    }
    hist = `<div class="card-h" style="margin:8px 4px 0"><h3>History</h3><span class="aside">Tap to edit · swipe left to delete</span></div>`;
    for (const [date, list] of days) {
      const maxes = list.filter(e => e.type === 'max').map(e => entryText(ex, e, u, true));
      const sets = list.filter(e => e.type === 'set').map(e => entryText(ex, e, u, true));
      const summary = [maxes.length ? `Max ${maxes.join(', ')}` : '', sets.length ? `Sets ${sets.join(', ')}` : ''].filter(Boolean).join(' · ');
      hist += `<div class="hist-day"><span>${fmtDay(date)}</span><span>${esc(summary)}</span></div><div class="hist">`;
      for (const e of list) hist += e.id === editingId ? editHTML(ex, e, u) : histRowHTML(ex, e, u, s);
      hist += '</div>';
    }
  }

  // Footer
  const pinned = store.get().pinned.includes(exId);
  const footer = `<div class="footer-acts">
    <button type="button" class="btn" data-act="pin">${ICONS.pin} ${pinned ? 'Unpin' : 'Pin to top'}</button>
    <button type="button" class="btn" data-act="hide">${ICONS.hide} Hide exercise</button>
    ${ex.custom ? `<button type="button" class="btn" data-act="edit-custom">${ICONS.edit} Rename / edit</button>
    <button type="button" class="btn warn" data-act="delete-custom">${ICONS.trash} Delete</button>` : ''}
  </div>`;

  sheet.innerHTML = `
    <div class="sheet-head">
      <div class="grabber"></div>
      <div class="sheet-title">
        <div style="flex:1;min-width:0"><h2>${esc(ex.name)}</h2><div class="sub">${esc(group)}${ex.custom ? ' · Custom' : ''}</div></div>
        <div class="seg" role="group" aria-label="Units">
          <button type="button" data-unit="kg" aria-pressed="${u === 'kg'}">kg</button><button type="button" data-unit="lb" aria-pressed="${u === 'lb'}">lb</button>
        </div>
        <button type="button" class="icon-btn" data-act="close" aria-label="Close">${ICONS.x}</button>
      </div>
      <div class="rankline">${rank}</div>
    </div>
    <div class="sheet-body">${cel}${setCard}${maxCard}${rankCard}${mini}${hist}${footer}</div>`;

  const body = sheet.querySelector('.sheet-body');
  body.scrollTop = bodyScroll;
  if (focusId) document.getElementById(focusId)?.focus({ preventScroll: true });
  if (hasChart) {
    maxChart(sheet.querySelector('#mini-chart'), { s, series: maxSeries(s, st.bwNow), unit: u, mini: true, today: st.today });
  }
  if (flashId) {
    sheet.querySelector(`[data-entry="${flashId}"]`)?.classList.add('flash');
    flashId = null;
  }
}

// A target in your own units, rounded up so that hitting the number shown is enough.
function fmtTarget(ex, v, u) {
  if (isWeightKind(ex.kind)) {
    const step = stepFor(u);
    return `${fmtNum(Math.ceil(toDisplay(v, u) / step - 1e-6) * step)} ${u}`;
  }
  if (ex.kind === 'time') return fmtSec(Math.ceil(v - 1e-6));
  const r = Math.max(1, Math.ceil(v - 1e-6));
  return `${r} ${r === 1 ? 'rep' : 'reps'}`;
}

// The rank ladder: every tier with what it takes at your bodyweight, and the next step.
function rankCardHTML(ex, s, st, u) {
  const targets = tierTargets(ex, st.standards, st.bwNow);
  const cur = s?.rank?.tierIdx ?? -1;
  let rungs = '';
  for (let i = 5; i >= 0; i--) {
    const state = i < cur ? 'done' : i === cur ? 'here' : 'locked';
    const need = i === 0 ? 'Any Max' : fmtTarget(ex, targets[i - 1], u);
    const name = i === cur && s.rank.div != null ? s.rank.name : TIERS[i];
    rungs += `<div class="rung tier-${i} ${state}">${badge(i)}<span class="nm">${name}</span>${i === cur ? '<span class="you">You</span>' : ''}<span class="need">${need}</span></div>`;
  }
  let next = '';
  if (s?.next) {
    let gap = '';
    const best = s.bestValue;
    const shownTarget = fmtTarget(ex, s.next.value, u);
    if (isWeightKind(ex.kind)) {
      const step = stepFor(u);
      const d = Math.ceil(toDisplay(s.next.value, u) / step - 1e-6) * step - toDisplay(best, u);
      if (d > 0) gap = ` · ${fmtNum(d)} ${u} to go`;
    } else if (ex.kind === 'time') {
      const d = Math.ceil(s.next.value - 1e-6) - best;
      if (d > 0) gap = ` · ${fmtSec(d)} to go`;
    } else if (!s.best.added) {
      const d = Math.max(1, Math.ceil(s.next.value - 1e-6)) - s.best.reps;
      if (d > 0) gap = ` · ${d} more ${d === 1 ? 'rep' : 'reps'}`;
    }
    next = `<div class="next-up tier-${Math.min(5, Math.floor((s.rank.step + 1) / 3))}"><span>Next</span><b class="tier-text">${s.next.name}</b><span class="at">at ${shownTarget}${gap}</span></div>`;
  } else if (s?.rank) {
    next = `<div class="next-up tier-5"><span>Top tier reached</span><b class="tier-text">Champion</b></div>`;
  }
  const bwKg = fmtNum(toDisplay(st.bwNow, u), 1);
  let bwLine;
  if (!isBwAdjusted(ex)) bwLine = `Core standards are the same at every bodyweight.`;
  else if (st.hasBw) bwLine = `Targets for your bodyweight of <b>${bwKg} ${u}</b>. <a href="#" data-act="bodyweight">Update</a>`;
  else bwLine = `<b>Using a default ${bwKg} ${u}.</b> <a href="#" data-act="bodyweight">Set your bodyweight</a> to get targets that fit you.`;
  const unitNote = ex.kind === 'reps' && isBwAdjusted(ex) ? ' Reps are at bodyweight; added weight counts extra.' : '';
  return `<div class="card rank-card">
    <div class="card-h"><h3>Rank</h3><span class="aside">${ex.kind === 'perdb' ? 'Per dumbbell' : ''}</span></div>
    ${next}
    <div class="ladder">${rungs}</div>
    <p class="note bw-note">${bwLine}${unitNote}</p>
  </div>`;
}

function histRowHTML(ex, e, u, s) {
  const isBest = s.best?.id === e.id;
  const icon = e.type === 'max' ? (isBest ? ICONS.trophy : ICONS.crown) : '';
  return `<div class="hist-item"><div class="hist-del" aria-hidden="true">Delete</div>
    <button type="button" class="hist-row" data-entry="${esc(e.id)}" aria-label="Edit ${e.type === 'max' ? 'Max' : 'set'} ${esc(entryText(ex, e, u))}">
      <span class="kind">${e.type === 'max' ? 'Max' : 'Set'}</span><span class="what">${esc(entryText(ex, e, u))}</span>${icon}
    </button></div>`;
}

function editHTML(ex, e, u) {
  const n = (name, label, type, v) => `<div class="field"><label>${label}</label><input class="input" data-edit="${name}" data-type="${type}" type="text" inputmode="${type === 'w' ? 'decimal' : 'numeric'}" value="${fieldValue(type, v, u)}"></div>`;
  let fields;
  if (isWeightKind(ex.kind)) fields = n('kg', `Weight (${u})`, 'w', e.kg) + (e.type === 'set' ? n('reps', 'Reps', 'n', e.reps) : '');
  else if (ex.kind === 'time') fields = n('sec', 'Seconds', 's', e.sec);
  else fields = n('reps', 'Reps', 'n', e.reps) + n('added', `Added (${u})`, 'w', e.added);
  return `<div class="hist-edit" data-editing="${esc(e.id)}">
    <div class="form-grid">${fields}<div class="field full"><label>Date</label><input class="input" data-edit="date" data-type="d" type="date" max="${today()}" value="${e.date}"></div></div>
    <div class="acts"><button type="button" class="btn" data-act="edit-cancel">Cancel</button><button type="button" class="btn warn" style="color:var(--danger)" data-act="edit-delete">Delete</button><button type="button" class="btn primary" data-act="edit-save">Save</button></div>
  </div>`;
}

// ---- Building and validating entries ----
function buildEntry(ex, type) {
  const f = form;
  if (isWeightKind(ex.kind)) {
    const kg = type === 'max' ? f.maxKg : f.setKg;
    if (!(kg > 0)) return { error: `Enter a weight first`, field: type === 'max' ? 'maxKg' : 'setKg' };
    if (kg > 1500) return { error: 'That weight looks wrong', field: type === 'max' ? 'maxKg' : 'setKg' };
    if (type === 'max') return { kg, date: f.maxDate };
    if (!(f.setReps >= 1)) return { error: 'Enter reps', field: 'setReps' };
    if (f.setReps > 500) return { error: 'That rep count looks wrong', field: 'setReps' };
    return { kg, reps: f.setReps, date: f.setDate };
  }
  if (ex.kind === 'time') {
    const sec = type === 'max' ? f.maxSec : f.setSec;
    if (!(sec > 0)) return { error: 'Enter seconds', field: type === 'max' ? 'maxSec' : 'setSec' };
    if (sec > 36000) return { error: 'That time looks wrong', field: type === 'max' ? 'maxSec' : 'setSec' };
    return { sec, date: type === 'max' ? f.maxDate : f.setDate };
  }
  const reps = type === 'max' ? f.maxReps : f.setReps;
  const added = (type === 'max' ? f.maxAdded : f.setAdded) || 0;
  if (!(reps >= 1)) return { error: 'Enter reps', field: type === 'max' ? 'maxReps' : 'setReps' };
  if (reps > 1000) return { error: 'That rep count looks wrong', field: type === 'max' ? 'maxReps' : 'setReps' };
  if (isNaN(added)) return { error: 'Check the added weight', field: type === 'max' ? 'maxAdded' : 'setAdded' };
  const out = { reps, date: type === 'max' ? f.maxDate : f.setDate };
  if (added > 0) out.added = added;
  return out;
}

function showError(r) {
  toast(r.error);
  const el = sheet.querySelector(`[data-field="${r.field}"]`);
  if (el) { el.focus(); el.style.borderColor = 'var(--danger)'; setTimeout(() => (el.style.borderColor = ''), 1500); }
}

async function askBodyweight() {
  const u = unit();
  const v = await modal({
    title: 'Your bodyweight',
    body: `<p>Ranks compare your Max to your bodyweight. You can change it any time in Settings.</p>
      <form><div class="field"><label for="bw-in">Bodyweight (${u})</label><input class="input" id="bw-in" type="text" inputmode="decimal" autocomplete="off"></div></form>`,
    onMount: w => setTimeout(() => w.querySelector('#bw-in').focus(), 50),
    actions: [{ label: 'Skip', value: null }, { label: 'Save', kind: 'primary', value: w => parseFloat(w.querySelector('#bw-in').value.replace(',', '.')) }],
  });
  if (v > 0 && v < 1000) store.setBodyweight(fromDisplay(v, u));
}

async function saveMax() {
  const ex = exercise(exId);
  const r = buildEntry(ex, 'max');
  if (r.error) return showError(r);
  let st = stats();
  const s = st.byEx.get(exId);
  const u = unit();
  const prev = s?.bestValue ?? null;
  const val = entryValue(ex, r, st.bwNow);
  if (prev > 0 && val > prev * 1.5) {
    const ok = await confirmDialog("That's a big jump. Save anyway?",
      `${fmtValue(ex, val, u)} is more than 50% above your Max of ${fmtValue(ex, prev, u)}.`, 'Save anyway');
    if (!ok) return;
  }
  if (isRanked(ex) && !st.hasBw && !store.settings().bwAsked) {
    store.setSetting('bwAsked', true);
    await askBodyweight();
  }
  const id = exId;
  const old = stats().byEx.get(id);
  const oldTier = old?.tierIdx ?? -1, oldStep = old?.rank?.step ?? -1;
  const entry = store.addEntry({ type: 'max', ex: id, ...r });
  st = stats();
  const s2 = st.byEx.get(id);
  celebrate = null;
  if (s2.best?.id === entry.id) {
    const text = `${ex.name} ${fmtValue(ex, s2.bestValue, u)}`;
    const gainV = prev != null ? s2.bestValue - prev : null;
    const gain = gainV != null ? `+${isWeightKind(ex.kind) ? `${fmtNum(toDisplay(gainV, u))} ${u}` : ex.kind === 'time' ? fmtSec(gainV) : `${fmtNum(gainV, 1)} reps`}` : 'First Max';
    celebrate = { max: { text, gain } };
    confetti();
  } else {
    toast(`Max saved. Your best is still ${fmtValue(ex, s2.bestValue, u)}.`);
  }
  if (s2.rank && s2.rank.step > oldStep) celebrate = { ...(celebrate || {}), rankup: { ...s2.rank, tierUp: s2.tierIdx > oldTier } };
  flashId = entry.id;
  maxOpen = false;
  if (exId === id) {
    renderSheet();
    sheet.querySelector('.sheet-body').scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function saveSet() {
  const ex = exercise(exId);
  const r = buildEntry(ex, 'set');
  if (r.error) return showError(r);
  const entry = store.addEntry({ type: 'set', ex: exId, ...r });
  flashId = entry.id;
  renderSheet();
  toast(`Set saved: ${entryText(ex, entry, unit())}`, { duration: 2000 });
}

// ---- Delete with Undo ----
function deleteEntryWithUndo(id) {
  const ex = exercise(exId);
  const res = store.deleteEntry(id);
  if (!res) return;
  if (editingId === id) editingId = null;
  toast(`Deleted ${res.entry.type === 'max' ? 'Max' : 'set'} ${entryText(ex, res.entry, unit())}`, {
    action: 'Undo', duration: 5000, onAction: () => store.restoreEntry(res),
  });
}

function saveEdit(box) {
  const ex = exercise(exId);
  const id = box.dataset.editing;
  const old = store.get().entries.find(e => e.id === id);
  if (!old) return;
  const u = unit();
  const vals = {};
  for (const el of box.querySelectorAll('[data-edit]')) vals[el.dataset.edit] = parseField(el.dataset.type, el.value, u);
  const next = { date: vals.date || old.date };
  const bad = msg => { toast(msg); return false; };
  if (isWeightKind(ex.kind)) {
    if (!(vals.kg > 0)) return bad('Enter a weight');
    next.kg = vals.kg;
    if (old.type === 'set') { if (!(vals.reps >= 1)) return bad('Enter reps'); next.reps = vals.reps; }
  } else if (ex.kind === 'time') {
    if (!(vals.sec > 0)) return bad('Enter seconds');
    next.sec = vals.sec;
  } else {
    if (!(vals.reps >= 1)) return bad('Enter reps');
    next.reps = vals.reps;
    if (vals.added > 0) next.added = vals.added;
  }
  editingId = null;
  store.updateEntry(id, next);
  flashId = id;
  renderSheet();
}

// ---- Clicks ----
async function onClick(e) {
  const unitBtn = e.target.closest('[data-unit]');
  if (unitBtn) { if (unitBtn.dataset.unit !== unit()) store.setSetting('unit', unitBtn.dataset.unit); return; }
  const entryBtn = e.target.closest('[data-entry]');
  if (entryBtn) {
    editingId = entryBtn.dataset.entry;
    renderSheet();
    const box = sheet.querySelector('.hist-edit');
    // A set tapped in "Today" is edited down in History, so bring it into view.
    if (entryBtn.classList.contains('pill')) box?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    box?.querySelector('input')?.focus({ preventScroll: true });
    return;
  }
  const a = e.target.closest('[data-act]');
  if (!a) return;
  e.preventDefault();
  const ex = exercise(exId);
  switch (a.dataset.act) {
    case 'close': return closeSheet();
    case 'save-max': return saveMax();
    case 'save-set': return saveSet();
    case 'toggle-max': {
      maxOpen = !maxOpen;
      renderSheet();
      if (maxOpen) sheet.querySelector('.max-form')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      return;
    }
    case 'edit-cancel': editingId = null; return renderSheet();
    case 'edit-save': return saveEdit(a.closest('.hist-edit'));
    case 'edit-delete': return deleteEntryWithUndo(a.closest('.hist-edit').dataset.editing);
    case 'bodyweight': closeSheet(); return hooks.openSettings('bodyweight');
    case 'full-chart': { const id = exId; closeSheet(); return hooks.showProgress(id); }
    case 'pin': store.togglePin(exId); return toast(store.get().pinned.includes(exId) ? 'Pinned to the top of Lifts' : 'Unpinned');
    case 'hide': {
      const id = exId;
      store.setHidden(id, true);
      closeSheet();
      return toast(`${ex.name} hidden. Restore it in Settings.`, { action: 'Undo', duration: 5000, onAction: () => store.setHidden(id, false) });
    }
    case 'edit-custom': {
      const res = await modal({
        title: 'Edit exercise', body: customForm(ex), onMount: wireCustomForm,
        actions: [{ label: 'Cancel', value: null }, { label: 'Save', kind: 'primary', validate: validName, value: readCustomForm }],
      });
      if (res) store.updateCustom(ex.id, res);
      return;
    }
    case 'delete-custom': {
      const n = stats().byEx.get(ex.id)?.entries.length ?? 0;
      const ok = await confirmDialog(`Delete ${ex.name}?`, n ? `This also deletes its ${n} logged ${n === 1 ? 'entry' : 'entries'}.` : 'It has no logged entries.', 'Delete', true);
      if (!ok) return;
      closeSheet();
      const snap = store.deleteCustom(ex.id);
      return toast(`Deleted ${ex.name}`, { action: 'Undo', duration: 5000, onAction: () => store.restoreCustom(snap) });
    }
    case 'share-rankup': {
      const r = celebrate?.rankup;
      if (!r) return;
      const s = stats().byEx.get(exId);
      const blob = await rankCardBlob({ heading: r.tierUp ? 'Rank up' : 'Promoted', tierIdx: r.tierIdx, name: r.name, line1: ex.name, line2: `Max ${fmtValue(ex, s.bestValue, unit())} · ${fmtShort(s.best.date)}` });
      return shareFile(new File([blob], `liftboard-${ex.id}-${r.name.toLowerCase().replace(/ /g, '-')}.png`, { type: 'image/png' }), `${r.name} on ${ex.name}`);
    }
  }
}

// ---- Gestures: swipe the header down to close ----
function wireSwipeDown() {
  let startY = null, dy = 0, pid = null;
  sheet.addEventListener('pointerdown', e => {
    if (!e.target.closest('.sheet-head') || e.target.closest('button, input')) return;
    startY = e.clientY; dy = 0; pid = e.pointerId;
    sheet.classList.add('dragging');
    try { sheet.setPointerCapture(pid); } catch {}
  });
  sheet.addEventListener('pointermove', e => {
    if (startY == null || e.pointerId !== pid) return;
    dy = Math.max(0, e.clientY - startY);
    sheet.style.transform = `translateY(${dy}px)`;
  });
  const end = e => {
    if (startY == null || e.pointerId !== pid) return;
    sheet.classList.remove('dragging');
    startY = null;
    if (dy > 100) closeSheet();
    else sheet.style.transform = '';
  };
  sheet.addEventListener('pointerup', end);
  sheet.addEventListener('pointercancel', end);
}

// ---- Gestures: swipe a history row left to delete, or long-press it ----
function wireHistoryGestures() {
  let row = null, x0 = 0, y0 = 0, dx = 0, swiping = false, swallowClick = false;
  sheet.addEventListener('pointerdown', e => {
    row = e.target.closest('.hist-row');
    if (!row) return;
    x0 = e.clientX; y0 = e.clientY; dx = 0; swiping = false;
  });
  sheet.addEventListener('pointermove', e => {
    if (!row) return;
    const mx = e.clientX - x0, my = e.clientY - y0;
    if (!swiping && Math.abs(mx) > 12 && Math.abs(mx) > Math.abs(my) * 1.5) { swiping = true; row.classList.add('swiping'); try { row.setPointerCapture(e.pointerId); } catch {} }
    if (swiping) { dx = Math.min(0, mx); row.style.transform = `translateX(${dx}px)`; }
  });
  const end = () => {
    if (!row) return;
    const r = row;
    row = null;
    if (!swiping) return;
    swallowClick = true;
    setTimeout(() => (swallowClick = false), 50);
    r.classList.remove('swiping');
    r.classList.add('settle');
    if (dx < -90) {
      r.style.transform = 'translateX(-100%)';
      setTimeout(() => deleteEntryWithUndo(r.dataset.entry), 180);
    } else {
      r.style.transform = '';
    }
  };
  sheet.addEventListener('pointerup', end);
  sheet.addEventListener('pointercancel', end);
  sheet.addEventListener('click', e => { if (swallowClick && e.target.closest('.hist-row')) { e.stopPropagation(); e.preventDefault(); } }, true);
  onLongPress(sheet, '.hist-row', r => deleteEntryWithUndo(r.dataset.entry), 550);
}
