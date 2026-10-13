// Lokaler Speicher im Browser (IndexedDB). Nichts davon verlässt das Gerät.
const DB_NAME = 'connector';
const DB_VERSION = 1;
let dbPromise;

function open() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('contacts')) db.createObjectStore('contacts', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

async function tx(store, mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const result = fn(t.objectStore(store));
    t.oncomplete = () => resolve(result && 'result' in result ? result.result : undefined);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export const getAllContacts = () => tx('contacts', 'readonly', s => s.getAll());
export const putContact = c => tx('contacts', 'readwrite', s => { s.put(c); });
export const deleteContact = id => tx('contacts', 'readwrite', s => { s.delete(id); });

export const putContacts = list => tx('contacts', 'readwrite', s => { for (const c of list) s.put(c); });
export const replaceContacts = list => tx('contacts', 'readwrite', s => { s.clear(); for (const c of list) s.put(c); });

export async function getMeta(key) {
  const row = await tx('meta', 'readonly', s => s.get(key));
  return row ? row.value : undefined;
}
export const setMeta = (key, value) => tx('meta', 'readwrite', s => { s.put({ key, value }); });

export async function clearAll() {
  await tx('contacts', 'readwrite', s => { s.clear(); });
  await tx('meta', 'readwrite', s => { s.clear(); });
}
