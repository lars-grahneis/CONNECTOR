// Sicherungsdatei lesen, tolerant gegenüber Veränderungen beim Übertragen
// (Byte-Order-Mark, UTF-16, Leerzeilen oder Text vor/nach dem eigentlichen Inhalt).

export function decodeBytes(bytes) {
  bytes = new Uint8Array(bytes);
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes.subarray(2));
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes.subarray(2));
  // UTF-16 ohne Kennung: viele Null-Bytes an ungeraden bzw. geraden Stellen
  if (bytes.length > 3 && bytes[1] === 0 && bytes[3] === 0) return new TextDecoder('utf-16le').decode(bytes);
  if (bytes.length > 3 && bytes[0] === 0 && bytes[2] === 0) return new TextDecoder('utf-16be').decode(bytes);
  return new TextDecoder('utf-8').decode(bytes).replace(/^﻿/, '');
}

export function parseBackupText(text) {
  const t = String(text).replace(/^﻿/, '').trim();
  try { return JSON.parse(t); } catch { /* weiter unten */ }
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a >= 0 && b > a) {
    try { return JSON.parse(t.slice(a, b + 1)); } catch { /* nicht lesbar */ }
  }
  return null;
}

// Kurzbeschreibung für die Fehlersuche. Zeigt nur die ersten Zeichen, und nur wenn
// sie nach einer CONNECTOR-Datei aussehen; sonst nichts vom Inhalt.
export function describeFile(name, size, type, text) {
  const head = String(text).replace(/^﻿/, '').trimStart().slice(0, 40);
  const looksLikeOurs = head.startsWith('{"app":"connector"') || head.startsWith('{\n  "app": "connector"');
  return {
    name, size, type: type || 'unbekannt',
    start: looksLikeOurs ? head : (head.startsWith('{') ? 'beginnt mit {, aber nicht als CONNECTOR-Datei' : 'beginnt nicht mit {'),
  };
}
