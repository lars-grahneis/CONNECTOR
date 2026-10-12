// Verschlüsselung von Sicherungsdateien mit Passwort (AES-GCM, Schlüssel per PBKDF2-SHA-256).
// Läuft vollständig im Browser über die Web Crypto API.
const ITERATIONS = 600000;
const te = new TextEncoder();
const td = new TextDecoder();

function toB64(bytes) {
  bytes = new Uint8Array(bytes);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function fromB64(s) {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function deriveKey(password, salt, iterations) {
  const base = await crypto.subtle.importKey('raw', te.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export function isEncrypted(o) {
  return !!o && o.app === 'connector' && o.format === 'encrypted';
}

export async function encryptJSON(obj, password, iterations = ITERATIONS) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt, iterations);
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, te.encode(JSON.stringify(obj)));
  return {
    app: 'connector',
    format: 'encrypted',
    version: 1,
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations, salt: toB64(salt) },
    cipher: { name: 'AES-GCM', iv: toB64(iv) },
    data: toB64(data),
  };
}

// Wirft Error('PASSWORD'), wenn das Passwort falsch oder die Datei verändert ist.
export async function decryptJSON(envelope, password) {
  const key = await deriveKey(password, fromB64(envelope.kdf.salt), envelope.kdf.iterations);
  let plain;
  try {
    plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(envelope.cipher.iv) }, key, fromB64(envelope.data));
  } catch {
    throw new Error('PASSWORD');
  }
  return JSON.parse(td.decode(plain));
}
