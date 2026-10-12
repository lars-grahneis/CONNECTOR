// Alle Testdaten sind erfunden.
import test from 'node:test';
import assert from 'node:assert/strict';
import { encryptJSON, decryptJSON, isEncrypted } from '../js/crypto.js';

test('Sicherung verschlüsseln und entschlüsseln', async () => {
  const data = { app: 'connector', contacts: [{ id: '1', name: 'Erika Mustermann', followUp: 'Nach Umzug fragen' }] };
  const env = await encryptJSON(data, 'geheim-123', 1000);
  assert.ok(isEncrypted(env));
  assert.doesNotMatch(JSON.stringify(env), /Erika|Umzug/);
  assert.deepEqual(await decryptJSON(env, 'geheim-123'), data);
  await assert.rejects(decryptJSON(env, 'falsch-123'), /PASSWORD/);
});

test('Zwei Verschlüsselungen desselben Inhalts unterscheiden sich', async () => {
  const a = await encryptJSON({ x: 1 }, 'geheim-123', 1000);
  const b = await encryptJSON({ x: 1 }, 'geheim-123', 1000);
  assert.notEqual(a.data, b.data);
  assert.notEqual(a.kdf.salt, b.kdf.salt);
});

test('Standard: 600000 PBKDF2-Iterationen', async () => {
  const env = await encryptJSON({ x: 1 }, 'geheim-123');
  assert.equal(env.kdf.iterations, 600000);
});
