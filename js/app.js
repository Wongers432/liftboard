// Start-up, tab switching, theme, welcome screen and service-worker updates.

import * as store from './store.js';
import { ICONS, toast, modal } from './ui.js';
import { unit } from './state.js';
import { fromDisplay } from './util.js';
import { initLifts, renderLifts } from './views/lifts.js';
import { initSheet, openSheet, closeSheet, renderSheet, openExerciseId } from './views/sheet.js';
import { initProgress, renderProgress, pickExercise } from './views/progress.js';
import { initSettings, openSettings, renderSettings, settingsOpen, closeSettings } from './views/settings.js';

const main = document.getElementById('main');
const views = { lifts: document.getElementById('view-lifts'), progress: document.getElementById('view-progress') };
let tab = 'lifts';
let progressDirty = true;
const scrollPos = { lifts: 0, progress: 0 };

// ---- Theme ----
function applyTheme() {
  const t = store.settings().theme;
  if (t === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.dataset.theme = t;
  const dark = t === 'dark' || (t === 'system' && !matchMedia('(prefers-color-scheme: light)').matches);
  document.querySelector('meta[name="theme-color"]').content = dark ? '#0b0b0f' : '#f2f2f7';
}
matchMedia('(prefers-color-scheme: light)').addEventListener?.('change', () => {
  applyTheme();
  progressDirty = true;
  if (tab === 'progress') renderProgress();
});

// ---- Tabs ----
export function showTab(name) {
  if (name === tab) { main.scrollTo({ top: 0, behavior: 'smooth' }); return; }
  scrollPos[tab] = main.scrollTop;
  tab = name;
  for (const [k, el] of Object.entries(views)) el.hidden = k !== name;
  document.querySelectorAll('.tab').forEach(b => (b.dataset.tab === name ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current')));
  if (name === 'progress' && progressDirty) { renderProgress(); progressDirty = false; }
  main.scrollTop = scrollPos[name];
}

function showProgressFor(id) {
  pickExercise(id);
  if (tab === 'progress') { renderProgress(); progressDirty = false; }
  else { progressDirty = true; showTab('progress'); }
  requestAnimationFrame(() => document.getElementById('max-card-p')?.scrollIntoView({ block: 'start' }));
}

// ---- Welcome (first launch from the home screen) ----
function showWelcome() {
  const el = document.getElementById('welcome');
  el.hidden = false;
  const render = () => {
    const u = unit();
    el.innerHTML = `<div class="page-body">
      <h2>Welcome to <span style="color:var(--accent)">Liftboard</span></h2>
      <p class="lead">Log your lifts, track your Max and rank up from Bronze to Champion. Everything stays on this phone.</p>
      <div class="field"><label>Units</label><div class="seg" role="group">
        <button type="button" data-u="kg" aria-pressed="${u === 'kg'}">kg</button><button type="button" data-u="lb" aria-pressed="${u === 'lb'}">lb</button></div></div>
      <div class="field"><label for="wl-bw">Bodyweight (${u}), used for your rank</label>
        <input class="input" id="wl-bw" type="text" inputmode="decimal" autocomplete="off" placeholder="Optional"></div>
      <button type="button" class="btn primary block" data-go="1">Start lifting</button>
      <button type="button" class="btn ghost block" data-go="0" style="margin-top:8px">Skip</button>
    </div>`;
  };
  render();
  el.onclick = e => {
    const ub = e.target.closest('[data-u]');
    if (ub) {
      const keep = el.querySelector('#wl-bw').value;
      store.setSetting('unit', ub.dataset.u);
      render();
      el.querySelector('#wl-bw').value = keep;
      return;
    }
    const go = e.target.closest('[data-go]');
    if (!go) return;
    if (go.dataset.go === '1') {
      const v = Number(el.querySelector('#wl-bw').value.trim().replace(',', '.'));
      if (v > 0 && v < 1000) { store.setBodyweight(fromDisplay(v, unit())); store.setSetting('bwAsked', true); }
    }
    store.setSetting('welcomed', true);
    el.hidden = true;
    el.innerHTML = '';
  };
}

// ---- Service worker: offline + "Update ready" ----
function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  const bar = document.getElementById('update-bar');
  let updating = false;
  const offer = worker => {
    bar.hidden = false;
    bar.onclick = () => { updating = true; bar.textContent = 'Updating…'; worker.postMessage('skip'); };
  };
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (updating) location.reload(); });
  navigator.serviceWorker.register('./sw.js').then(reg => {
    if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w); });
    });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
  }).catch(err => console.warn('Service worker not registered', err));
}

// ---- Start ----
function start() {
  applyTheme();
  document.querySelectorAll('[data-icon]').forEach(el => (el.innerHTML = ICONS[el.dataset.icon]));
  document.getElementById('open-settings').innerHTML = ICONS.gear;
  document.getElementById('open-settings').addEventListener('click', () => openSettings());
  document.querySelector('.tabbar').addEventListener('click', e => {
    const b = e.target.closest('[data-tab]');
    if (b) showTab(b.dataset.tab);
  });

  const hooks = {
    openSheet,
    openSettings: section => { closeSheet(); openSettings(section); },
    showTab,
    showProgress: showProgressFor,
  };
  initLifts(views.lifts, hooks);
  initSheet(hooks);
  initProgress(views.progress, hooks);
  initSettings(hooks);
  renderLifts();

  store.on((type, detail) => {
    if (type === 'error') { toast(detail, { duration: 6000 }); return; }
    if (type === 'import' || type === 'reset') { closeSheet(); }
    applyTheme();
    renderLifts();
    if (openExerciseId()) renderSheet();
    if (tab === 'progress') { renderProgress(); progressDirty = false; } else progressDirty = true;
    if (settingsOpen()) renderSettings();
  });

  if (!store.isStorageOk()) {
    modal({ title: 'Storage unavailable', body: '<p>This browser is blocking storage, so nothing you log can be saved. Turn off Private Browsing or install the app to the home screen.</p>' });
  }
  if (!store.settings().welcomed && navigator.standalone !== false) showWelcome();
  registerSW();

  // Midnight rollover: dates default to "today", so refresh when the app comes back.
  let day = new Date().toDateString();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || new Date().toDateString() === day) return;
    day = new Date().toDateString();
    renderLifts();
    progressDirty = true;
    if (tab === 'progress') { renderProgress(); progressDirty = false; }
    if (openExerciseId()) openSheet(openExerciseId());
  });
  if (settingsOpen()) closeSettings();
}

start();
