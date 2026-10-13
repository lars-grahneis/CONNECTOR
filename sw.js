// Service Worker: hält die App-Dateien für den Offline-Betrieb vor.
// Er speichert nur Programmdateien, keine Kontaktdaten.
const CACHE = 'connector-v5';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './manifest.webmanifest',
  './js/app.js',
  './js/db.js',
  './js/dates.js',
  './js/model.js',
  './js/whatsapp.js',
  './js/vcard.js',
  './js/ics.js',
  './js/phone.js',
  './js/crypto.js',
  './js/backup.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== 'connector-share').map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Erst Netz (damit Updates sofort ankommen), ohne Netz aus dem Zwischenspeicher.
self.addEventListener('fetch', e => {
  const req = e.request;
  // „Teilen → CONNECTOR“ (Web Share Target): Datei kurz ablegen, dann die App öffnen.
  // Die App holt sie dort sofort ab und löscht sie wieder.
  if (req.method === 'POST' && new URL(req.url).pathname.endsWith('/share-target')) {
    e.respondWith((async () => {
      const form = await req.formData();
      const file = form.get('file');
      if (file && typeof file !== 'string') {
        const cache = await caches.open('connector-share');
        await cache.put('./shared-file', new Response(file, {
          headers: { 'Content-Type': file.type || 'text/plain', 'X-File-Name': encodeURIComponent(file.name || 'geteilt.txt') },
        }));
      }
      return Response.redirect('./#/geteilt', 303);
    })());
    return;
  }
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req)
      .then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true })
        .then(hit => hit || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error()))),
  );
});
