// Derived numbers: bests, ranks, volume, streaks, PR list. Pure functions;
// nothing here is stored, everything is recomputed from entries.

import { REF_BW, isRanked, isWeightKind, thresholds, score, measure, entryValue, estMax, tierIndex, pctToNext, rankInfo, scoreTarget, fromMeasure } from './ranks.js';
import { GROUPS } from './exercises.js';
import { dayNum, addDays, weekStart } from './util.js';

const byDate = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);

// Bodyweight (kg) on a date: latest entry on or before it, else the earliest entry, else the reference.
export function bodyweightAt(list, date, standards = 'men') {
  if (!list || !list.length) return REF_BW[standards] ?? 80;
  let pick = null;
  for (const b of list) if (b.date <= date && (!pick || b.date >= pick.date)) pick = b;
  if (!pick) pick = list.reduce((a, b) => (b.date < a.date ? b : a));
  return pick.kg;
}

// Training volume of one entry in kg (weight kinds only; Per DB counts both dumbbells).
export function volumeOf(ex, e) {
  if (!ex || !isWeightKind(ex.kind) || !(e.kg > 0)) return 0;
  const reps = e.type === 'set' ? (e.reps || 0) : 1;
  return e.kg * reps * (ex.kind === 'perdb' ? 2 : 1);
}

// Value of a set for "best set": kg, reps (equivalent with added weight) or seconds.
function setValue(ex, e, bw) {
  if (isWeightKind(ex.kind)) return e.kg ?? 0;
  return entryValue(ex, e, bw);
}

export function exerciseStats(ex, entries, ctx) {
  const { bwNow, bwAt, standards, today } = ctx;
  const sorted = entries.slice().sort(byDate); // stable: same-day entries keep insertion order
  const maxes = sorted.filter(e => e.type === 'max');
  const sets = sorted.filter(e => e.type === 'set');
  const s = {
    ex, entries: sorted, maxes, sets,
    best: null, bestValue: null, prs: [],
    lastDate: sorted.length ? sorted[sorted.length - 1].date : null,
    timesTrained: new Set(sorted.map(e => e.date)).size,
    bestSet: null, bestSetValue: null, bestEst: null, lastSet: sets.length ? sets[sets.length - 1] : null,
    ranked: isRanked(ex), score: null, earned: null, display: null, tierIdx: null, pct: 0, rank: null, next: null, flame: false,
  };

  let running = null;
  for (const m of maxes) {
    const v = entryValue(ex, m, bwNow);
    if (running == null || v > running + 1e-9) {
      s.prs.push({ ex: ex.id, date: m.date, value: v, entry: m, gain: running == null ? null : v - running });
      running = v;
      s.best = m;
      s.bestValue = v;
    }
  }
  for (const e of sets) {
    const v = setValue(ex, e, bwNow);
    if (s.bestSetValue == null || v > s.bestSetValue) { s.bestSetValue = v; s.bestSet = e; }
    if (isWeightKind(ex.kind) && e.kg > 0 && e.reps > 0) {
      const est = estMax(e.kg, e.reps);
      if (s.bestEst == null || est > s.bestEst) s.bestEst = est;
    }
  }

  if (s.ranked && s.best) {
    const t = thresholds(ex, standards);
    s.thresholds = t;
    s.score = score(measure(ex, s.best, bwNow, standards), t);
    s.earned = Math.max(...maxes.map(m => score(measure(ex, m, bwAt(m.date), standards), t)));
    // Ranks never decay: the tier is the best ever earned; the bar shows where you are now.
    s.display = Math.max(s.score, s.earned);
    s.tierIdx = tierIndex(s.display);
    s.pct = s.display >= 6 ? 100 : s.score >= s.tierIdx ? pctToNext(s.score) : 0;
    // Division progress uses today's score, so it drops back if your bodyweight goes up.
    s.rank = rankInfo(s.display);
    if (s.rank.nextScore != null) {
      s.rank.pct = s.score >= s.rank.step / 3 ? rankInfo(s.score).pct : 0;
      // What it takes to reach the next division at today's bodyweight (kg, reps at bodyweight, or seconds).
      s.next = { name: s.rank.nextName, value: fromMeasure(ex, scoreTarget(s.rank.nextScore, t), bwNow, standards) };
    }
  }
  const weekAgo = addDays(today, -6);
  s.flame = s.prs.some(p => p.date >= weekAgo && p.date <= today);
  return s;
}

