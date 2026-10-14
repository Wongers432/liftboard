// The built-in exercise library: 58 lifts in 6 muscle groups.
// kind: 'weight' (load on bar/stack), 'perdb' (weight of ONE dumbbell),
//       'reps' (bodyweight, optional added weight), 'time' (seconds held).
// base + factor: which rank standard the thresholds come from (see ranks.js).

export const GROUPS = [
  { id: 'chest', name: 'Chest' },
  { id: 'back', name: 'Back' },
  { id: 'shoulders', name: 'Shoulders' },
  { id: 'legs', name: 'Legs' },
  { id: 'arms', name: 'Arms' },
  { id: 'core', name: 'Core' },
];

const ex = (id, name, group, equipment, kind, base, factor, aliases = []) =>
  ({ id, name, group, equipment, kind, base, factor, aliases });

export const EXERCISES = [
  // Chest (11)
  ex('bench-press', 'Bench Press', 'chest', 'barbell', 'weight', 'BP', 1.0, ['bench', 'flat bench', 'bp']),
  ex('incline-bench-press', 'Incline Bench Press', 'chest', 'barbell', 'weight', 'BP', 0.85, ['incline bench', 'incline']),
  ex('close-grip-bench-press', 'Close-Grip Bench Press', 'chest', 'barbell', 'weight', 'BP', 0.85, ['cgbp', 'close grip', 'close-grip bench']),
  ex('dumbbell-bench-press', 'Dumbbell Bench Press', 'chest', 'dumbbells', 'perdb', 'BP', 0.4, ['db bench', 'dumbbell press', 'db press']),
  ex('incline-dumbbell-press', 'Incline Dumbbell Press', 'chest', 'dumbbells', 'perdb', 'BP', 0.35, ['incline db', 'incline db press']),
  ex('chest-press-machine', 'Chest Press Machine', 'chest', 'machine', 'weight', 'BP', 1.0, ['chest press', 'machine press']),
  ex('pec-deck', 'Pec Deck', 'chest', 'machine', 'weight', 'BP', 0.6, ['pec fly', 'machine fly', 'butterfly']),
  ex('cable-fly', 'Cable Fly', 'chest', 'cable', 'weight', 'BP', 0.25, ['cable crossover', 'crossover', 'cable flye']),
  ex('dumbbell-fly', 'Dumbbell Fly', 'chest', 'dumbbells', 'perdb', 'BP', 0.2, ['db fly', 'flye', 'chest fly']),
  ex('push-up', 'Push-Up', 'chest', 'bodyweight', 'reps', 'PUSHUP', 1.0, ['pushup', 'press up', 'press-up']),
  ex('dip', 'Dip', 'chest', 'bodyweight', 'reps', 'DIP', 1.0, ['dips', 'chest dip', 'parallel bar dip']),

  // Back (10)
  ex('deadlift', 'Deadlift', 'back', 'barbell', 'weight', 'DL', 1.0, ['dl', 'conventional deadlift', 'deadlifts']),
  ex('pull-up', 'Pull-Up', 'back', 'bodyweight', 'reps', 'PULLUP', 1.0, ['pullup', 'pull ups']),
  ex('chin-up', 'Chin-Up', 'back', 'bodyweight', 'reps', 'PULLUP', 1.1, ['chinup', 'chin ups']),
  ex('lat-pulldown', 'Lat Pulldown', 'back', 'cable', 'weight', 'ROW', 1.0, ['pulldown', 'lat pull', 'pull down']),
  ex('barbell-row', 'Barbell Row', 'back', 'barbell', 'weight', 'ROW', 1.0, ['bent over row', 'bb row', 'row', 'pendlay']),
  ex('dumbbell-row', 'Dumbbell Row', 'back', 'dumbbells', 'perdb', 'ROW', 0.5, ['db row', 'one arm row', 'single arm row']),
  ex('seated-cable-row', 'Seated Cable Row', 'back', 'cable', 'weight', 'ROW', 1.0, ['cable row', 'seated row', 'low row']),
  ex('t-bar-row', 'T-Bar Row', 'back', 'barbell', 'weight', 'ROW', 0.9, ['tbar', 't bar', 'landmine row']),
  ex('face-pull', 'Face Pull', 'back', 'cable', 'weight', 'ROW', 0.35, ['facepull', 'face pulls']),
  ex('shrug', 'Shrug', 'back', 'barbell', 'weight', 'DL', 0.8, ['shrugs', 'barbell shrug', 'traps']),

  // Shoulders (9)
  ex('overhead-press', 'Overhead Press', 'shoulders', 'barbell', 'weight', 'OHP', 1.0, ['ohp', 'military press', 'press', 'shoulder press']),
  ex('dumbbell-shoulder-press', 'Dumbbell Shoulder Press', 'shoulders', 'dumbbells', 'perdb', 'OHP', 0.4, ['db shoulder press', 'db ohp', 'seated db press']),
  ex('arnold-press', 'Arnold Press', 'shoulders', 'dumbbells', 'perdb', 'OHP', 0.35, ['arnold']),
  ex('shoulder-press-machine', 'Shoulder Press Machine', 'shoulders', 'machine', 'weight', 'OHP', 1.0, ['machine shoulder press', 'machine ohp']),
  ex('lateral-raise', 'Lateral Raise', 'shoulders', 'dumbbells', 'perdb', 'OHP', 0.15, ['side raise', 'lateral', 'laterals', 'side lateral']),
  ex('cable-lateral-raise', 'Cable Lateral Raise', 'shoulders', 'cable', 'weight', 'OHP', 0.1, ['cable lateral', 'cable side raise']),
  ex('rear-delt-fly', 'Rear Delt Fly', 'shoulders', 'dumbbells', 'perdb', 'OHP', 0.15, ['reverse fly', 'rear delt', 'rear fly']),
  ex('front-raise', 'Front Raise', 'shoulders', 'dumbbells', 'perdb', 'OHP', 0.18, ['front raises']),
  ex('upright-row', 'Upright Row', 'shoulders', 'barbell', 'weight', 'OHP', 0.7, ['upright rows']),

  // Legs (13)
  ex('squat', 'Squat', 'legs', 'barbell', 'weight', 'SQ', 1.0, ['back squat', 'sq', 'squats']),
  ex('front-squat', 'Front Squat', 'legs', 'barbell', 'weight', 'SQ', 0.8, ['front squats', 'fsq']),
  ex('leg-press', 'Leg Press', 'legs', 'machine', 'weight', 'SQ', 2.0, ['legpress', 'sled']),
  ex('hack-squat', 'Hack Squat', 'legs', 'machine', 'weight', 'SQ', 1.2, ['hack']),
  ex('romanian-deadlift', 'Romanian Deadlift', 'legs', 'barbell', 'weight', 'DL', 0.7, ['rdl', 'romanian', 'stiff leg deadlift', 'sldl']),
  ex('hip-thrust', 'Hip Thrust', 'legs', 'barbell', 'weight', 'SQ', 1.2, ['glute bridge', 'hip thrusts', 'glutes']),
  ex('bulgarian-split-squat', 'Bulgarian Split Squat', 'legs', 'dumbbells', 'perdb', 'SQ', 0.3, ['bss', 'split squat', 'bulgarian']),
  ex('walking-lunge', 'Walking Lunge', 'legs', 'dumbbells', 'perdb', 'SQ', 0.3, ['lunge', 'lunges']),
  ex('goblet-squat', 'Goblet Squat', 'legs', 'dumbbell', 'weight', 'SQ', 0.4, ['goblet']),
  ex('leg-extension', 'Leg Extension', 'legs', 'machine', 'weight', 'SQ', 0.6, ['leg extensions', 'quad extension']),
  ex('leg-curl', 'Leg Curl', 'legs', 'machine', 'weight', 'SQ', 0.45, ['hamstring curl', 'lying leg curl', 'seated leg curl']),
  ex('standing-calf-raise', 'Standing Calf Raise', 'legs', 'machine', 'weight', 'SQ', 0.9, ['calf raise', 'calves', 'calf']),
  ex('seated-calf-raise', 'Seated Calf Raise', 'legs', 'machine', 'weight', 'SQ', 0.6, ['seated calf', 'calves', 'calf']),

  // Arms (10)
  ex('barbell-curl', 'Barbell Curl', 'arms', 'barbell', 'weight', 'BP', 0.45, ['bb curl', 'curl', 'bicep curl', 'biceps']),
  ex('ez-bar-curl', 'EZ-Bar Curl', 'arms', 'ez bar', 'weight', 'BP', 0.45, ['ez curl', 'ezbar curl', 'curl', 'biceps']),
  ex('dumbbell-curl', 'Dumbbell Curl', 'arms', 'dumbbells', 'perdb', 'BP', 0.2, ['db curl', 'curl', 'bicep curl', 'biceps']),
  ex('hammer-curl', 'Hammer Curl', 'arms', 'dumbbells', 'perdb', 'BP', 0.22, ['hammer', 'hammers', 'curl']),
  ex('preacher-curl', 'Preacher Curl', 'arms', 'ez bar', 'weight', 'BP', 0.38, ['preacher', 'curl']),
  ex('cable-curl', 'Cable Curl', 'arms', 'cable', 'weight', 'BP', 0.4, ['cable bicep curl', 'curl']),
  ex('tricep-pushdown', 'Tricep Pushdown', 'arms', 'cable', 'weight', 'BP', 0.45, ['pushdown', 'triceps pushdown', 'rope pushdown', 'triceps']),
  ex('overhead-tricep-extension', 'Overhead Tricep Extension', 'arms', 'cable', 'weight', 'BP', 0.35, ['overhead extension', 'tricep extension', 'triceps']),
  ex('skull-crusher', 'Skull Crusher', 'arms', 'ez bar', 'weight', 'BP', 0.4, ['skullcrusher', 'lying tricep extension', 'triceps']),
  ex('concentration-curl', 'Concentration Curl', 'arms', 'dumbbell', 'perdb', 'BP', 0.15, ['concentration', 'curl']),

  // Core (5)
  ex('plank', 'Plank', 'core', 'bodyweight', 'time', 'PLANK', 1.0, ['planks', 'hold']),
  ex('hanging-leg-raise', 'Hanging Leg Raise', 'core', 'bodyweight', 'reps', 'LEGRAISE', 1.0, ['leg raise', 'hlr', 'leg raises']),
  ex('ab-wheel-rollout', 'Ab Wheel Rollout', 'core', 'ab wheel', 'reps', 'ROLLOUT', 1.0, ['ab wheel', 'rollout', 'ab roller']),
  ex('cable-crunch', 'Cable Crunch', 'core', 'cable', 'weight', 'BP', 0.6, ['crunch', 'kneeling crunch', 'abs']),
  ex('decline-sit-up', 'Decline Sit-Up', 'core', 'bench', 'reps', 'SITUP', 1.0, ['situp', 'sit up', 'sit-ups', 'decline situp']),
];

export const KIND_LABELS = { weight: 'Weight', perdb: 'Per dumbbell', reps: 'Reps', time: 'Time' };
