// Tab 3: Plans. One workout plan per person, by day, with a tick per exercise,
// a rest timer, and notes. Ticks clear themselves each Monday.

import * as store from '../store.js';
import { DAYS, DAY_NAMES, todayDay, thisWeek, isDone } from '../plans.js';
import { ICONS, toast, modal, confirmDialog, confetti } from '../ui.js';
import { esc, fmtShort, fmtSec } from '../util.js';

const PICK_KEY = 'liftboard:plan-person';
const RESTS = [60, 90, 120, 180];

let root, listEl, timerEl;
let personId = null;
let editing = false;
const open = new Set(); // day ids expanded by hand
const shut = new Set(); // day ids collapsed by hand (today's day starts open)

// ---- Rest timer: counts down to a timestamp, so it keeps time while the phone sleeps ----
let restEnd = 0, restTick = null, audio = null;

function startRest(sec) {
  try { audio ??= new (window.AudioContext || window.webkitAudioContext)(); audio.resume?.(); } catch { audio = null; }
  restEnd = Date.now() + sec * 1000;
  clearInterval(restTick);
  restTick = setInterval(drawTimer, 250);
  drawTimer();
}
function stopRest() {
  restEnd = 0;
  clearInterval(restTick);
  drawTimer();
}
function beep() {
  navigator.vibrate?.([200, 100, 200]);
  if (!audio) return;
  try {
    for (const at of [0, 0.25]) {
      const o = audio.createOscillator(), g = audio.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.2, audio.currentTime + at);
      g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + at + 0.2);
      o.connect(g).connect(audio.destination);
      o.start(audio.currentTime + at);
      o.stop(audio.currentTime + at + 0.2);
    }
  } catch { /* sound is a bonus */ }
}
function drawTimer() {
  if (!timerEl) return;
  const left = restEnd ? Math.ceil((restEnd - Date.now()) / 1000) : 0;
  if (restEnd && left <= 0) {
    restEnd = 0;
    clearInterval(restTick);
    beep();
    toast('Rest over. Next set!');
  }
  if (restEnd) {
    timerEl.classList.add('running');
    timerEl.innerHTML = `<span class="rest-lbl">Rest</span><b class="rest-left">${fmtSec(left)}</b>
      <button type="button" class="btn" data-act="rest-add">+30s</button>
      <button type="button" class="btn" data-act="rest-stop">Stop</button>`;
  } else {
    timerEl.classList.remove('running');
    timerEl.innerHTML = `<span class="rest-lbl">Rest timer</span>
      ${RESTS.map(s => `<button type="button" class="chip" data-rest="${s}">${s < 120 ? `${s}s` : `${s / 60} min`}</button>`).join('')}`;
  }
}

// ---- Setup ----
export function initPlans(el) {
  root = el;
  try { personId = localStorage.getItem(PICK_KEY); } catch { /* per-phone convenience only */ }
  root.innerHTML = `
    <div class="plans-top">
      <div class="chips" id="plan-people" role="tablist" aria-label="Person"></div>
      <div class="rest" id="rest" aria-live="off"></div>
    </div>
    <div id="plans-list"></div>`;
  listEl = root.querySelector('#plans-list');
  timerEl = root.querySelector('#rest');
  drawTimer();
  root.addEventListener('click', onClick);
  root.addEventListener('change', e => {
    const box = e.target.closest('[data-tick]');
    if (box) tick(box.dataset.tick, box.closest('[data-day]').dataset.day);
  });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') drawTimer(); });
}

const people = () => store.get().plans;
const current = () => people().find(p => p.id === personId) ?? people()[0] ?? null;

function pick(id) {
  personId = id;
  editing = false;
  try { localStorage.setItem(PICK_KEY, id); } catch { /* ignore */ }
  renderPlans();
  document.getElementById('main').scrollTop = 0;
}

