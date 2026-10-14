// Tab 2: Progress. Overall rank, stat tiles, radar, Max chart, weekly volume, heatmap, records, ranks.

import * as store from '../store.js';
import { GROUPS } from '../exercises.js';
import { stats, unit } from '../state.js';
import { TIERS, isWeightKind, thresholds } from '../ranks.js';
import { streakWeeks, newMaxesThisMonth, weeklyVolume, heatmap, maxSeries } from '../stats.js';
import { maxChart, volumeChart, radarChart, heatmapSVG, TIER_HEX } from '../charts.js';
import { ICONS, badge, rankCardBlob, shareFile, entryText } from '../ui.js';
import { esc, fmtShort, fmtTotal, fmtNum, fmtSec, toDisplay, today } from '../util.js';

let root, hooks;
let picked = null; // exercise id shown in the Max chart

export function initProgress(el, hookFns) {
  root = el;
  hooks = hookFns;
  root.addEventListener('click', onClick);
  root.addEventListener('change', e => {
    if (e.target.id === 'max-picker') { picked = e.target.value; renderMaxCard(); }
  });
}

export function pickExercise(id) { picked = id; }

function defaultPick(st) {
  let best = null;
  for (const s of st.byEx.values()) {
    const score = s.entries.length + (s.maxes.length ? 1e6 : 0); // prefer lifts with a Max
    if (!best || score > best.score) best = { id: s.ex.id, score };
  }
  return best?.id ?? null;
}

export function renderProgress() {
  if (!root) return;
  const st = stats();
  const u = unit();
  const d = store.get();

  if (!st.byEx.size) {
    root.innerHTML = `<div class="progress"><div class="card empty">
      <p style="font-size:19px;font-weight:700;color:var(--text);margin-bottom:6px">No lifts yet</p>
      <p>Log your first set on the Lifts tab to unlock your rank.</p>
      <button type="button" class="btn primary" data-act="go-lifts">Go to Lifts</button></div></div>`;
    return;
  }
  if (!picked || !st.byEx.has(picked)) picked = defaultPick(st);

  // 1. Overall rank
  const o = st.overall;
  let overall;
  if (o.ranked) {
    const next = o.tierIdx < 5 ? `${o.pct}% to ${TIERS[o.tierIdx + 1]}` : 'Top tier';
    overall = `<div class="card overall tier-${o.tierIdx}">${badge(o.tierIdx, 'lg')}
      <div class="tier-name tier-text">${TIERS[o.tierIdx]}</div>
      <div class="score">${TIERS[o.tierIdx]} · ${o.display.toFixed(2)}</div>
      <div class="bar"><i style="width:${o.tierIdx < 5 ? o.pct : 100}%"></i></div>
      <div class="to-next">${next}</div>
      <button type="button" class="btn" data-act="share-overall">${ICONS.share} Share</button>
    </div>`;
  } else {
    overall = `<div class="card overall"><div class="tier-name" style="color:var(--text-2)">Unranked</div>
      <p class="score" style="margin-top:6px">Log a Max in 3 muscle groups to get ranked.</p>
      <div class="bar"><i style="width:${(o.groupsRanked / 3) * 100}%"></i></div>
      <div class="to-next">${o.groupsRanked} of 3 groups</div></div>`;
  }
  const bwNote = !st.hasBw ? `<p class="note" style="margin:-4px 4px 12px">Ranks assume ${fmtNum(toDisplay(st.bwNow, u))} ${u}. <a href="#" data-act="bodyweight">Set your bodyweight</a> for an accurate rank.</p>` : '';

  // 2. Stat tiles
  const tiles = `<div class="tiles4">
    <div class="tile"><div class="k">Workouts</div><div class="v">${st.workoutDays.size}</div></div>
    <div class="tile"><div class="k">Current streak</div><div class="v">${streakWeeks(st.workoutDays, st.today)} <small>wk</small></div></div>
    <div class="tile"><div class="k">New Maxes this month</div><div class="v">${newMaxesThisMonth(st.prs, st.today)}</div></div>
    <div class="tile"><div class="k">Total lifted</div><div class="v">${fmtTotal(st.totalVolume, u)}</div></div>
  </div>`;

  // 3. Radar
  const radar = `<div class="card"><div class="card-h"><h3>Strength balance</h3><span class="aside">Score 0–6 per group</span></div><div class="chart-box radar"><canvas id="radar"></canvas></div></div>`;

  // 4. Max chart (filled by renderMaxCard)
  const maxCard = `<div class="card" id="max-card-p"></div>`;

  // 5. Weekly volume
  const vol = `<div class="card"><div class="card-h"><h3>Weekly volume</h3><span class="aside">Last 12 weeks · ${u}</span></div><div class="chart-box vol"><canvas id="vol"></canvas></div></div>`;

  // 6. Heatmap
  const cal = `<div class="card"><div class="card-h"><h3>Training calendar</h3><span class="aside">Last 20 weeks</span></div>${heatmapSVG(heatmap(st.workoutDays, st.dayVolume, st.today), u)}</div>`;

  // 7. Recent records
  const recs = st.prs.slice(0, 10).map(p => {
    const ex = st.lib.get(p.ex);
    const gain = p.gain == null ? 'First Max' : `+${isWeightKind(ex.kind) ? `${fmtNum(toDisplay(p.gain, u))} ${u}` : ex.kind === 'time' ? fmtSec(p.gain) : `${fmtNum(p.gain, 1)} reps`}`;
    return `<button type="button" class="li" data-ex="${esc(ex.id)}"><div class="grow"><div class="t">${esc(ex.name)} ${esc(entryText(ex, p.entry, u))}</div><div class="s">${fmtShort(p.date)}</div></div><div class="r gain">${esc(gain)}</div></button>`;
  }).join('');
  const records = `<div class="card"><div class="card-h"><h3>Recent records</h3></div>${recs ? `<div class="list">${recs}</div>` : '<p class="note">Log a Max to see your records here.</p>'}</div>`;

  // 8. Exercise ranks
  const ranked = [...st.byEx.values()].filter(s => s.tierIdx != null).sort((a, b) => b.display - a.display);
  const rankList = ranked.map(s => `<button type="button" class="li" data-ex="${esc(s.ex.id)}">${badge(s.tierIdx)}<div class="grow"><div class="t">${esc(s.ex.name)}</div><div class="s">${esc(entryText(s.ex, s.best, u))}</div></div>
    <div class="r tier-${s.tierIdx}"><span class="tier-text">${TIERS[s.tierIdx]}</span><small>${s.display.toFixed(2)}</small></div></button>`).join('');
  const ranks = `<div class="card"><div class="card-h"><h3>Exercise ranks</h3><span class="aside">${ranked.length} ranked</span></div>${rankList ? `<div class="list">${rankList}</div>` : '<p class="note">Log a Max on any exercise to rank it.</p>'}</div>`;

  root.innerHTML = `<div class="progress">${overall}${bwNote}${tiles}${radar}${maxCard}${vol}${cal}${records}${ranks}</div>`;

  radarChart(root.querySelector('#radar'), { groups: st.groups });
  volumeChart(root.querySelector('#vol'), { ...weeklyVolume(d, st.lib, st.today), unit: u });
  renderMaxCard();
}

