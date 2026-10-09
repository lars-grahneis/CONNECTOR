// Liest vCard-Dateien (.vcf, z. B. aus Google Kontakte): Name, Telefonnummer, Geburtstag.
import { birthdayFromParts } from './model.js';

export function parseVCards(text) {
  const physical = String(text).replace(/\r\n?/g, '\n').split('\n');
  const lines = [];
  for (const line of physical) {
    const prev = lines.length - 1;
    if (prev >= 0 && /^[ \t]/.test(line)) {
      lines[prev] += line.slice(1);
    } else if (prev >= 0 && /QUOTED-PRINTABLE/i.test(lines[prev]) && lines[prev].endsWith('=')) {
      lines[prev] = lines[prev].slice(0, -1) + line;
    } else {
      lines.push(line);
    }
  }

  const cards = [];
  let cur = null;
  for (const line of lines) {
    const colon = line.indexOf(':');
    if (colon < 0) continue;
    const head = line.slice(0, colon);
    let value = line.slice(colon + 1);
    const [nameRaw, ...paramList] = head.split(';');
    const prop = nameRaw.replace(/^[^.]*\./, '').toUpperCase();
    const params = paramList.join(';').toUpperCase();

    if (prop === 'BEGIN' && value.trim().toUpperCase() === 'VCARD') { cur = { fn: '', n: '', tels: [], bday: '' }; continue; }
    if (prop === 'END' && value.trim().toUpperCase() === 'VCARD') {
      if (cur) cards.push(finish(cur));
      cur = null;
      continue;
    }
    if (!cur) continue;

    if (/QUOTED-PRINTABLE/.test(params)) value = decodeQP(value);
    if (prop === 'FN') cur.fn = unescape(value);
    else if (prop === 'N') cur.n = value;
    else if (prop === 'TEL') cur.tels.push({ value: value.trim(), cell: /CELL|MOBILE/.test(params) });
    else if (prop === 'BDAY') cur.bday = value.trim();
  }
  return cards.filter(c => c.name);
}

function finish(c) {
  let name = c.fn.trim();
  if (!name && c.n) {
    const [family = '', given = ''] = c.n.split(';').map(unescape);
    name = `${given} ${family}`.trim();
  }
  const tel = c.tels.find(t => t.cell) || c.tels[0];
  return { name, phone: tel ? tel.value.replace(/^tel:/i, '') : '', birthday: parseBday(c.bday) };
}

function parseBday(v) {
  if (!v) return '';
  let m = /^--(\d{2})-?(\d{2})/.exec(v);
  if (m) return birthdayFromParts(+m[2], +m[1], null) || '';
  m = /^(\d{4})-?(\d{2})-?(\d{2})/.exec(v);
  if (m) {
    // Manche Programme speichern "ohne Jahr" als 1604 oder 0000
    const year = +m[1] > 1800 ? +m[1] : null;
    return birthdayFromParts(+m[3], +m[2], year) || '';
  }
  return '';
}

function unescape(s) {
  return s.replace(/\\([nN,;\\])/g, (_, c) => (c === 'n' || c === 'N' ? '\n' : c));
}

function decodeQP(s) {
  const bytes = [];
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '=' && /^[0-9A-Fa-f]{2}$/.test(s.slice(i + 1, i + 3))) {
      bytes.push(parseInt(s.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      bytes.push(...new TextEncoder().encode(s[i]));
    }
  }
  return new TextDecoder('utf-8').decode(new Uint8Array(bytes));
}