// Everything the screens need, in one pass.
export function computeAll(data, library, today) {
  const standards = data.settings.standards;
  const bwList = data.bodyweight || [];
  const bwNow = bodyweightAt(bwList, today, standards);
  const ctx = { bwNow, bwAt: d => bodyweightAt(bwList, d, standards), standards, today };
  const lib = new Map(library.map(e => [e.id, e]));

  const perEx = new Map();
  const workoutDays = new Set();
  const dayVolume = new Map();
  let totalVolume = 0;
  for (const e of data.entries) {
    const ex = lib.get(e.ex);
    if (!ex) continue;
    if (!perEx.has(e.ex)) perEx.set(e.ex, []);
    perEx.get(e.ex).push(e);
    workoutDays.add(e.date);
    const v = volumeOf(ex, e);
    if (v) { totalVolume += v; dayVolume.set(e.date, (dayVolume.get(e.date) || 0) + v); }
  }

  const byEx = new Map();
  for (const [id, list] of perEx) byEx.set(id, exerciseStats(lib.get(id), list, ctx));

  // Group scores: best exercise in each group.
  const groups = {};
  for (const g of GROUPS) groups[g.id] = null;
  for (const s of byEx.values()) {
    if (s.score == null) continue;
    const g = groups[s.ex.group] ?? { score: 0, earned: 0, ex: null };
    if (s.score > g.score) { g.score = s.score; g.ex = s.ex.id; }
    g.earned = Math.max(g.earned, s.earned);
    groups[s.ex.group] = g;
  }
  const ranked = Object.values(groups).filter(Boolean);
  const overall = { groupsRanked: ranked.length, ranked: ranked.length >= 3, score: null, display: null, tierIdx: null, pct: 0, rank: null };
  if (ranked.length) {
    overall.score = ranked.reduce((a, g) => a + g.score, 0) / ranked.length;
    const earned = ranked.reduce((a, g) => a + g.earned, 0) / ranked.length;
    overall.display = Math.max(overall.score, earned);
    overall.tierIdx = tierIndex(overall.display);
    overall.pct = overall.display >= 6 ? 100 : overall.score >= overall.tierIdx ? pctToNext(overall.score) : 0;
    overall.rank = rankInfo(overall.display);
    if (overall.rank.nextScore != null) overall.rank.pct = overall.score >= overall.rank.step / 3 ? rankInfo(overall.score).pct : 0;
  }

  const prs = [];
  for (const s of byEx.values()) prs.push(...s.prs);
  prs.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  return { today, bwNow, hasBw: bwList.length > 0, standards, lib, byEx, workoutDays, dayVolume, totalVolume, groups, overall, prs };
}

// Consecutive Monday–Sunday weeks with at least one workout, counting back from this week.
// A week still in progress with no workout yet does not break the streak.
export function streakWeeks(workoutDays, today) {
  const weeks = new Set([...workoutDays].map(weekStart));
  let w = weekStart(today);
  if (!weeks.has(w)) w = addDays(w, -7);
  let n = 0;
  while (weeks.has(w)) { n++; w = addDays(w, -7); }
  return n;
}

export function newMaxesThisMonth(prs, today) {
  const month = today.slice(0, 7);
  return prs.filter(p => p.date.slice(0, 7) === month).length;
}

// Total kg per week for the last n weeks, stacked by muscle group.
export function weeklyVolume(data, lib, today, n = 12) {
  const end = weekStart(today);
  const weeks = [];
  for (let i = n - 1; i >= 0; i--) weeks.push(addDays(end, -7 * i));
  const index = new Map(weeks.map((w, i) => [w, i]));
  const byGroup = {};
  for (const g of GROUPS) byGroup[g.id] = new Array(n).fill(0);
  for (const e of data.entries) {
    const ex = lib.get(e.ex);
    if (!ex) continue;
    const i = index.get(weekStart(e.date));
    if (i == null) continue;
    byGroup[ex.group][i] += volumeOf(ex, e);
  }
  return { weeks, byGroup };
}

// 20 weeks × 7 days ending this week; level 0 = rest, 1–4 = volume relative to your busiest day.
export function heatmap(workoutDays, dayVolume, today, weeks = 20) {
  const start = addDays(weekStart(today), -7 * (weeks - 1));
  let busiest = 0;
  for (const v of dayVolume.values()) busiest = Math.max(busiest, v);
  const cells = [];
  for (let i = 0; i < weeks * 7; i++) {
    const date = addDays(start, i);
    const vol = dayVolume.get(date) || 0;
    let level = 0;
    if (workoutDays.has(date)) level = busiest > 0 ? Math.max(1, Math.ceil((vol / busiest) * 4)) : 1;
    cells.push({ date, vol, level: Math.min(4, level), future: date > today, col: Math.floor(i / 7), row: i % 7 });
  }
  return cells;
}

// Points for the Max chart: running-best step line, each logged Max, and per-day estimate from sets.
export function maxSeries(s, bwNow) {
  const ex = s.ex;
  const step = [];
  let running = null;
  for (const m of s.maxes) {
    const v = entryValue(ex, m, bwNow);
    if (running == null || v > running) running = v;
    step.push({ x: dayNum(m.date), y: running });
  }
  const logged = s.maxes.map(m => ({ x: dayNum(m.date), y: entryValue(ex, m, bwNow) }));
  const perDay = new Map();
  for (const e of s.sets) {
    let v;
    if (isWeightKind(ex.kind)) { if (!(e.kg > 0 && e.reps > 0)) continue; v = estMax(e.kg, e.reps); }
    else v = entryValue(ex, e, bwNow);
    perDay.set(e.date, Math.max(perDay.get(e.date) ?? 0, v));
  }
  const est = [...perDay].map(([d, y]) => ({ x: dayNum(d), y })).sort((a, b) => a.x - b.x);
  return { step, logged, est };
}
