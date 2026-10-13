// Alle Testdaten sind erfunden.
import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeBytes, parseBackupText, describeFile } from '../js/backup.js';

const json = JSON.stringify({ app: 'connector', format: 'encrypted', data: 'abc' });

test('normale UTF-8-Datei', () => {
  assert.equal(parseBackupText(decodeBytes(new TextEncoder().encode(json))).app, 'connector');
});

test('mit Byte-Order-Mark und Zeilenumbrüchen', () => {
  const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode('\r\n' + json + '\r\n')]);
  assert.equal(parseBackupText(decodeBytes(bytes)).format, 'encrypted');
});

test('als UTF-16 gespeichert', () => {
  const le = new Uint8Array(2 + json.length * 2);
  le[0] = 0xff; le[1] = 0xfe;
  for (let i = 0; i < json.length; i++) le[2 + i * 2] = json.charCodeAt(i);
  assert.equal(parseBackupText(decodeBytes(le)).app, 'connector');
  const noBom = le.subarray(2);
  assert.equal(parseBackupText(decodeBytes(noBom)).app, 'connector');
});

test('Text vor und nach dem Inhalt', () => {
  assert.equal(parseBackupText('Gesendet mit Quick Share\n' + json + '\nEnde').app, 'connector');
});

test('keine Sicherung', () => {
  assert.equal(parseBackupText('09.10.26, 14:32 - Erika: Hallo'), null);
});

test('Diagnose zeigt fremde Inhalte nicht', () => {
  assert.equal(describeFile('x.txt', 10, '', '09.10.26 - Erika: Hallo').start, 'beginnt nicht mit {');
  assert.match(describeFile('s.txt', 10, 'text/plain', json).start, /^\{"app":"connector"/);
});
