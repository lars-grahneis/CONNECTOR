import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidPin, createPinRecord, checkPin, lockoutMs } from '../js/lock.js';

test('PIN-Format', () => {
  assert.ok(isValidPin('1234'));
  assert.ok(isValidPin('123456'));
  assert.ok(!isValidPin('123'));
  assert.ok(!isValidPin('1234567'));
  assert.ok(!isValidPin('12a4'));
});

test('PIN prüfen, PIN nicht im Klartext gespeichert', async () => {
  const rec = await createPinRecord('4711', 1000);
  assert.ok(!JSON.stringify(rec).includes('4711'));
  assert.equal(rec.length, 4);
  assert.ok(await checkPin('4711', rec));
  assert.ok(!(await checkPin('4712', rec)));
  assert.ok(!(await checkPin('47110', rec)));
});

test('Wartezeit nach Fehlversuchen', () => {
  assert.equal(lockoutMs(4), 0);
  assert.equal(lockoutMs(5), 30000);
  assert.equal(lockoutMs(6), 60000);
  assert.equal(lockoutMs(20), 15 * 60 * 1000);
});
