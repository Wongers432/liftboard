// Personal plans: one list per person, organised by day, with a tick per exercise.
// Ticks belong to a week (its Monday), so they clear themselves when a new week starts.

import { today, weekStart } from './util.js';

export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const DAY_NAMES = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday' };

// Today as 'Mon' … 'Sun'.
export const todayDay = () => DAYS[(new Date().getDay() + 6) % 7];
export const thisWeek = () => weekStart(today());
export const isDone = item => item.done === thisWeek();

// [day, title, [[exercise, sets × reps], …]]
const OLIVER = [
  ['Mon', 'Chest & Back A (strength)', [
    ['Weighted pull-ups', '4×5–8'],
    ['Barbell bench press', '4×5–8'],
    ['Barbell row', '3×6–10'],
    ['Weighted dips (chest lean)', '3×6–10'],
    ['Archer push-ups', '3×6–8 each side'],
    ['Hollow body hold', '3×30–45s'],
  ]],
  ['Tue', 'Shoulders & Arms A (strength)', [
    ['Standing overhead press', '4×5–8'],
    ['Pike push-ups (feet on bench)', '3×8–12'],
    ['Weighted close-grip dips', '3×6–10'],
    ['EZ-bar curl', '3×8–10'],
    ['Lateral raises', '3×12–15'],
    ['L-sit on parallettes or dip bars', '3×10–20s'],
  ]],
  ['Wed', 'Legs', [
    ['Back squat', '4×5–8'],
    ['Romanian deadlift', '3×8–10'],
    ['Bulgarian split squats (dumbbells)', '3×8–10 each leg'],
    ['Pistol squats to a box', '3×5–8 each leg'],
    ['Nordic curls (assisted if needed)', '3×4–8'],
    ['Walking lunges', '2×20 steps'],
    ['Standing calf raises', '4×12–15'],
  ]],
  ['Thu', 'Chest & Back B (volume)', [
    ['Incline dumbbell press', '4×8–12'],
    ['Chin-ups (bodyweight, slow 3s lowering)', '4×max'],
    ['Seated cable row', '3×10–12'],
    ['Ring or deficit push-ups', '3×12–20'],
    ['Inverted rows (feet raised)', '3×10–15'],
    ['Hanging knee or leg raises', '3×10–15'],
  ]],
  ['Fri', 'Shoulders & Arms B (volume)', [
    ['Seated dumbbell shoulder press', '3×8–12'],
    ['Handstand hold against wall', '3×20–40s'],
    ['Bench dips or diamond push-ups', '3×12–20'],
    ['Hammer curls', '3×10–12'],
    ['Cable face pulls', '3×15'],
    ['Overhead rope triceps extension', '3×12–15'],
    ['Bodyweight bicep curls on rings or TRX', '2×max'],
  ]],
];

const OLIVER_NOTES = [
  'Rest 2–3 min on the first two lifts of each day, 60–90s on the rest.',
  'When you hit the top of a rep range on every set, add weight (2.5 kg upper, 5 kg legs) or move to a harder bodyweight variation.',
  "If you can't do weighted pull-ups or dips yet, do them at bodyweight or with a band and build up.",
  'Warm up 5–10 min before each session, with a couple of light sets of your first lift.',
];

// Fixed ids so importing a backup into a fresh install never duplicates the starter plans.
function person(id, name, days, notes = []) {
  return {
    id, name, notes,
    days: days.map(([day, title, items], d) => ({
      id: `${id}-d${d}`, day, title,
      items: items.map(([text, detail], i) => ({ id: `${id}-d${d}-${i}`, text, detail, done: null })),
    })),
  };
}

export function seedPlans() {
  return [
    person('p_max', 'Max', [['', 'To do', [['Send Oliver personal plan', '']]]]),
    person('p_oliver', 'Oliver', OLIVER, OLIVER_NOTES),
  ];
}
