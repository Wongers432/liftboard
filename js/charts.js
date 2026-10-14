// Chart.js wrappers (line, bar, radar) and the SVG training heatmap.
/* global Chart */

import { GROUPS } from './exercises.js';
import { TIERS, isWeightKind } from './ranks.js';
import { toDisplay, fmtShort, fromDayNum, dayNum, fmtNum, fmtSec, esc } from './util.js';

export const GROUP_COLORS = { chest: '#ff5c28', back: '#4d8dff', shoulders: '#2ec4b6', legs: '#a855f7', arms: '#f5c542', core: '#ec4899' };
export const TIER_HEX = ['#cd7f32', '#b8c2cc', '#f5c542', '#2ec4b6', '#4d8dff', '#a855f7'];

const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const alpha = (hex, a) => hex + Math.round(a * 255).toString(16).padStart(2, '0');

function base() {
  const text = css('--text-2') || '#9a9aa5';
  const grid = css('--line') || 'rgba(255,255,255,.08)';
  return { text, grid };
}

function fresh(canvas) {
  if (typeof Chart === 'undefined') return false;
  Chart.getChart(canvas)?.destroy();
  Chart.defaults.font.family = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  return true;
}

// Value of a stats-unit number on screen: kg→unit for weight kinds, reps/seconds as-is.
export const displayValue = (ex, v, unit) => (isWeightKind(ex.kind) ? toDisplay(v, unit) : Math.round(v * 10) / 10);
export function fmtValue(ex, v, unit) {
  if (v == null) return '—';
  if (isWeightKind(ex.kind)) return `${fmtNum(toDisplay(v, unit))} ${unit}`;
  if (ex.kind === 'time') return fmtSec(v);
  return `${fmtNum(v, 1)} reps`;
}

// Faint horizontal bands at tier thresholds.
const bandsPlugin = {
  id: 'tierBands',
  beforeDatasetsDraw(chart, _args, opts) {
    const { ctx, chartArea: a, scales: { y } } = chart;
    for (const b of opts.bands || []) {
      const py = y.getPixelForValue(b.y);
      if (py < a.top - 1 || py > a.bottom + 1) continue;
      ctx.save();
      ctx.fillStyle = alpha(b.color, 0.16);
      ctx.fillRect(a.left, py - 5, a.right - a.left, 10);
      ctx.strokeStyle = alpha(b.color, 0.6);
      ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(a.left, py); ctx.lineTo(a.right, py); ctx.stroke();
      if (opts.labels) {
        ctx.fillStyle = b.color;
        ctx.font = '600 11px -apple-system, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(b.label, a.right - 4, py - 8);
      }
      ctx.restore();
    }
  },
};

