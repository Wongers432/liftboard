// Settings page (gear icon): units, bodyweight, standards, step, theme, hidden, backup, danger zone.

import * as store from '../store.js';
import { exercise, unit } from '../state.js';
import { ICONS, toast, modal, confirmDialog, shareFile } from '../ui.js';
import { esc, fmtShort, fmtNum, toDisplay, fromDisplay, today, addDays, uid } from '../util.js';

export const APP_VERSION = '1.0.0';
let page, hooks;

export function initSettings(hookFns) {
  hooks = hookFns;
  page = document.getElementById('settings');
  page.addEventListener('click', onClick);
  page.addEventListener('change', onChange);
  page.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'bw-input') e.target.blur(); });
}

export const settingsOpen = () => page && !page.hidden;

export function openSettings(section) {
  page.hidden = false;
  renderSettings();
  const body = page.querySelector('.page-body');
  body.scrollTop = 0;
  if (section) {
    const el = page.querySelector(`[data-section="${section}"]`);
    if (el) body.scrollTop = el.offsetTop - 12;
    if (section === 'bodyweight') setTimeout(() => page.querySelector('#bw-input')?.focus(), 100);
  }
}
export function closeSettings() { page.hidden = true; page.innerHTML = ''; }

const seg = (name, value, options) =>
  `<div class="seg" role="group">${options.map(([v, l]) => `<button type="button" data-set="${name}" data-val="${v}" aria-pressed="${String(v) === String(value)}">${l}</button>`).join('')}</div>`;

export function renderSettings() {
  if (!settingsOpen()) return;
  const d = store.get();
  const s = d.settings;
  const u = s.unit;
  const bw = store.currentBodyweight();
  const stepKey = u === 'lb' ? 'stepLb' : 'step';
  const hidden = d.hidden.map(id => exercise(id)).filter(Boolean);
  const dev = new URLSearchParams(location.search).has('dev');
  const keep = page.querySelector('.page-body')?.scrollTop ?? 0;
  const focused = document.activeElement?.id;

  page.innerHTML = `
    <div class="page-head"><button type="button" class="icon-btn" data-act="close" aria-label="Back">${ICONS.back}</button><h2>Settings</h2></div>
    <div class="page-body">
      <div class="set-group"><h3>Units and body</h3><div class="set-card">
        <div class="set-row"><div class="grow">Units</div>${seg('unit', u, [['kg', 'kg'], ['lb', 'lb']])}</div>
        <div class="set-row" data-section="bodyweight"><div class="grow">Bodyweight<div class="s">${bw ? `Updated ${fmtShort(bw.date)}` : `Not set: ranks assume ${fmtNum(toDisplay(s.standards === 'women' ? 65 : 80, u))} ${u}`}</div></div>
          <input class="input" id="bw-input" type="text" inputmode="decimal" autocomplete="off" placeholder="${u}" value="${bw ? fmtNum(toDisplay(bw.kg, u), 1) : ''}" aria-label="Bodyweight in ${u}"></div>
        <div class="set-row"><div class="grow">Rank standards</div>${seg('standards', s.standards, [['men', "Men's"], ['women', "Women's"]])}</div>
        <div class="set-row"><div class="grow">Weight step<div class="s">For the − and + buttons</div></div>
          <select class="input" id="step-select" aria-label="Weight step">${[1, 1.25, 2.5, 5].map(v => `<option value="${v}" ${s[stepKey] === v ? 'selected' : ''}>${v} ${u}</option>`).join('')}</select></div>
      </div></div>

      <div class="set-group"><h3>Appearance</h3><div class="set-card">
        <div class="set-row"><div class="grow">Theme</div>${seg('theme', s.theme, [['system', 'System'], ['dark', 'Dark'], ['light', 'Light']])}</div>
      </div></div>

      <div class="set-group"><h3>Hidden exercises</h3><div class="set-card">
        ${hidden.length ? hidden.map(ex => `<div class="set-row"><div class="grow">${esc(ex.name)}</div><button type="button" class="btn" data-act="unhide" data-id="${esc(ex.id)}">Restore</button></div>`).join('')
          : '<div class="set-row"><div class="grow s" style="color:var(--text-2)">None. Hide an exercise from its detail sheet.</div></div>'}
      </div></div>

      <div class="set-group" data-section="backup"><h3>Backup</h3><div class="set-card">
        <div class="set-row"><div class="grow">Export data<div class="s">${d.lastBackup ? `Last backup ${fmtShort(d.lastBackup)}` : 'Never backed up'} · ${d.entries.length} entries</div></div><button type="button" class="btn primary" data-act="export">Export</button></div>
        <div class="set-row"><div class="grow">Import data<div class="s">From a Liftboard .json file</div></div><button type="button" class="btn" data-act="import">Import</button>
          <input type="file" id="import-file" accept="application/json,.json" hidden></div>
        <div class="set-row"><div class="grow s" style="color:var(--text-2)">Deleting the home-screen icon deletes all your logs. Export a backup to Files or iCloud Drive regularly.</div></div>
      </div></div>

      <div class="set-group"><h3>Danger zone</h3><div class="set-card">
        <div class="set-row"><div class="grow">Delete all data</div><button type="button" class="btn danger" data-act="delete-all">Delete</button></div>
      </div></div>

      ${dev ? `<div class="set-group"><h3>Developer</h3><div class="set-card">
        <div class="set-row"><div class="grow">Sample data<div class="s">6 months on 8 lifts, replaces your data</div></div><button type="button" class="btn" data-act="sample">Fill</button></div>
        <div class="set-row"><div class="grow">Stress test<div class="s">About 3,000 sets</div></div><button type="button" class="btn" data-act="sample-big">Fill</button></div>
      </div></div>` : ''}

      <div class="set-group"><h3>About</h3><div class="set-card">
        <div class="set-row"><div class="grow">Liftboard<div class="s">Version ${APP_VERSION}</div></div></div>
        <div class="set-row"><div class="grow s" style="color:var(--text-2)">Data is stored only on this phone. No accounts, no tracking, works offline.</div></div>
      </div></div>
    </div>`;
  page.querySelector('.page-body').scrollTop = keep;
  if (focused && focused !== 'bw-input') page.querySelector(`#${focused}`)?.focus({ preventScroll: true });
}