function renderMaxCard() {
  const box = root.querySelector('#max-card-p');
  if (!box) return;
  const st = stats();
  const u = unit();
  const options = [...st.byEx.values()]
    .sort((a, b) => GROUPS.findIndex(g => g.id === a.ex.group) - GROUPS.findIndex(g => g.id === b.ex.group) || a.ex.name.localeCompare(b.ex.name))
    .map(s => `<option value="${esc(s.ex.id)}" ${s.ex.id === picked ? 'selected' : ''}>${esc(s.ex.name)}</option>`).join('');
  const s = st.byEx.get(picked);
  box.innerHTML = `<div class="card-h"><h3>Max progress</h3><select class="picker" id="max-picker" aria-label="Exercise">${options}</select></div>
    <div class="chart-box"><canvas id="max-chart"></canvas></div>
    <div class="legend"><span><i style="background:var(--accent)"></i>Max</span><span><i style="background:var(--text-3)"></i>${s && isWeightKind(s.ex.kind) ? 'Estimated from sets' : 'Best set'}</span>${s?.tierIdx != null && s.tierIdx < 5 ? '<span><i style="background:transparent;border:1px dashed var(--text-2)"></i>Next tiers</span>' : ''}</div>`;
  if (!s) return;
  // Next two tier thresholds as bands (in kg for weight kinds, reps/seconds otherwise).
  const bands = [];
  const t = thresholds(s.ex, st.standards);
  if (t) {
    const start = s.tierIdx ?? 0;
    for (let k = start; k < start + 2 && k < 5; k++) {
      const y = isWeightKind(s.ex.kind) ? t[k] * st.bwNow : t[k];
      bands.push({ y, label: TIERS[k + 1], color: TIER_HEX[k + 1] });
    }
  }
  maxChart(box.querySelector('#max-chart'), { s, series: maxSeries(s, st.bwNow), unit: u, bands, today: st.today });
}

async function onClick(e) {
  const exBtn = e.target.closest('[data-ex]');
  if (exBtn) return hooks.openSheet(exBtn.dataset.ex);
  const a = e.target.closest('[data-act]');
  if (!a) return;
  e.preventDefault();
  if (a.dataset.act === 'go-lifts') hooks.showTab('lifts');
  else if (a.dataset.act === 'bodyweight') hooks.openSettings('bodyweight');
  else if (a.dataset.act === 'share-overall') {
    const o = stats().overall;
    const blob = await rankCardBlob({ heading: 'Overall rank', tierIdx: o.tierIdx, line1: `${TIERS[o.tierIdx]} · ${o.display.toFixed(2)}`, line2: `${o.groupsRanked} muscle groups ranked · ${fmtShort(today())}` });
    shareFile(new File([blob], `liftboard-rank-${TIERS[o.tierIdx].toLowerCase()}.png`, { type: 'image/png' }), `My Liftboard rank: ${TIERS[o.tierIdx]}`);
  }
}