// Max over time: running-best step line, logged Maxes as dots, faint dots for estimates from sets.
export function maxChart(canvas, { s, series, unit, bands = [], mini = false, today }) {
  if (!fresh(canvas)) return null;
  const { text, grid } = base();
  const accent = css('--accent') || '#ff5c28';
  const conv = p => ({ x: p.x, y: displayValue(s.ex, p.y, unit) });
  const step = series.step.map(conv);
  if (step.length) step.push({ x: Math.max(dayNum(today), step[step.length - 1].x), y: step[step.length - 1].y });
  const logged = series.logged.map(conv);
  const est = series.est.map(conv);
  const xs = [...step, ...est].map(p => p.x);
  let minX = Math.min(...xs), maxX = Math.max(...xs, dayNum(today));
  if (!isFinite(minX) || maxX - minX < 14) minX = maxX - 14; // short histories sit on the right, not in a lone centre dot
  const pad = Math.max(1, Math.round((maxX - minX) * 0.03));
  const bandVals = bands.map(b => ({ ...b, y: displayValue(s.ex, b.y, unit) }));
  const ys = [...step, ...est].map(p => p.y);
  const top = Math.max(...ys, ...bandVals.map(b => b.y), 1);
  const bottom = ys.length ? Math.min(...ys) : 0;

  return new Chart(canvas, {
    data: {
      datasets: [
        { type: 'scatter', label: 'From sets', data: est, pointRadius: mini ? 2 : 3, pointBackgroundColor: alpha(text.startsWith('#') ? text : '#9a9aa5', 0.45), pointBorderWidth: 0, order: 3 },
        { type: 'line', label: 'Max', data: step, stepped: true, borderColor: accent, borderWidth: mini ? 2 : 2.5, pointRadius: 0, fill: false, order: 2 },
        { type: 'scatter', label: 'Logged max', data: logged, pointRadius: mini ? 2.5 : 4, pointBackgroundColor: accent, pointBorderColor: css('--card') || '#16161d', pointBorderWidth: 1.5, order: 1 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false, animation: { duration: 250 },
      events: mini ? [] : ['mousemove', 'mouseout', 'click', 'touchstart', 'touchmove'],
      scales: {
        x: {
          type: 'linear', min: minX - pad, max: maxX + pad, display: !mini,
          grid: { display: false }, border: { color: grid },
          ticks: { color: text, maxTicksLimit: 5, maxRotation: 0, callback: v => fmtShort(fromDayNum(Math.round(v))) },
        },
        y: {
          display: !mini, suggestedMax: top * (mini ? 1.01 : 1.06), suggestedMin: Math.max(0, bottom * (mini ? 0.97 : 0.85)), grace: mini ? 0 : '5%',
          grid: { color: grid }, border: { display: false },
          ticks: { color: text, maxTicksLimit: 6 },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: !mini,
          callbacks: {
            title: items => fmtShort(fromDayNum(items[0].parsed.x)),
            label: c => {
              const y = c.parsed.y;
              const v = isWeightKind(s.ex.kind) ? `${fmtNum(y, 1)} ${unit}` : s.ex.kind === 'time' ? fmtSec(y) : `${fmtNum(y, 1)} reps`;
              return `${c.dataset.label}: ${v}`;
            },
          },
        },
        tierBands: { bands: bandVals, labels: !mini },
      },
    },
    plugins: [bandsPlugin],
  });
}

// Weekly volume, stacked by muscle group.
export function volumeChart(canvas, { weeks, byGroup, unit }) {
  if (!fresh(canvas)) return null;
  const { text, grid } = base();
  const k = unit === 'lb' ? 2.20462 : 1;
  return new Chart(canvas, {
    type: 'bar',
    data: {
      labels: weeks.map(w => fmtShort(w)),
      datasets: GROUPS.map(g => ({
        label: g.name, data: byGroup[g.id].map(v => Math.round(v * k)),
        backgroundColor: GROUP_COLORS[g.id], borderRadius: 3, borderSkipped: false, stack: 'v',
      })),
    },
    options: {
      responsive: true, maintainAspectRatio: false, animation: { duration: 250 },
      scales: {
        x: { stacked: true, grid: { display: false }, border: { color: grid }, ticks: { color: text, maxRotation: 0, autoSkip: true, maxTicksLimit: 6 } },
        y: { stacked: true, grid: { color: grid }, border: { display: false }, ticks: { color: text, maxTicksLimit: 5, callback: v => (v >= 1000 ? `${fmtNum(v / 1000, 1)}k` : v) } },
      },
      plugins: {
        legend: { position: 'bottom', labels: { color: text, boxWidth: 10, boxHeight: 10, usePointStyle: true, pointStyle: 'rectRounded', padding: 12 } },
        tooltip: { callbacks: { label: c => `${c.dataset.label}: ${c.parsed.y.toLocaleString()} ${unit}` } },
      },
    },
  });
}

// Strength balance: one spoke per muscle group, 0–6.
export function radarChart(canvas, { groups }) {
  if (!fresh(canvas)) return null;
  const { text, grid } = base();
  const accent = css('--accent') || '#ff5c28';
  return new Chart(canvas, {
    type: 'radar',
    data: {
      labels: GROUPS.map(g => (groups[g.id] ? g.name : [g.name, 'no data'])),
      datasets: [{
        label: 'Score', data: GROUPS.map(g => (groups[g.id] ? Math.round(groups[g.id].score * 100) / 100 : 0)),
        borderColor: accent, backgroundColor: alpha(accent, 0.22), pointBackgroundColor: accent, borderWidth: 2, pointRadius: 3,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false, animation: { duration: 250 },
      scales: {
        r: {
          min: 0, max: 6, ticks: { stepSize: 1, display: false },
          grid: { color: grid }, angleLines: { color: grid },
          pointLabels: { color: text, font: { size: 12, weight: '600' } },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: c => `${TIERS[Math.min(5, Math.floor(c.parsed.r))]} · ${c.parsed.r.toFixed(2)}` } },
      },
    },
  });
}

// GitHub-style heatmap as plain SVG: 20 columns (weeks) × 7 rows (Mon–Sun).
export function heatmapSVG(cells, unit) {
  const size = 13, gap = 3, left = 18, top = 14;
  const cols = Math.max(...cells.map(c => c.col)) + 1;
  const w = left + cols * (size + gap), h = top + 7 * (size + gap);
  const k = unit === 'lb' ? 2.20462 : 1;
  let out = `<svg class="heatmap" viewBox="0 0 ${w} ${h}" role="img" aria-label="Training calendar, last ${cols} weeks">`;
  ['M', '', 'W', '', 'F', '', 'S'].forEach((d, i) => {
    if (d) out += `<text x="0" y="${top + i * (size + gap) + size - 3}" class="hm-lbl">${d}</text>`;
  });
  let lastMonth = '';
  for (const c of cells) {
    if (c.row === 0) {
      const m = fmtShort(c.date).split(' ')[1];
      if (m !== lastMonth && c.col < cols - 1) { out += `<text x="${left + c.col * (size + gap)}" y="10" class="hm-lbl">${m}</text>`; lastMonth = m; }
    }
    if (c.future) continue;
    const tip = `${fmtShort(c.date)}${c.level ? `: ${Math.round(c.vol * k).toLocaleString()} ${unit}` : ''}`;
    out += `<rect x="${left + c.col * (size + gap)}" y="${top + c.row * (size + gap)}" width="${size}" height="${size}" rx="3" class="hm-${c.level}"><title>${esc(tip)}</title></rect>`;
  }
  return out + '</svg>';
}
