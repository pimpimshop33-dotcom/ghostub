// ── GHOSTUB Service Worker ──────────────────────────────
// Version auto-générée au build — ne pas modifier manuellement
const CACHE_NAME = 'ghostub-v16';
const STATIC = [
  '/ghostub/',
  '/ghostub/index.html',
  '/ghostub/app.js',
  '/ghostub/style.css',
  '/ghostub/manifest.json'
];
// ── INSTALL ─────────────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(c => c.addAll(STATIC)).then(() => self.skipWaiting())
  );
});
// ── ACTIVATE ────────────────────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});
// ── FETCH — Network first, cache fallback ───────────────
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (e.request.url.includes('firestore') || e.request.url.includes('googleapis')) return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res && res.status === 200 && e.request.url.startsWith(self.location.origin)) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
// ── PUSH — Notification fantôme proche ──────────────────
self.addEventListener('push', e => {
  let data = {};
  try { data = e.data?.json() || {}; } catch(err) {}
  const title   = data.title   || '👻 Ghostub — message proche';
  const body    = data.body    || 'Un message vous attend dans votre quartier.';
  const icon    = data.icon    || 'https://raw.githubusercontent.com/pimpimshop33-dotcom/ghostub/main/icon.png';
  const url     = data.url     || '/ghostub/';
  const tag     = data.tag     || 'ghostub-nearby';
  e.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge: icon,
      tag,
      vibrate: [200, 100, 200, 100, 200],
      data: { url },
      actions: [
        { action: 'open',    title: '👁 Voir' },
        { action: 'dismiss', title: 'Plus tard' }
      ]
    })
  );
});
// ── NOTIFICATION CLICK ───────────────────────────────────
self.addEventListener('notificationclick', e => {
  e.notification.close();
  if (e.action === 'dismiss') return;
  const url = e.notification.data?.url || '/ghostub/';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if (client.url.includes('/ghostub') && 'focus' in client) return client.focus();
      }
      return clients.openWindow(url);
    })
  );
});
// ── MESSAGE depuis l'app ─────────────────────────────────
self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (e.data?.type === 'NOTIFY_NEARBY') {
    const { title, body, tag } = e.data;
    self.registration.showNotification(title || '👻 Ghostub — message proche', {
      body: body || 'Un message vous attend.',
      icon: 'https://raw.githubusercontent.com/pimpimshop33-dotcom/ghostub/main/icon.png',
      tag: tag || 'ghostub-nearby',
      vibrate: [200, 100, 200],
      data: { url: '/ghostub/' }
    });
  }
});
