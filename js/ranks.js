// Rank system: thresholds, bodyweight scaling, estimated max, score, tier and division. Pure functions.
// All numbers are approximate and meant to be tuned after real use.

export const TIERS = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Champion'];
// Every tier below Champion splits into three divisions: III → II → I.
export const DIVS = ['III', 'II', 'I'];

// Max ÷ bodyweight needed to reach Silver, Gold, Platinum, Diamond, Champion (men's).
// Platinum is lifting your own bodyweight; squat and deadlift climb faster above it.
export const WEIGHT_STANDARDS = {
  BP: [0.5, 0.75, 1.0, 1.25, 1.5],
  SQ: [0.5, 0.75, 1.0, 1.5, 2.0],
  DL: [0.5, 0.75, 1.0, 1.5, 2.0],
  OHP: [0.5, 0.75, 1.0, 1.25, 1.5],
  ROW: [0.5, 0.75, 1.0, 1.25, 1.5],
};
// Reps (or seconds for PLANK) needed per tier (men's).
export const REP_STANDARDS = {
  PULLUP: [5, 10, 15, 20, 25],
  PUSHUP: [20, 30, 45, 60, 80],
  DIP: [10, 15, 25, 35, 45],
  LEGRAISE: [8, 12, 18, 25, 30],
  ROLLOUT: [8, 12, 20, 30, 40],
  SITUP: [20, 30, 40, 50, 60],
  PLANK: [60, 90, 120, 180, 300],
};
// Women's standards = men's × this. Core standards are unchanged.
export const WOMEN_FACTOR = { BP: 0.6, OHP: 0.6, ROW: 0.6, SQ: 0.75, DL: 0.75, PULLUP: 0.4, PUSHUP: 0.5, DIP: 0.5 };
export const BASE_NAMES = { BP: 'Bench Press', SQ: 'Squat', DL: 'Deadlift', OHP: 'Overhead Press', ROW: 'Barbell Row' };
// The standards above are written for a lifter of this bodyweight; also used when none has been entered.
export const REF_BW = { men: 80, women: 65 };
// Strength grows slower than bodyweight (roughly with bodyweight^⅔), so a heavier lifter needs more
// kg but a lower Max ÷ bodyweight for the same tier, and a lighter lifter the reverse.
export const ALLOMETRIC = 2 / 3;
// Rep standards where you lift your own body: more bodyweight makes each rep harder.
export const BW_LOADED = ['PULLUP', 'PUSHUP', 'DIP'];

export const isWeightKind = kind => kind === 'weight' || kind === 'perdb';

export function isRanked(ex) {
  if (!ex || !ex.base || !(ex.factor > 0)) return false;
  return isWeightKind(ex.kind) ? ex.base in WEIGHT_STANDARDS : ex.base in REP_STANDARDS;
}

// The 5 thresholds for an exercise, in ratio units (weight kinds) or reps/seconds.
export function thresholds(ex, standards = 'men') {
  if (!isRanked(ex)) return null;
  const table = isWeightKind(ex.kind) ? WEIGHT_STANDARDS : REP_STANDARDS;
  const w = standards === 'women' ? (WOMEN_FACTOR[ex.base] ?? 1) : 1;
  return table[ex.base].map(t => t * ex.factor * w);
}

// Epley estimated 1-rep max; hint only, reps capped at 12.
export const estMax = (w, r) => (r <= 1 ? w : w * (1 + Math.min(r, 12) / 30));

// Reps with added weight → equivalent reps at bodyweight.
export function equivReps(reps, added, bw) {
  if (!added || !(bw > 0)) return reps;
  return 30 * (((bw + added) * (1 + reps / 30)) / bw - 1);
}

// x = Max ÷ bodyweight (or reps / seconds); t = [silver, gold, platinum, diamond, champion]
export function score(x, t) {
  if (!(x > 0)) return 0;
  const e = 1e-9; // keeps exact threshold hits from falling just short through float error
  if (x + e < t[0]) return x / t[0];
  for (let i = 0; i < 4; i++) if (x + e < t[i + 1]) return Math.max(i + 1, i + 1 + (x - t[i]) / (t[i + 1] - t[i]));
  return Math.min(6, Math.max(5, 5 + (x - t[4]) / (t[4] - t[3])));
}

