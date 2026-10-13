// Datumshilfen. Alle Kalenderdaten werden als 'YYYY-MM-DD' (lokales Datum) gespeichert.

const pad = n => String(n).padStart(2, '0');

export function toISO(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayISO(now = new Date()) {
  return toISO(now);
}

export function parseISO(s) {
  const [y, m, d] = s.split('-').map(Number);
  return { y, m, d };
}

function dayNumber(s) {
  const { y, m, d } = parseISO(s);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
}

// Tage von a nach b (positiv, wenn b später liegt)
export function daysBetween(a, b) {
  return dayNumber(b) - dayNumber(a);
}

export function addDays(s, n) {
  const dt = new Date((dayNumber(s) + n) * 86400000);
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

export function isoFromParts(y, m, d) {
  return `${String(y).padStart(4, '0')}-${pad(m)}-${pad(d)}`;
}

export function formatDE(s) {
  if (!s) return '';
  const { y, m, d } = parseISO(s);
  return `${pad(d)}.${pad(m)}.${y}`;
}

// n: Tage relativ zu heute (negativ = Vergangenheit)
export function relativeDays(n) {
  if (n === 0) return 'heute';
  if (n === 1) return 'morgen';
  if (n === -1) return 'gestern';
  return n > 0 ? `in ${n} Tagen` : `vor ${-n} Tagen`;
}

export function isLeapYear(y) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

export function daysInMonth(y, m) {
  return [31, isLeapYear(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
}

export const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli',
  'August', 'September', 'Oktober', 'November', 'Dezember'];
