// App-Sperre per PIN. Gespeichert wird nur ein Prüfwert (PBKDF2-SHA-256), nie die PIN selbst.
// Die Sperre schützt vor neugierigen Blicken; die Kontaktdaten selbst bleiben unverschlüsselt.
const ITERATIONS = 150000;
const te = new TextEncoder();

export const PIN_MIN = 4;
export const PIN_MAX = 6;
export const FREE_ATTEMPTS = 5;

export function isValidPin(pin) {
  return new RegExp(`^\\d{${PIN_MIN},${PIN_MAX}}$`).test(pin);
}

function toHex(buf) {
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function fromHex(hex) {
  return new Uint8Array(hex.match(/../g).map(h => parseInt(h, 16)));
}

async function derive(pin, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', te.encode(pin), 'PBKDF2', false, ['deriveBits']);
  return toHex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256));
}

export async function createPinRecord(pin, iterations = ITERATIONS) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { salt: toHex(salt), iterations, hash: await derive(pin, salt, iterations), length: pin.length };
}

export async function checkPin(pin, record) {
  if (!record || !isValidPin(pin)) return false;
  const hash = await derive(pin, fromHex(record.salt), record.iterations);
  // Vergleich ohne frühen Abbruch
  let diff = hash.length ^ record.hash.length;
  for (let i = 0; i < hash.length; i++) diff |= hash.charCodeAt(i) ^ record.hash.charCodeAt(i);
  return diff === 0;
}

// Wartezeit nach falschen Eingaben: die ersten 5 Versuche frei, dann 30 s, 60 s, 120 s … bis 15 min.
export function lockoutMs(failCount) {
  if (failCount < FREE_ATTEMPTS) return 0;
  return Math.min(30000 * 2 ** (failCount - FREE_ATTEMPTS), 15 * 60 * 1000);
}
