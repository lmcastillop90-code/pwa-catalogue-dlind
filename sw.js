/* DLIND Catálogo — Service Worker (offline-first) */
const CACHE = 'dlind-catalogo-v3';
const PRECACHE = [
  './',
  './index.html',
  './gestion.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './videos/rr99-rendimiento.mp4'
];
/* dominios que NUNCA se cachean (datos vivos y APIs) */
const LIVE = ['firestore.googleapis.com', 'identitytoolkit.googleapis.com',
              'securetoken.googleapis.com', 'fcmregistrations.googleapis.com', '/api/'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

/* Estrategia: cache primero, red como respaldo (y actualiza el caché en segundo plano).
   Los datos vivos (Firestore, Auth, API) van SIEMPRE a la red. */
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (LIVE.some(d => e.request.url.includes(d))) return; // datos vivos: red directa
  e.respondWith(
    caches.match(e.request).then(cached => {
      const fetched = fetch(e.request).then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || fetched;
    })
  );
});

/* ===== Notificaciones push (FCM) ===== */
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data.json(); } catch (_) {}
  const n = d.notification || (d.data && d.data.notification) || {};
  e.waitUntil(self.registration.showNotification(n.title || 'DLIND', {
    body: n.body || '',
    icon: n.icon || './icons/icon-192.png',
    badge: './icons/icon-192.png',
    tag: n.tag || 'dlind',
    data: { link: (d.fcmOptions && d.fcmOptions.link) || (d.data && d.data.link) || './gestion.html' }
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const link = (e.notification.data && e.notification.data.link) || './';
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) { if ('focus' in c) { c.navigate(link); return c.focus(); } }
    return clients.openWindow(link);
  }));
});
