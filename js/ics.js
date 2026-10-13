// Geburtstage als jährlich wiederkehrende Ganztagstermine (.ics) für Google Kalender.
import { birthdayParts } from './model.js';

export function birthdaysToICS(contacts, now = new Date()) {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const out = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//CONNECTOR//Kontaktpflege//DE', 'CALSCALE:GREGORIAN'];
  for (const c of contacts) {
    const p = birthdayParts(c.birthday);
    if (!p) continue;
    const year = p.year && p.year >= 1900 ? p.year : 2000;
    const mm = String(p.month).padStart(2, '0');
    const dd = String(p.day).padStart(2, '0');
    // 29. Februar: am letzten Tag im Februar, damit der Termin jedes Jahr erscheint
    const rrule = p.month === 2 && p.day === 29
      ? 'RRULE:FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=-1'
      : 'RRULE:FREQ=YEARLY';
    const start = p.month === 2 && p.day === 29 ? `${year}0228` : `${year}${mm}${dd}`;
    out.push(
      'BEGIN:VEVENT',
      `UID:birthday-${c.id}@connector`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${start}`,
      rrule,
      `SUMMARY:${escapeText('Geburtstag: ' + c.name)}`,
      'TRANSP:TRANSPARENT',
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeText('Geburtstag: ' + c.name)}`,
      'TRIGGER:PT9H',
      'END:VALARM',
      'END:VEVENT',
    );
  }
  out.push('END:VCALENDAR');
  return out.map(fold).join('\r\n') + '\r\n';
}

function escapeText(s) {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

// Zeilen nach RFC 5545 auf höchstens 75 Byte falten
function fold(line) {
  const enc = new TextEncoder();
  const parts = [];
  let cur = '', bytes = 0, limit = 75;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    if (bytes + n > limit) { parts.push(cur); cur = ''; bytes = 0; limit = 74; }
    cur += ch; bytes += n;
  }
  parts.push(cur);
  return parts.join('\r\n ');
}