// ---- Render ----
export function renderPlans() {
  if (!listEl) return;
  const p = current();
  root.querySelector('#plan-people').innerHTML =
    people().map(x => `<button type="button" class="chip" role="tab" data-person="${esc(x.id)}" aria-pressed="${x === p}" aria-selected="${x === p}">${esc(x.name)}</button>`).join('')
    + `<button type="button" class="chip add-chip" data-act="add-person" aria-label="Add person">${ICONS.plus}</button>`;

  if (!p) {
    listEl.innerHTML = `<div class="empty"><p>No plans yet. Add a person to start their plan.</p>
      <button type="button" class="btn primary" data-act="add-person">${ICONS.plus} Add person</button></div>`;
    return;
  }

  const items = p.days.flatMap(d => d.items);
  const done = items.filter(isDone).length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;
  const t = todayDay();

  let html = `<div class="card plan-head">
    <div class="card-h"><h3>${esc(p.name)}'s plan</h3>
      <button type="button" class="btn ${editing ? 'primary' : ''} small" data-act="edit">${editing ? 'Done' : `${ICONS.edit} Edit`}</button></div>
    <div class="plan-week"><span><b>${done}</b> of ${items.length} ticked this week</span><span class="aside">Week of ${fmtShort(thisWeek())}</span></div>
    <div class="bar"><i style="width:${pct}%"></i></div>
    <p class="note">Ticks clear every Monday. ${done ? '<a href="#" class="link" data-act="clear">Clear now</a>' : ''}</p>
    ${editing ? `<div class="plan-edit-row">
      <button type="button" class="btn" data-act="rename">Rename</button>
      <button type="button" class="btn danger-soft" data-act="delete-person">Delete ${esc(p.name)}</button></div>` : ''}
  </div>`;

  for (const d of p.days) html += dayHTML(p, d, t);
  if (editing) {
    html += `<div class="rows plan-add"><button type="button" class="row add-row" data-act="add-day">${ICONS.plus} Add day</button></div>`;
  } else if (!p.days.length) {
    html += `<div class="empty"><p>${esc(p.name)} has no days yet.</p><button type="button" class="btn primary" data-act="add-day">${ICONS.plus} Add a day</button></div>`;
  }

  if (p.notes.length || editing) {
    html += `<div class="card plan-notes"><div class="card-h"><h3>Notes</h3>
      ${editing ? '<button type="button" class="btn small" data-act="notes">Edit notes</button>' : ''}</div>
      ${p.notes.length ? `<ul>${p.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul>` : '<p class="note">Add tips, like rest times or when to add weight.</p>'}
    </div>`;
  }
  listEl.innerHTML = html;
}

function dayHTML(p, d, t) {
  const done = d.items.filter(isDone).length;
  const isToday = d.day === t;
  const complete = d.items.length > 0 && done === d.items.length;
  const expanded = editing || open.has(d.id) || (!shut.has(d.id) && (isToday || !d.day || p.days.length === 1));
  const label = d.day ? DAY_NAMES[d.day] : 'Any day';
  const rows = d.items.map(i => `<div class="plan-item ${isDone(i) ? 'done' : ''}">
      <label class="tickbox"><input type="checkbox" data-tick="${esc(i.id)}" ${isDone(i) ? 'checked' : ''}${editing ? ' disabled' : ''}><span class="box">${ICONS.check}</span>
        <span class="plan-txt"><span class="nm">${esc(i.text)}</span>${i.detail ? `<span class="dt">${esc(i.detail)}</span>` : ''}</span></label>
      ${editing ? `<button type="button" class="icon-btn" data-act="edit-item" data-item="${esc(i.id)}" aria-label="Edit ${esc(i.text)}">${ICONS.edit}</button>
        <button type="button" class="icon-btn" data-act="delete-item" data-item="${esc(i.id)}" aria-label="Delete ${esc(i.text)}">${ICONS.trash}</button>` : ''}
    </div>`).join('');
  return `<section class="plan-day ${isToday ? 'today' : ''} ${complete ? 'complete' : ''}" data-day="${esc(d.id)}">
    <button type="button" class="plan-day-h" data-act="toggle" aria-expanded="${expanded}">
      <span class="dow">${d.day ? esc(d.day) : ICONS.list}</span>
      <span class="grow"><span class="ttl">${esc(d.title || label)}</span><span class="sub">${esc(label)}${isToday ? ' · <b>Today</b>' : ''}</span></span>
      <span class="cnt">${complete ? ICONS.check : `${done}/${d.items.length}`}</span>
    </button>
    ${expanded ? `<div class="plan-items">${rows}
      ${editing ? `<div class="plan-edit-row">
        <button type="button" class="btn primary-soft" data-act="add-item">${ICONS.plus} Add exercise</button>
        <button type="button" class="btn" data-act="edit-day">Edit day</button>
        <button type="button" class="btn danger-soft" data-act="delete-day">Delete</button></div>` : ''}
      ${!editing && !d.items.length ? '<p class="note" style="padding:0 14px 12px">Nothing here yet. Tap Edit to add exercises.</p>' : ''}
    </div>` : ''}
  </section>`;
}

// ---- Actions ----
function tick(itemId, dayId) {
  const p = current();
  const on = store.togglePlanItem(p.id, itemId);
  const d = p.days.find(x => x.id === dayId);
  if (on && d && d.items.every(isDone)) {
    confetti();
    toast(d.day ? `${DAY_NAMES[d.day]} done. Nice work!` : 'All done. Nice work!');
  }
}

function onClick(e) {
  const rest = e.target.closest('[data-rest]');
  if (rest) return startRest(Number(rest.dataset.rest));
  const who = e.target.closest('[data-person]');
  if (who) return pick(who.dataset.person);
  const a = e.target.closest('[data-act]');
  if (!a) return;
  if (a.tagName === 'A') e.preventDefault();
  const p = current();
  const dayId = a.closest('[data-day]')?.dataset.day;
  const day = p?.days.find(d => d.id === dayId);
  switch (a.dataset.act) {
    case 'rest-add': restEnd += 30000; drawTimer(); break;
    case 'rest-stop': stopRest(); break;
    case 'add-person': addPersonFlow(); break;
    case 'edit': editing = !editing; renderPlans(); break;
    case 'clear': clearFlow(p); break;
    case 'rename': renameFlow(p); break;
    case 'delete-person': deletePersonFlow(p); break;
    case 'toggle': {
      const wasOpen = a.getAttribute('aria-expanded') === 'true';
      if (wasOpen) { open.delete(dayId); shut.add(dayId); } else { shut.delete(dayId); open.add(dayId); }
      renderPlans();
      break;
    }
    case 'add-day': dayFlow(p); break;
    case 'edit-day': dayFlow(p, day); break;
    case 'delete-day': deleteDayFlow(p, day); break;
    case 'add-item': itemFlow(p, day); break;
    case 'edit-item': itemFlow(p, day, day.items.find(i => i.id === a.dataset.item)); break;
    case 'delete-item': {
      const snap = store.deletePlanItem(p.id, day.id, a.dataset.item);
      if (snap) toast(`Deleted ${snap.item.text}`, { action: 'Undo', duration: 5000, onAction: () => store.restorePlanItem(snap) });
      break;
    }
    case 'notes': notesFlow(p); break;
  }
}

function required(wrap) {
  const input = wrap.querySelector('[required]');
  if (input.value.trim()) return true;
  input.focus();
  input.style.borderColor = 'var(--danger)';
  return false;
}
const focusFirst = wrap => setTimeout(() => wrap.querySelector('input, textarea')?.focus(), 50);

async function addPersonFlow() {
  const name = await modal({
    title: 'Add person',
    body: `<form novalidate><div class="field"><label for="pp-name">Name</label><input class="input" id="pp-name" maxlength="40" required autocomplete="off"></div></form>`,
    onMount: focusFirst,
    actions: [{ label: 'Cancel', value: null }, { label: 'Add', kind: 'primary', validate: required, value: w => w.querySelector('#pp-name').value }],
  });
  if (!name) return;
  const p = store.addPerson(name);
  pick(p.id);
  editing = true;
  renderPlans();
}

async function renameFlow(p) {
  const name = await modal({
    title: 'Rename',
    body: `<form novalidate><div class="field"><label for="pp-name">Name</label><input class="input" id="pp-name" maxlength="40" required autocomplete="off" value="${esc(p.name)}"></div></form>`,
    onMount: focusFirst,
    actions: [{ label: 'Cancel', value: null }, { label: 'Save', kind: 'primary', validate: required, value: w => w.querySelector('#pp-name').value }],
  });
  if (name) store.renamePerson(p.id, name);
}

async function deletePersonFlow(p) {
  if (!await confirmDialog(`Delete ${p.name}?`, `This removes ${p.name}'s whole plan and notes.`, 'Delete', true)) return;
  const snap = store.deletePerson(p.id);
  editing = false;
  toast(`Deleted ${p.name}`, { action: 'Undo', duration: 6000, onAction: () => { store.restorePerson(snap); pick(snap.person.id); } });
}

async function clearFlow(p) {
  if (!await confirmDialog('Clear ticks?', `Untick everything in ${p.name}'s plan for this week.`, 'Clear')) return;
  store.clearPlanWeek(p.id);
}

async function dayFlow(p, d) {
  const opts = [['', 'Any day'], ...DAYS.map(x => [x, DAY_NAMES[x]])]
    .map(([v, l]) => `<option value="${v}" ${(d?.day ?? todayDay()) === v ? 'selected' : ''}>${l}</option>`).join('');
  const res = await modal({
    title: d ? 'Edit day' : 'Add day',
    body: `<form novalidate>
      <div class="field"><label for="pd-day">Day</label><select class="input" id="pd-day">${opts}</select></div>
      <div class="field" style="margin-top:10px"><label for="pd-title">Workout name</label><input class="input" id="pd-title" maxlength="60" placeholder="e.g. Legs" autocomplete="off" value="${esc(d?.title ?? '')}"></div>
    </form>`,
    actions: [{ label: 'Cancel', value: null }, { label: d ? 'Save' : 'Add', kind: 'primary', value: w => ({ day: w.querySelector('#pd-day').value, title: w.querySelector('#pd-title').value }) }],
  });
  if (!res) return;
  if (d) store.updatePlanDay(p.id, d.id, res.day, res.title);
  else open.add(store.addPlanDay(p.id, res.day, res.title).id);
}

async function deleteDayFlow(p, d) {
  const name = d.title || (d.day ? DAY_NAMES[d.day] : 'this day');
  if (d.items.length && !await confirmDialog(`Delete ${name}?`, `Its ${d.items.length} exercises go with it.`, 'Delete', true)) return;
  store.deletePlanDay(p.id, d.id);
}

async function itemFlow(p, d, item) {
  const res = await modal({
    title: item ? 'Edit exercise' : 'Add exercise',
    body: `<form novalidate>
      <div class="field"><label for="pi-text">Exercise or task</label><input class="input" id="pi-text" maxlength="80" required autocomplete="off" value="${esc(item?.text ?? '')}"></div>
      <div class="field" style="margin-top:10px"><label for="pi-detail">Sets × reps (optional)</label><input class="input" id="pi-detail" maxlength="40" placeholder="e.g. 3×8–12" autocomplete="off" value="${esc(item?.detail ?? '')}"></div>
    </form>`,
    onMount: focusFirst,
    actions: [{ label: 'Cancel', value: null }, { label: item ? 'Save' : 'Add', kind: 'primary', validate: required, value: w => ({ text: w.querySelector('#pi-text').value, detail: w.querySelector('#pi-detail').value }) }],
  });
  if (!res) return;
  if (item) store.updatePlanItem(p.id, d.id, item.id, res.text, res.detail);
  else store.addPlanItem(p.id, d.id, res.text, res.detail);
}

async function notesFlow(p) {
  const text = await modal({
    title: 'Notes',
    body: `<form novalidate><div class="field"><label for="pn-text">One note per line</label>
      <textarea class="input textarea" id="pn-text" rows="7">${esc(p.notes.join('\n'))}</textarea></div></form>`,
    onMount: focusFirst,
    actions: [{ label: 'Cancel', value: null }, { label: 'Save', kind: 'primary', value: w => w.querySelector('#pn-text').value }],
  });
  if (text != null) store.setPlanNotes(p.id, text.split('\n'));
}