function onChange(e) {
  const t = e.target;
  if (t.id === 'bw-input') {
    const raw = t.value.trim().replace(',', '.');
    if (raw === '') return;
    const v = Number(raw);
    if (!(v > 0 && v < 1000)) { toast('Enter a bodyweight like 80'); return; }
    store.setBodyweight(fromDisplay(v, unit()));
    toast('Bodyweight saved');
  } else if (t.id === 'step-select') {
    store.setSetting(unit() === 'lb' ? 'stepLb' : 'step', Number(t.value));
  } else if (t.id === 'import-file') {
    const file = t.files?.[0];
    t.value = '';
    if (file) importFlow(file);
  }
}

async function onClick(e) {
  const segBtn = e.target.closest('[data-set]');
  if (segBtn) { store.setSetting(segBtn.dataset.set, segBtn.dataset.val); return; }
  const a = e.target.closest('[data-act]');
  if (!a) return;
  switch (a.dataset.act) {
    case 'close': return closeSettings();
    case 'unhide': store.setHidden(a.dataset.id, false); return toast('Restored to the Lifts list');
    case 'export': {
      const ok = await shareFile(store.exportFile(), 'Liftboard backup');
      if (ok) { store.markBackup(); toast('Backup exported'); }
      return;
    }
    case 'import': return page.querySelector('#import-file').click();
    case 'delete-all': return deleteAllFlow();
    case 'sample': return fillSample(false);
    case 'sample-big': return fillSample(true);
  }
}

async function importFlow(file) {
  let info;
  try {
    info = store.parseImport(await file.text());
  } catch (err) {
    return modal({ title: "Can't import that file", body: `<p>${esc(err.message)}</p>` });
  }
  const range = info.from ? ` from ${fmtShort(info.from)} to ${fmtShort(info.to)}` : '';
  const choice = await modal({
    title: 'Import backup',
    body: `<p>${info.sets} sets and ${info.maxes} maxes${range}.</p><p style="margin-top:8px">Replace your current data, or Merge (keeps everything, skips duplicates)?</p>`,
    actions: [{ label: 'Cancel', value: null }, { label: 'Merge', value: 'merge', kind: 'primary' }, { label: 'Replace', value: 'replace', kind: 'danger' }],
  });
  if (!choice) return;
  if (choice === 'replace' && store.get().entries.length) {
    const ok = await confirmDialog('Replace all data?', `Your current ${store.get().entries.length} entries will be replaced by the file.`, 'Replace', true);
    if (!ok) return;
  }
  const before = store.get().entries.length;
  store.importData(info.data, choice);
  const after = store.get().entries.length;
  toast(choice === 'merge' ? `Merged: ${after - before} new ${after - before === 1 ? 'entry' : 'entries'} added` : `Imported ${after} entries`);
}

