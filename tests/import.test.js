// Alle Testdaten sind erfunden.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseWhatsAppChat, nameFromFileName } from '../js/whatsapp.js';
import { parseVCards } from '../js/vcard.js';
import { birthdaysToICS } from '../js/ics.js';

test('WhatsApp Android deutsch', () => {
  const txt = [
    '01.09.26, 09:15 - Nachrichten und Anrufe sind Ende-zu-Ende-verschlüsselt. Tippe, um mehr zu erfahren.',
    '01.09.26, 09:16 - Erika Mustermann: Hallo, wie geht es dir?',
    '01.09.26, 09:20 - Max Beispiel: Gut, danke!',
    'Zweite Zeile derselben Nachricht',
    '03.10.26, 18:05 - Erika Mustermann: <Medien ausgeschlossen>',
  ].join('\n');
  const r = parseWhatsAppChat(txt);
  assert.equal(r.count, 3);
  assert.equal(r.firstDate, '2026-09-01');
  assert.equal(r.lastDate, '2026-10-03');
  assert.equal(r.lastTime, '18:05');
  assert.equal(r.recent[1].text, 'Gut, danke!\nZweite Zeile derselben Nachricht');
  assert.deepEqual(r.senders.map(s => s.name), ['Erika Mustermann', 'Max Beispiel']);
});

test('WhatsApp Android mit vierstelligem Jahr', () => {
  const r = parseWhatsAppChat('09.10.2026, 07:01 - Erika: Guten Morgen');
  assert.equal(r.lastDate, '2026-10-09');
});

test('WhatsApp englisch mit AM/PM', () => {
  const r = parseWhatsAppChat('10/9/26, 2:32 PM - Erika: Hello\n10/13/26, 12:05 AM - Max: Hi');
  assert.equal(r.order, 'MDY');
  assert.equal(r.lastDate, '2026-10-13');
  assert.equal(r.lastTime, '00:05');
  assert.equal(r.recent[0].time, '14:32');
});

test('WhatsApp iOS', () => {
  const r = parseWhatsAppChat('‎[09.10.26, 14:32:05] Erika Mustermann: Hallo\n[10.10.26, 08:00:00] Max: Hi');
  assert.equal(r.lastDate, '2026-10-10');
  assert.equal(r.recent[0].sender, 'Erika Mustermann');
});

test('WhatsApp unbekanntes Format', () => {
  assert.throws(() => parseWhatsAppChat('Das ist kein Chat'), /FORMAT/);
});

test('Name aus Dateiname', () => {
  assert.equal(nameFromFileName('WhatsApp Chat mit Erika Mustermann.txt'), 'Erika Mustermann');
  assert.equal(nameFromFileName('WhatsApp-Chat mit Max.txt'), 'Max');
  assert.equal(nameFromFileName('notizen.txt'), '');
});

test('vCard', () => {
  const vcf = [
    'BEGIN:VCARD', 'VERSION:3.0', 'FN:Erika Mustermann', 'N:Mustermann;Erika;;;',
    'TEL;TYPE=HOME:+49 30 1234567', 'TEL;TYPE=CELL:+49 171 1234567', 'BDAY:1985-03-15', 'END:VCARD',
    'BEGIN:VCARD', 'VERSION:2.1', 'N;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:M=C3=BCller;J=C3=B6rg;;;',
    'item1.TEL:0171 7654321', 'BDAY:--0704', 'END:VCARD',
    'BEGIN:VCARD', 'VERSION:3.0', 'FN:Lang', ' er Name', 'BDAY:16040229', 'END:VCARD',
  ].join('\r\n');
  const cards = parseVCards(vcf);
  assert.deepEqual(cards, [
    { name: 'Erika Mustermann', phone: '+49 171 1234567', birthday: '1985-03-15' },
    { name: 'Jörg Müller', phone: '0171 7654321', birthday: '--07-04' },
    { name: 'Langer Name', phone: '', birthday: '--02-29' },
  ]);
});

test('Kalenderdatei', () => {
  const ics = birthdaysToICS([
    { id: 'a1', name: 'Erika Mustermann', birthday: '1985-03-15' },
    { id: 'b2', name: 'Ohne Geburtstag' },
    { id: 'c3', name: 'Schaltjahr, Kind', birthday: '--02-29' },
  ], new Date('2026-10-09T10:00:00Z'));
  assert.match(ics, /DTSTART;VALUE=DATE:19850315\r\nRRULE:FREQ=YEARLY\r\n/);
  assert.match(ics, /SUMMARY:Geburtstag: Schaltjahr\\, Kind/);
  assert.match(ics, /BYMONTHDAY=-1/);
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 2);
  assert.ok(ics.split('\r\n').every(l => new TextEncoder().encode(l).length <= 75));
});
