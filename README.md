# Liftboard

A gym tracker that installs on your iPhone home screen, works with no signal, and keeps every lift on your phone.
Log a Max and your sets for 58 common exercises, earn a rank from Bronze to Champion, and watch your progress in graphs.

## How ranks work

There are six tiers (Bronze, Silver, Gold, Platinum, Diamond, Champion), and every tier below Champion has three divisions (III, II, I).
Your Max is compared with standards written for an 80 kg man or a 65 kg woman, scaled to your bodyweight:

- **Weighted lifts:** Platinum is about lifting your own bodyweight (Silver ½×, Gold ¾×, Platinum 1×, Diamond 1.25×, Champion 1.5×; squat and deadlift need 1.5× and 2× for Diamond and Champion). Strength grows with roughly bodyweight^⅔, so a heavier lifter needs more kg but a lower Max ÷ bodyweight for the same tier. At 80 kg a Platinum bench is 80 kg; at 60 kg it is 66 kg (1.10 × bodyweight); at 100 kg it is 93 kg (0.93 × bodyweight).
- **Pull-ups, chin-ups, dips and push-ups:** each rep is harder the more you weigh, so the same reps rank higher for a heavier lifter. Added weight counts on top.
- **Core (planks, leg raises, rollouts, sit-ups):** the same at every bodyweight.

Each exercise sheet shows the ladder of targets for your bodyweight and what you need for the next division. Set your bodyweight in Settings; without it, ranks assume the reference bodyweight.

Plain HTML, CSS and JavaScript. No build step, no server, no accounts.

## Put it online (GitHub Pages)

1. Create a repository named `liftboard` and push these files to `main`, with `index.html` at the root.
2. On GitHub: **Settings › Pages › Source: Deploy from a branch › Branch: `main`, folder `/ (root)` › Save**.
3. After a minute the app is live at `https://<your-username>.github.io/liftboard/`.
4. On your iPhone: open that link in **Safari › Share › Add to Home Screen › Add**. Log from the home-screen icon, not the Safari tab (they keep separate data).

Every push redeploys. When you change any file, bump `CACHE` in `sw.js` (`liftboard-v1` → `liftboard-v2`) so installed phones pick up the update; the app then shows "Update ready, tap to reload".

## Run it locally

```
python3 -m http.server 8000
```

Then open http://localhost:8000. Offline mode needs HTTPS or localhost.

- `tests.html` runs the rank and stats tests in the browser.
- `?dev` (for example `http://localhost:8000/?dev`) adds a Developer section to Settings that fills 6 months of sample data.

## Files

| Path | What it is |
| --- | --- |
| `index.html` | App shell: top bar, two tabs, sheet, tab bar |
| `manifest.webmanifest`, `icons/` | Home-screen name, icon and colours |
| `sw.js` | Service worker: caches every file so the app works offline |
| `css/app.css` | All styles, dark and light |
| `js/app.js` | Start-up, tabs, theme, welcome, update banner |
| `js/store.js` | Load, save, migrate, export and import (localStorage key `liftboard:v1`, weights in kg) |
| `js/state.js` | Library (built-in + custom) and cached stats for the screens |
| `js/exercises.js` | The 58-exercise library: edit names, aliases and rank factors here |
| `js/ranks.js` | Rank thresholds, bodyweight scaling, score, tier and division: tune the numbers here |
| `js/stats.js` | Bests, ranks, volume, streaks, records (pure functions) |
| `js/charts.js` | Chart.js wrappers and the SVG training calendar |
| `js/ui.js` | Icons, badge, toast, dialogs, confetti, share image |
| `js/views/*.js` | Lifts tab, exercise sheet, Progress tab, Settings |
| `vendor/chart.umd.min.js` | Chart.js 4.5.0 (MIT), kept in the repo so charts work offline |

Your data never leaves the phone. Deleting the home-screen icon deletes it, so use **Settings › Export data** now and then.
