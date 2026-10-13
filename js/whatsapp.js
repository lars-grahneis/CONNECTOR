// Liest einen WhatsApp-Chat-Export (.txt, "Ohne Medien") nur im Arbeitsspeicher.
// Erkannte Kopfzeilen, z. B.:
//   Android DE:  09.10.26, 14:32 - Max: Hallo
//   Android EN:  10/9/26, 2:32 PM - Max: Hello
//   iOS:         [09.10.26, 14:32:05] Max: Hallo
import { isoFromParts, daysInMonth } from './dates.js';

const HEADER = /^[‎‏﻿]*\[?(\d{1,4})([./-])(\d{1,2})[./-](\d{1,4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:[\s  ]*([AaPp])\.?\s?[Mm]\.?)?\]?(?:\s+-\s+|\s+)(.*)$/;
const INVISIBLE = /[‎‏‪-‮﻿]/g;

export function parseWhatsAppChat(text) {
  const lines = String(text).replace(/\r\n?/g, '\n').split('\n');
  const raw = [];
  for (const line of lines) {
    const m = HEADER.exec(line);
    if (m) {
      raw.push({ a: m[1], sep: m[2], b: m[3], c: m[4], h: +m[5], min: +m[6], ampm: m[8], rest: m[9] });
    } else if (raw.length) {
      raw[raw.length - 1].rest += '\n' + line;
    }
  }
  if (!raw.length) throw new Error('FORMAT');

  const order = detectOrder(raw);
  const messages = [];
  for (const r of raw) {
    const date = toDate(r, order);
    if (!date) continue;
    let h = r.h;
    if (r.ampm) {
      const pm = r.ampm.toLowerCase() === 'p';
      if (h === 12) h = pm ? 12 : 0; else if (pm) h += 12;
    }
    const time = `${String(h).padStart(2, '0')}:${String(r.min).padStart(2, '0')}`;
    const rest = r.rest.replace(INVISIBLE, '');
    const idx = rest.indexOf(': ');
    if (idx > 0 && idx < 80) {
      messages.push({ date, time, sender: rest.slice(0, idx).trim(), text: rest.slice(idx + 2), system: false });
    } else {
      messages.push({ date, time, sender: null, text: rest, system: true });
    }
  }
  const real = messages.filter(m => !m.system);
  if (!real.length) throw new Error('FORMAT');

  const counts = new Map();
  for (const m of real) counts.set(m.sender, (counts.get(m.sender) || 0) + 1);
  const senders = [...counts].map(([name, count]) => ({ name, count })).sort((x, y) => y.count - x.count);

  const last = real[real.length - 1];
  return {
    count: real.length,
    firstDate: real[0].date,
    lastDate: last.date,
    lastTime: last.time,
    senders,
    recent: real.slice(-20),
    order,
  };
}

function detectOrder(raw) {
  if (raw.some(r => r.a.length === 4)) return 'YMD';
  if (raw.some(r => r.sep === '.')) return 'DMY';
  if (raw.some(r => +r.a > 12)) return 'DMY';
  if (raw.some(r => +r.b > 12)) return 'MDY';
  return 'DMY';
}

function toDate(r, order) {
  let y, m, d;
  if (order === 'YMD') { y = +r.a; m = +r.b; d = +r.c; }
  else if (order === 'MDY') { m = +r.a; d = +r.b; y = +r.c; }
  else { d = +r.a; m = +r.b; y = +r.c; }
  if (y < 100) y += 2000;
  if (m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) return null;
  return isoFromParts(y, m, d);
}

// "WhatsApp Chat mit Erika Mustermann.txt" -> "Erika Mustermann"
export function nameFromFileName(fileName) {
  const m = /WhatsApp[\s_-]*Chat[\s_-]*(?:mit|with)[\s_-]+(.+?)(?:\.txt)?$/i.exec(fileName || '');
  return m ? m[1].replace(/_/g, ' ').trim() : '';
}
