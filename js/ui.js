// Shared UI pieces: icons, rank badge, toast, modal, confetti, share image, long-press.

import { TIERS, DIVS, isWeightKind } from './ranks.js';
import { esc, toDisplay, fmtNum, fmtSec } from './util.js';

const svg = (d, extra = '') =>
  `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${d}</svg>`;

export const ICONS = {
  dumbbell: svg('<path d="M6 7v10M3 9.5v5M18 7v10M21 9.5v5M6 12h12"/>'),
  chart: svg('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
  gear: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>'),
  search: svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
  x: svg('<path d="M18 6 6 18M6 6l12 12"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  minus: svg('<path d="M5 12h14"/>'),
  back: svg('<path d="m15 18-6-6 6-6"/>'),
  chevron: svg('<path d="m9 18 6-6-6-6"/>'),
  crown: svg('<path d="m2 8 4 10h12l4-10-6 4-4-7-4 7z"/>', 'class="ic-crown"'),
  trophy: svg('<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>', 'class="ic-trophy"'),
  flame: svg('<path d="M12 22c4 0 7-3 7-7 0-5-5-7-5-12-3 2-5 5-5 8-1-1-2-2-2-4-2 2-2 5-2 8 0 4 3 7 7 7z"/>', 'class="ic-flame"'),
  pin: svg('<path d="M12 17v5M9 10.76V6h6v4.76l2 3.24H7z"/>'),
  hide: svg('<path d="M17.94 17.94A10 10 0 0 1 12 20C5 20 1 12 1 12a18.5 18.5 0 0 1 5.06-5.94M9.9 4.24A9 9 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19M1 1l22 22"/>'),
  share: svg('<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13"/>'),
  edit: svg('<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'),
  check: svg('<path d="M20 6 9 17l-5-5"/>'),
  list: svg('<path d="M9 6h11M9 12h11M9 18h11"/><path d="m3 6 1.5 1.5L7 5M3 12l1.5 1.5L7 11M3 18l1.5 1.5L7 17"/>'),
  trash: svg('<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>'),
};

// ---- Rank badge: a gradient emblem whose shape and mark change with the tier ----
// Light, mid and dark colour per tier (used by the SVG gradients and the share image).
export const TIER_COLORS = [
  ['#f3c08f', '#cd7f32', '#6e4119'],
  ['#ffffff', '#b8c2cc', '#5f6b78'],
  ['#fff3b0', '#f5c542', '#9a6c00'],
  ['#c4fff7', '#2ec4b6', '#0f6b63'],
  ['#cfe0ff', '#4d8dff', '#1a3f9c'],
  ['#f5dcff', '#a855f7', '#4c1590'],
];
// viewBox 0 0 48 56. Shield for Bronze–Gold, hex for Platinum, gem for Diamond, star for Champion.
const SHIELD = 'M24 2 44 9v17c0 14-9 24-20 28C13 50 4 40 4 26V9z';
export const BADGE_SHAPES = [SHIELD, SHIELD, SHIELD,
  'M24 2 44 13v30L24 54 4 43V13z',
  'M13 5h22l11 14-22 35L2 19z',
  'M24 1l6.5 10.5L42 7l-2.5 12.5L47 28l-7.5 8.5L42 49l-11.5-4.5L24 55l-6.5-10.5L6 49l2.5-12.5L1 28l7.5-8.5L6 7l11.5 4.5z'];
// The mark inside: 1–3 chevrons, a star, gem facets, a crown.
const chev = y => `M14 ${y + 7}l10-6 10 6`;
export const BADGE_MARKS = [
  { stroke: chev(22) },
  { stroke: `${chev(17)}${chev(25)}` },
  { stroke: `${chev(13)}${chev(21)}${chev(29)}` },
  { fill: 'M24 15l3.2 6.6 7.3 1-5.3 5.1 1.3 7.2-6.5-3.4-6.5 3.4 1.3-7.2-5.3-5.1 7.3-1z' },
  { stroke: 'M13 5l6 14 5-14 5 14 6-14M2 19h44M19 19l5 35 5-35' },
  { fill: 'M14 34V21l5.5 5L24 17l4.5 9 5.5-5v13z' },
];
let defsAdded = false;
function badgeDefs() {
  if (defsAdded || typeof document === 'undefined') return;
  defsAdded = true;
  const stops = TIER_COLORS.map(([a, b, c], i) => `<linearGradient id="lb-g${i}" x1="0" y1="0" x2=".35" y2="1"><stop offset="0" stop-color="${a}"/><stop offset=".45" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></linearGradient>`).join('');
  document.body.insertAdjacentHTML('afterbegin', `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${stops}</defs></svg>`);
}

// div: 0 (III), 1 (II), 2 (I) or null; shown as pips under md and lg badges.
export function badge(tierIdx, size = 'sm', div = null) {
  if (tierIdx == null) return '';
  badgeDefs();
  const t = TIERS[tierIdx];
  const label = div != null && tierIdx < 5 ? `${t} ${DIVS[div]}` : t;
  const m = BADGE_MARKS[tierIdx];
  const mark = m.fill ? `<path class="mk" d="${m.fill}"/>` : `<path class="mk-s" d="${m.stroke}"/>`;
  const pips = size !== 'sm' && div != null && tierIdx < 5
    ? `<span class="pips">${[0, 1, 2].map(i => `<i class="${i <= div ? 'on' : ''}"></i>`).join('')}</span>` : '';
  return `<span class="badge badge-${size} tier-${tierIdx}" title="${label}" aria-label="${label}">
    <svg viewBox="0 0 48 56" aria-hidden="true"><path class="bd" d="${BADGE_SHAPES[tierIdx]}" fill="url(#lb-g${tierIdx})"/>
      <path class="hl" d="${BADGE_SHAPES[tierIdx]}"/>${mark}</svg>${pips}</span>`;
}

// ---- Toast with optional action (used for Undo) ----
let toastTimer = null;
export function toast(msg, { action, onAction, duration = 3000 } = {}) {
  const host = document.getElementById('toast');
  clearTimeout(toastTimer);
  host.innerHTML = `<span>${esc(msg)}</span>${action ? `<button type="button" class="toast-btn">${esc(action)}</button>` : ''}`;
  host.hidden = false;
  host.classList.remove('show');
  void host.offsetWidth;
  host.classList.add('show');
  const hide = () => { host.classList.remove('show'); toastTimer = setTimeout(() => (host.hidden = true), 250); };
  if (action) {
    host.querySelector('.toast-btn').onclick = () => { clearTimeout(toastTimer); hide(); onAction?.(); };
  }
  host.onclick = action ? null : hide;
  toastTimer = setTimeout(hide, duration);
}

// ---- Modal dialog; resolves with the chosen action's value (null if dismissed) ----
export function modal({ title, body = '', actions = [{ label: 'OK', value: true, kind: 'primary' }], onMount, dismissible = true }) {
  return new Promise(resolve => {
    const wrap = document.createElement('div');
    wrap.className = 'modal-wrap';
    wrap.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <h2>${esc(title)}</h2><div class="modal-body">${body}</div>
      <div class="modal-actions">${actions.map((a, i) => `<button type="button" class="btn ${a.kind || ''}" data-i="${i}">${esc(a.label)}</button>`).join('')}</div>
    </div>`;
    const done = v => { wrap.classList.remove('show'); setTimeout(() => wrap.remove(), 200); resolve(v); };
    wrap.addEventListener('click', e => {
      const b = e.target.closest('[data-i]');
      if (b) {
        const a = actions[+b.dataset.i];
        if (a.validate && !a.validate(wrap)) return;
        done(typeof a.value === 'function' ? a.value(wrap) : a.value);
      } else if (e.target === wrap && dismissible) done(null);
    });
    wrap.addEventListener('submit', e => {
      e.preventDefault();
      const primary = actions.findIndex(a => a.kind?.includes('primary'));
      if (primary >= 0) wrap.querySelector(`[data-i="${primary}"]`).click();
    });
    document.body.appendChild(wrap);
    requestAnimationFrame(() => wrap.classList.add('show'));
    onMount?.(wrap);
  });
}

export const confirmDialog = (title, text, okLabel = 'OK', danger = false) =>
  modal({
    title, body: `<p>${esc(text)}</p>`,
    actions: [{ label: 'Cancel', value: false }, { label: okLabel, value: true, kind: danger ? 'danger' : 'primary' }],
  }).then(Boolean);

// ---- Confetti: a short burst of DOM particles ----
export function confetti() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const host = document.createElement('div');
  host.className = 'confetti';
  const colors = ['#ff5c28', '#f5c542', '#2ec4b6', '#4d8dff', '#a855f7', '#ffffff'];
  for (let i = 0; i < 70; i++) {
    const p = document.createElement('i');
    p.style.left = `${50 + (Math.random() - 0.5) * 30}%`;
    p.style.background = colors[i % colors.length];
    p.style.setProperty('--dx', `${(Math.random() - 0.5) * 120}vw`);
    p.style.setProperty('--dy', `${40 + Math.random() * 60}vh`);
    p.style.setProperty('--r', `${Math.random() * 720 - 360}deg`);
    p.style.animationDelay = `${Math.random() * 0.15}s`;
    host.appendChild(p);
  }
  document.body.appendChild(host);
  setTimeout(() => host.remove(), 1800);
}

// ---- Share: a 1080 × 1350 rank card image through the share sheet ----
// name: the full rank, e.g. "Gold II" (defaults to the tier).
export function rankCardBlob({ heading, tierIdx, name, line1, line2 }) {
  const c = document.createElement('canvas');
  c.width = 1080; c.height = 1350;
  const g = c.getContext('2d');
  const [light, col, dark] = TIER_COLORS[tierIdx] ?? ['#ccc', '#888', '#444'];
  const grad = g.createLinearGradient(0, 0, 0, 1350);
  grad.addColorStop(0, '#16161d'); grad.addColorStop(1, '#0b0b0f');
  g.fillStyle = grad; g.fillRect(0, 0, 1080, 1350);
  const glow = g.createRadialGradient(540, 560, 40, 540, 560, 520);
  glow.addColorStop(0, col + '55'); glow.addColorStop(1, col + '00');
  g.fillStyle = glow; g.fillRect(0, 0, 1080, 1350);
  const font = (w, s) => `${w} ${s}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  g.textAlign = 'center';
  g.fillStyle = '#9a9aa5'; g.font = font(600, 44);
  g.fillText(heading.toUpperCase(), 540, 170);
  // Emblem, drawn from the same paths as the on-screen badge.
  g.save();
  g.translate(540 - 24 * 9, 560 - 28 * 9);
  g.scale(9, 9);
  const fill = g.createLinearGradient(0, 0, 17, 56);
  fill.addColorStop(0, light); fill.addColorStop(0.45, col); fill.addColorStop(1, dark);
  g.shadowColor = col; g.shadowBlur = tierIdx >= 4 ? 6 : 2;
  g.fillStyle = fill;
  g.fill(new Path2D(BADGE_SHAPES[tierIdx]));
  g.shadowBlur = 0;
  const m = BADGE_MARKS[tierIdx];
  g.fillStyle = g.strokeStyle = 'rgba(11,11,15,.55)';
  g.lineWidth = 3; g.lineJoin = g.lineCap = 'round';
  if (m.fill) g.fill(new Path2D(m.fill)); else g.stroke(new Path2D(m.stroke));
  g.restore();
  g.fillStyle = col; g.font = font(800, 110);
  g.fillText(name || TIERS[tierIdx] || 'Unranked', 540, 920);
  g.fillStyle = '#f2f2f5'; g.font = font(600, 56);
  g.fillText(line1 || '', 540, 1010);
  g.fillStyle = '#9a9aa5'; g.font = font(500, 44);
  g.fillText(line2 || '', 540, 1080);
  g.fillStyle = '#ff5c28'; g.font = font(800, 48);
  g.fillText('LIFTBOARD', 540, 1260);
  return new Promise(res => c.toBlob(res, 'image/png'));
}

// Hand a file to the iOS share sheet, or download it where sharing files is not supported.
// Resolves true if it was shared or downloaded, false if the person cancelled.
export async function shareFile(file, text) {
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: file.name, text });
      return true;
    } catch (err) {
      if (err.name === 'AbortError') return false;
      console.warn('Share failed, downloading instead', err);
    }
  }
  const url = URL.createObjectURL(file);
  const a = Object.assign(document.createElement('a'), { href: url, download: file.name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return true;
}

// ---- Long-press: fires cb after ms without moving; the following click is swallowed ----
export function onLongPress(root, selector, cb, ms = 500) {
  let timer = null, startX = 0, startY = 0, target = null, fired = false;
  const cancel = () => { clearTimeout(timer); timer = null; };
  root.addEventListener('pointerdown', e => {
    target = e.target.closest(selector);
    if (!target || e.button > 0) return;
    fired = false;
    startX = e.clientX; startY = e.clientY;
    timer = setTimeout(() => { fired = true; timer = null; cb(target); }, ms);
  });
  root.addEventListener('pointermove', e => {
    if (timer && Math.hypot(e.clientX - startX, e.clientY - startY) > 10) cancel();
  });
  root.addEventListener('pointerup', cancel);
  root.addEventListener('pointercancel', cancel);
  root.addEventListener('contextmenu', e => { if (e.target.closest(selector)) e.preventDefault(); });
  root.addEventListener('click', e => {
    if (fired && e.target.closest(selector)) { e.stopPropagation(); e.preventDefault(); fired = false; }
  }, true);
}

// ---- Entry formatting shared by the views ----

// A Max or best value split into big number + small unit, e.g. { num: '117.5', unit: 'kg' }.
export function entryParts(ex, e, unit) {
  if (!e) return { num: '—', unit: '' };
  if (isWeightKind(ex.kind)) return { num: fmtNum(toDisplay(e.kg, unit)), unit };
  if (ex.kind === 'time') return { num: fmtSec(e.sec ?? 0), unit: '' };
  return { num: fmtNum(e.reps ?? 0), unit: e.added ? `reps +${fmtNum(toDisplay(e.added, unit))}` : 'reps' };
}
// One line of text for an entry: "117.5 kg", "100 × 5", "10 reps +20 kg", "1:30".
// short drops the unit from weight sets ("100 × 5") for compact lists.
export function entryText(ex, e, unit, short = false) {
  if (isWeightKind(ex.kind)) {
    const w = fmtNum(toDisplay(e.kg, unit));
    if (e.type === 'set') return short ? `${w} × ${e.reps}` : `${w} ${unit} × ${e.reps}`;
    return short ? w : `${w} ${unit}`;
  }
  if (ex.kind === 'time') return fmtSec(e.sec ?? 0);
  const add = e.added ? ` +${fmtNum(toDisplay(e.added, unit))} ${unit}` : '';
  return `${e.reps} reps${add}`;
}
