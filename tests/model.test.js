// Alle Testdaten sind erfunden.
import test from 'node:test';
import assert from 'node:assert/strict';
import { addDays, daysBetween, formatDE, relativeDays } from '../js/dates.js';
import { contactStatus, sortByUrgency, nextBirthday, upcomingBirthdays, birthdayFromParts, formatBirthday, todayOverview } from '../js/model.js';
import { waNumber } from '../js/phone.js';

test('Datumsrechnung', () => {
  assert.equal(addDays('2026-02-27', 2), '2026-03-01');
  assert.equal(addDays('2028-02-27', 2), '2028-02-29');
  assert.equal(daysBetween('2026-10-01', '2026-10-29'), 28);
  assert.equal(formatDE('2026-03-05'), '05.03.2026');
  assert.equal(relativeDays(-3), 'vor 3 Tagen');
  assert.equal(relativeDays(1), 'morgen');
});

test('Fälligkeit nach Rhythmus', () => {
  const today = '2026-10-09';
  assert.equal(contactStatus({ lastContact: '2026-09-01', rhythmDays: 28 }, today).state, 'overdue');
  assert.equal(contactStatus({ lastContact: '2026-09-11', rhythmDays: 28 }, today).state, 'overdue'); // heute fällig
  assert.equal(contactStatus({ lastContact: '2026-09-15', rhythmDays: 28 }, today).state, 'soon');
  assert.equal(contactStatus({ lastContact: '2026-10-05', rhythmDays: 28 }, today).state, 'ok');
  assert.equal(contactStatus({ lastContact: '2026-10-05', rhythmDays: 7 }, today).state, 'soon');
  assert.equal(contactStatus({}, today).state, 'unknown');
});

test('Sortierung: überfällig zuerst, dann ohne Datum, dann bald, dann ok', () => {
  const today = '2026-10-09';
  const list = [
    { name: 'Ok', lastContact: '2026-10-08', rhythmDays: 28 },
    { name: 'Neu' },
    { name: 'Sehr alt', lastContact: '2026-01-01', rhythmDays: 28 },
    { name: 'Bald', lastContact: '2026-09-14', rhythmDays: 28 },
    { name: 'Alt', lastContact: '2026-09-01', rhythmDays: 28 },
  ];
  assert.deepEqual(sortByUrgency(list, today).map(c => c.name), ['Sehr alt', 'Alt', 'Neu', 'Bald', 'Ok']);
  const o = todayOverview(list, today);
  assert.equal(o.overdue.length, 2);
  assert.equal(o.soon.length, 1);
  assert.equal(o.unknown.length, 1);
});

test('Geburtstage', () => {
  assert.equal(birthdayFromParts(15, 3, 1985), '1985-03-15');
  assert.equal(birthdayFromParts(29, 2, ''), '--02-29');
  assert.equal(birthdayFromParts(31, 4, 1990), null);
  assert.equal(formatBirthday('1985-03-15'), '15. März 1985');
  assert.deepEqual(nextBirthday('1985-10-20', '2026-10-09'), { date: '2026-10-20', daysUntil: 11, age: 41 });
  assert.deepEqual(nextBirthday('--01-02', '2026-12-30'), { date: '2027-01-02', daysUntil: 3, age: null });
  assert.equal(nextBirthday('--02-29', '2027-02-20').date, '2027-02-28');
  assert.equal(nextBirthday('--10-09', '2026-10-09').daysUntil, 0);
  const up = upcomingBirthdays([
    { name: 'A', birthday: '--10-30' }, { name: 'B', birthday: '--10-12' }, { name: 'C', birthday: '--10-23' },
  ], '2026-10-09');
  assert.deepEqual(up.map(x => x.contact.name), ['B', 'C']);
});

test('WhatsApp-Nummer', () => {
  assert.equal(waNumber('0171 1234567'), '491711234567');
  assert.equal(waNumber('+49 (171) 123-4567'), '491711234567');
  assert.equal(waNumber('0043 660 1234567'), '436601234567');
  assert.equal(waNumber(''), '');
});