export const tierIndex = s => Math.max(0, Math.min(5, Math.floor(s)));
export const tierOf = s => TIERS[tierIndex(s)];

// Raw comparable value of a Max entry: kg, equivalent reps, or seconds.
export function entryValue(ex, entry, bw) {
  if (isWeightKind(ex.kind)) return entry.kg ?? 0;
  if (ex.kind === 'time') return entry.sec ?? 0;
  return equivReps(entry.reps ?? 0, entry.added ?? 0, bw);
}

const refBw = standards => REF_BW[standards] ?? 80;

// Whether bodyweight changes the rank of this exercise (core holds and raises are not adjusted).
export const isBwAdjusted = ex => isRanked(ex) && (isWeightKind(ex.kind) || BW_LOADED.includes(ex.base));

// The kg that a ratio of 1.0 means at this bodyweight: the reference bodyweight scaled by bw^⅔.
export function strengthBase(bw, standards = 'men') {
  const ref = refBw(standards);
  return ref * (bw / ref) ** ALLOMETRIC;
}
// How much harder each bodyweight rep is than for the reference lifter (1 at the reference).
const repLoad = (bw, standards) => (bw / refBw(standards)) ** (1 - ALLOMETRIC);

// The x that goes into score(), in the units of thresholds(): a reference-lifter ratio for weight
// kinds, reference-lifter reps for pull-ups, push-ups and dips, raw reps or seconds for core.
export function measure(ex, entry, bw, standards = 'men') {
  if (isWeightKind(ex.kind)) return (entry.kg ?? 0) / strengthBase(bw, standards);
  if (ex.kind === 'reps' && BW_LOADED.includes(ex.base) && bw > 0) {
    const reps = entry.reps ?? 0;
    if (!(reps > 0)) return 0;
    const load = ((bw + (entry.added ?? 0)) / bw) * repLoad(bw, standards);
    return Math.max(0, 30 * (load * (1 + reps / 30) - 1));
  }
  return entryValue(ex, entry, bw);
}

// Inverse of measure(): what x means for you, in kg, reps at bodyweight (no added weight) or seconds.
export function fromMeasure(ex, x, bw, standards = 'men') {
  if (isWeightKind(ex.kind)) return x * strengthBase(bw, standards);
  if (ex.kind === 'reps' && BW_LOADED.includes(ex.base) && bw > 0) {
    return Math.max(0, 30 * ((1 + x / 30) / repLoad(bw, standards) - 1));
  }
  return x;
}

// Inverse of score(): the x needed to reach score s.
export function scoreTarget(s, t) {
  if (s <= 1) return s * t[0];
  if (s < 5) { const i = Math.floor(s); return t[i - 1] + (s - i) * (t[i] - t[i - 1]); }
  return t[4] + (s - 5) * (t[4] - t[3]);
}

// What you need, in your own units at this bodyweight, for each tier from Silver to Champion.
export function tierTargets(ex, standards, bw) {
  const t = thresholds(ex, standards);
  return t ? t.map(x => fromMeasure(ex, x, bw, standards)) : null;
}

// Percent of the way through the current tier toward the next (0–99, or 100 at the very top).
export function pctToNext(s) {
  if (s >= 6) return 100;
  const p = Math.round((s - Math.floor(s)) * 100);
  return Math.min(99, Math.max(0, p));
}

// Steps of a third of a tier: 0 = Bronze III … 14 = Diamond I, 15 = Champion.
export const stepIndex = s => Math.min(15, Math.max(0, Math.floor(s * 3 + 1e-9)));
export const stepName = i => (i >= 15 ? TIERS[5] : `${TIERS[Math.floor(i / 3)]} ${DIVS[i % 3]}`);

// Tier, division and progress toward the next division for a score.
export function rankInfo(s) {
  const step = stepIndex(s);
  const tierIdx = Math.min(5, Math.floor(step / 3));
  if (step >= 15) {
    return { tierIdx: 5, div: null, step, name: TIERS[5], nextScore: null, nextName: null, pct: Math.round(Math.min(1, s - 5) * 100) };
  }
  const nextScore = (step + 1) / 3;
  const pct = Math.min(99, Math.max(0, Math.round((s * 3 - step) * 100)));
  return { tierIdx, div: step % 3, step, name: stepName(step), nextScore, nextName: stepName(step + 1), pct };
}
