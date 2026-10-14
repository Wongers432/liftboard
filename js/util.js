// Small shared helpers: dates (local YYYY-MM-DD), units and formatting.

export const LB_PER_KG = 2.20462;

const pad = n => String(n).padStart(2, '0');
export const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => ymd(new Date());
export const isYmd = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(parseYmd(s));

export function parseYmd(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
// Whole days since 1970-01-01 for a calendar date (timezone-proof).
export function dayNum(s) {
  const [y, m, d] = s.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 864e5);
}
export function fromDayNum(n) {
  const d = new Date(n * 864e5);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
export const addDays = (s, n) => fromDayNum(dayNum(s) + n);
// Monday of the week containing s.
export function weekStart(s) {
  const n = dayNum(s);
  const dow = (new Date(n * 864e5).getUTCDay() + 6) % 7; // Mon=0 … Sun=6
  return fromDayNum(n - dow);
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function fmtShort(s) {
  const d = parseYmd(s);
  const y = d.getFullYear() !== new Date().getFullYear() ? ` ${d.getFullYear()}` : '';
  return `${d.getDate()} ${MONTHS[d.getMonth()]}${y}`;
}
export function fmtDay(s) {
  return `${DAYS[parseYmd(s).getDay()]} ${fmtShort(s)}`;
}
export function relDay(s) {
  const n = dayNum(today()) - dayNum(s);
  if (n <= 0) return n === 0 ? 'Today' : fmtShort(s);
  if (n === 1) return 'Yesterday';
  if (n < 14) return `${n} days ago`;
  if (n < 60) return `${Math.floor(n / 7)} weeks ago`;
  return fmtShort(s);
}

// ---- Units. Everything is stored in kg; lb only exists on screen. ----
export function toDisplay(kg, unit) {
  if (kg == null || isNaN(kg)) return null;
  return unit === 'lb' ? Math.round(kg * LB_PER_KG * 10) / 10 : Math.round(kg * 100) / 100;
}
export function fromDisplay(v, unit) {
  const n = Number(v);
  if (!isFinite(n)) return NaN;
  const kg = unit === 'lb' ? n / LB_PER_KG : n;
  return Math.round(kg * 1000) / 1000;
}
export function fmtNum(n, maxDec = 2) {
  if (n == null || isNaN(n)) return '—';
  const f = Math.round(n * 10 ** maxDec) / 10 ** maxDec;
  return String(f);
}
export const fmtWeight = (kg, unit) => `${fmtNum(toDisplay(kg, unit))} ${unit}`;
export function fmtSec(sec) {
  sec = Math.round(sec);
  if (sec < 60) return `${sec}s`;
  return `${Math.floor(sec / 60)}:${pad(sec % 60)}`;
}
// Big totals: "42.7 t" or "94.1k lb".
export function fmtTotal(kg, unit) {
  if (unit === 'lb') {
    const lb = kg * LB_PER_KG;
    return lb >= 1000 ? `${fmtNum(lb / 1000, 1)}k lb` : `${Math.round(lb)} lb`;
  }
  return `${fmtNum(kg / 1000, 1)} t`;
}

export function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ESC[c]);

export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
