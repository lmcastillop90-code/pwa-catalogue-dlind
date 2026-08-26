/* DLIND Catálogo — Service Worker (offline-first) */
const CACHE = 'dlind-catalogo-v15';
const PRECACHE = [
  './',
  './index.html',
  './gestion.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './videos/rr99-rendimiento.mp4',
  './videos/pt-ce-29580.mp4',
  './videos/pt-pp-12225.mp4',
  './videos/pt-tracpro-29580.mp4',
  './videos/pt-tracpro-31580.mp4',
  './videos/rr705a-rr208.mp4',
  './img/DC-RLB450-12225_1.webp',
  './img/DC-RLB450-12225_2.webp',
  './img/DC-RLB450-12225_3.webp',
  './img/DC-RLB460-12225_1.webp',
  './img/DC-RLB460-12225_2.webp',
  './img/DC-RR208-29580_1.webp',
  './img/DC-RR208-29580_2.webp',
  './img/DC-RR208-29580_3.webp',
  './img/DC-RR680-29580_1.webp',
  './img/DC-RR680-29580_2.webp',
  './img/DC-RR680-29580_3.webp',
  './img/DC-RR705A-12225_1.webp',
  './img/DC-RR705A-12225_2.webp',
  './img/DC-RR705A-12225_3.webp',
  './img/DC-RR706-29580_1.webp',
  './img/DC-RR706-29580_2.webp',
  './img/DC-RR706-29580_3.webp',
  './img/DC-RR902-31580_1.webp',
  './img/DC-RR902-31580_2.webp',
  './img/DC-RR902-31580_3.webp',
  './img/DC-RR99-12225_1.webp',
  './img/DC-RR99-12225_2.webp',
  './img/DC-RR99-12225_3.webp',
  './img/DC-RR99-29580_1.webp',
  './img/DC-RR99-29580_2.webp',
  './img/DC-RR99-29580_3.webp',
  './img/DD-15W40_1.webp',
  './img/DD-15W40_2.webp',
  './img/DD-80W90_1.webp',
  './img/DD-SAE50_1.webp',
  './img/FP-4515_1.webp',
  './img/FP-4515_2.webp',
  './img/FP-4707_1.webp',
  './img/FP-4709_1.webp',
  './img/FP-4709_2.webp',
  './img/GR-ALTATEMP_1.webp',
  './img/GR-LS2_1.webp',
  './img/PT-CE-12225_1.webp',
  './img/PT-CE-12225_2.webp',
  './img/PT-CE-12225_3.webp',
  './img/PT-PP-12225_1.webp',
  './img/PT-PP-12225_2.webp',
  './img/PT-PP-12225_3.webp',
  './img/PT-PP-29580_1.webp',
  './img/PT-PP-29580_2.webp',
  './img/PT-PP-29580_3.webp',
  './img/poster_rr99.webp',
  './img/poster_ce29580.webp',
  './img/poster_pp12225.webp',
  './img/poster_tracpro29580.webp',
  './img/poster_tracpro31580.webp',
  './img/PT-TRACPRO-29580_1.webp',
  './img/PT-TRACPRO-29580_2.webp',
  './img/PT-CE-29580_1.webp',
  './img/PT-CE-29580_2.webp',
  './img/PT-CE-29580_3.webp',
  './img/PT-CE-31580_1.webp',
  './img/PT-CE-31580_2.webp',
  './img/PT-CE-31580_3.webp',
  './img/PT-TRACPRO-31580_1.webp',
  './img/PT-TRACPRO-31580_2.webp',
  './img/BT-30H_1.webp',
  './img/BT-31H_1.webp',
  './img/BT-31H_2.webp',
  './img/FT-224804_1.webp',
  './img/FT-224804_2.webp',
  './img/FT-224935_1.webp',
  './img/FT-224935_2.webp',
  './img/FT-224935_3.webp',
  './img/poster_rr705a.webp'
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
    renotify: true,   // misma etiqueta = reemplaza el aviso anterior PERO vuelve a sonar y mostrarse
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
