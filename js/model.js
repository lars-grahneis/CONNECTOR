// Fachlogik: Fälligkeit, Sortierung, Geburtstage. Ohne Browser-Abhängigkeiten, damit testbar.
import { addDays, daysBetween, parseISO, isoFromParts, daysInMonth, isLeapYear, MONTHS } from './dates.js';

export const DEFAULT_RHYTHM = 28;
export const SOON_DAYS = 7;
export const BIRTHDAY_WINDOW = 14;

export function contactStatus(c, today) {
  if (!c.lastContact) return { state: 'unknown', daysUntil: null, due: null, since: null };
  const rhythm = c.rhythmDays || DEFAULT_RHYTHM;
  const due = addDays(c.lastContact, rhythm);
  const daysUntil = daysBetween(today, due);
  const since = daysBetween(c.lastContact, today);
  const state = daysUntil <= 0 ? 'overdue' : daysUntil <= SOON_DAYS ? 'soon' : 'ok';
  return { state, daysUntil, due, since };
}

const STATE_ORDER = { overdue: 0, unknown: 1, soon: 2, ok: 3 };

export function byName(a, b) {
  return a.name.localeCompare(b.name, 'de', { sensitivity: 'base' });
}

export function sortByUrgency(contacts, today) {
  return contacts
    .map(c => ({ c, s: contactStatus(c, today) }))
    .sort((x, y) =>
      STATE_ORDER[x.s.state] - STATE_ORDER[y.s.state] ||
      (x.s.daysUntil ?? 0) - (y.s.daysUntil ?? 0) ||
      byName(x.c, y.c))
    .map(x => x.c);
}

// Geburtstage werden als 'YYYY-MM-DD' oder ohne Jahr als '--MM-DD' gespeichert.
export function birthdayParts(b) {
  if (!b) return null;
  let m = /^--(\d{2})-(\d{2})$/.exec(b);
  if (m) return { year: null, month: +m[1], day: +m[2] };
  m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(b);
  if (m) return { year: +m[1], month: +m[2], day: +m[3] };
  return null;
}

export function birthdayFromParts(day, month, year) {
  day = Number(day); month = Number(month);
  year = year ? Number(year) : null;
  if (!day || !month) return '';
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year ?? 2000, month)) return null;
  const mmdd = `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return year ? `${String(year).padStart(4, '0')}-${mmdd}` : `--${mmdd}`;
}

export function formatBirthday(b) {
  const p = birthdayParts(b);
  if (!p) return '';
  return `${p.day}. ${MONTHS[p.month - 1]}${p.year ? ' ' + p.year : ''}`;
}

export function nextBirthday(b, today) {
  const p = birthdayParts(b);
  if (!p) return null;
  const t = parseISO(today);
  for (const y of [t.y, t.y + 1]) {
    // 29. Februar wird in Nicht-Schaltjahren am 28. Februar angezeigt
    const day = p.month === 2 && p.day === 29 && !isLeapYear(y) ? 28 : p.day;
    const date = isoFromParts(y, p.month, day);
    const daysUntil = daysBetween(today, date);
    if (daysUntil >= 0) return { date, daysUntil, age: p.year ? y - p.year : null };
  }
  return null;
}

export function upcomingBirthdays(contacts, today, within = BIRTHDAY_WINDOW) {
  return contacts
    .map(c => ({ contact: c, next: nextBirthday(c.birthday, today) }))
    .filter(x => x.next && x.next.daysUntil <= within)
    .sort((a, b) => a.next.daysUntil - b.next.daysUntil || byName(a.contact, b.contact));
}

export function todayOverview(contacts, today) {
  const overdue = [], soon = [], unknown = [];
  for (const c of sortByUrgency(contacts, today)) {
    const s = contactStatus(c, today).state;
    if (s === 'overdue') overdue.push(c);
    else if (s === 'soon') soon.push(c);
    else if (s === 'unknown') unknown.push(c);
  }
  return { overdue, soon, unknown, birthdays: upcomingBirthdays(contacts, today) };
}

export function normalizeName(s) {
  return String(s ?? '').normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();
}