async function deleteAllFlow() {
  const ok = await modal({
    title: 'Delete all data?',
    body: `<p>This removes every set, Max, bodyweight and custom exercise from this phone. It can't be undone.</p>
      <form><div class="field"><label for="del-confirm">Type DELETE to confirm</label><input class="input" id="del-confirm" autocomplete="off" autocapitalize="characters" spellcheck="false"></div></form>`,
    actions: [
      { label: 'Cancel', value: false },
      { label: 'Delete everything', kind: 'danger', value: true, validate: w => w.querySelector('#del-confirm').value.trim() === 'DELETE' || (toast('Type DELETE in capitals to confirm'), false) },
    ],
  });
  if (!ok) return;
  store.deleteAll();
  toast('All data deleted');
}

// ---- ?dev sample data: realistic sets progressing about 1% a week ----
export function sampleData({ big = false, endDate = today() } = {}) {
  const lifts = [
    { ex: 'bench-press', start: 80, day: 0 }, { ex: 'overhead-press', start: 50, day: 0 }, { ex: 'dumbbell-curl', start: 14, day: 0 },
    { ex: 'deadlift', start: 130, day: 1 }, { ex: 'barbell-row', start: 70, day: 1 }, { ex: 'lat-pulldown', start: 65, day: 1 },
    { ex: 'squat', start: 105, day: 2 }, { ex: 'pull-up', start: 8, day: 1, reps: true },
  ];
  let seed = 42;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const r25 = x => Math.round(x / 2.5) * 2.5;
  const weeks = 26;
  const start = addDays(endDate, -weeks * 7 + 1);
  const entries = [];
  const days = big ? [0, 1, 2, 3, 4, 5] : [0, 2, 4, 5];
  const setsPer = big ? 9 : 4;
  for (let w = 0; w < weeks; w++) {
    const f = 1 + 0.01 * w;
    days.forEach((dow, i) => {
      if (rnd() < 0.12) return; // skipped a session
      const date = addDays(start, w * 7 + dow);
      if (date > endDate) return;
      for (const l of lifts.filter(x => x.day === i % 3)) {
        if (l.reps) {
          for (let k = 0; k < 3; k++) entries.push({ id: uid('e'), type: 'set', ex: l.ex, date, reps: Math.max(1, Math.round(l.start * f * 0.8) - k) });
          if (w % 4 === 3) entries.push({ id: uid('e'), type: 'max', ex: l.ex, date, reps: Math.round(l.start * f) });
          continue;
        }
        const oneRm = l.start * f;
        for (let k = 0; k < setsPer; k++) {
          const reps = [5, 5, 6, 8, 8, 10][k % 6];
          entries.push({ id: uid('e'), type: 'set', ex: l.ex, date, kg: Math.max(2.5, r25(oneRm * (0.86 - reps * 0.012))), reps });
        }
        if (w % 4 === 3 && rnd() < 0.8) entries.push({ id: uid('e'), type: 'max', ex: l.ex, date, kg: r25(oneRm) });
      }
    });
  }
  const bodyweight = [];
  for (let m = 0; m < 6; m++) bodyweight.push({ date: addDays(start, m * 30), kg: Math.round((78 + m * 0.4) * 10) / 10 });
  return { version: 1, settings: { ...store.settings(), welcomed: true }, bodyweight, entries, custom: [], pinned: ['bench-press', 'squat', 'deadlift'], hidden: [], lastBackup: endDate };
}

async function fillSample(big) {
  const ok = await confirmDialog('Replace with sample data?', 'Your current data will be replaced.', 'Fill', true);
  if (!ok) return;
  const t0 = performance.now();
  store.replaceAll(sampleData({ big }));
  toast(`Filled ${store.get().entries.length} entries in ${Math.round(performance.now() - t0)} ms`);
}
