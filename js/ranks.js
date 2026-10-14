// Rank system: thresholds, estimated max, score and tier. Pure functions.
// All numbers are approximate and meant to be tuned after real use.

export const TIERS = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Champion'];

// Max ÷ bodyweight needed to reach Silver, Gold, Platinum, Diamond, Champion (men's).
export const WEIGHT_STANDARDS = {
  BP: [0.75, 1.0, 1.5, 2.0, 2.4],
  SQ: [1.25, 1.5, 2.25, 2.75, 3.25],
  DL: [1.5, 2.0, 2.5, 3.0, 3.5],
  OHP: [0.55, 0.75, 1.0, 1.25, 1.5],
  ROW: [0.75, 1.0, 1.25, 1.5, 1.8],
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
// Used when no bodyweight has been entered.
export const REF_BW = { men: 80, women: 65 };

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

// The x that goes into score(): ratio to bodyweight for weight kinds.
export function measure(ex, entry, bw) {
  const v = entryValue(ex, entry, bw);
  return isWeightKind(ex.kind) ? v / bw : v;
}

// Percent of the way through the current tier toward the next (0–99, or 100 at the very top).
export function pctToNext(s) {
  if (s >= 6) return 100;
  const p = Math.round((s - Math.floor(s)) * 100);
  return Math.min(99, Math.max(0, p));
}
