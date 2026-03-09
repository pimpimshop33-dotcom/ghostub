// ── FANTÔME Service Worker ──────────────────────────────
const CACHE_NAME = 'fantome-v11';
const STATIC = ['/fantome/', '/fantome/index.html', '/fantome/manifest.json'];

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

  const title   = data.title   || '👻 Fantôme proche';
  const body    = data.body    || 'Un message vous attend dans votre quartier.';
  const icon    = data.icon    || 'https://raw.githubusercontent.com/pimpimshop33-dotcom/fantome/main/icon.png';
  const url     = data.url     || '/fantome/';
  const tag     = data.tag     || 'fantome-nearby';

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
  const url = e.notification.data?.url || '/fantome/';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if (client.url.includes('/fantome') && 'focus' in client) return client.focus();
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
    self.registration.showNotification(title || '👻 Fantôme proche', {
      body: body || 'Un message vous attend.',
      icon: 'https://raw.githubusercontent.com/pimpimshop33-dotcom/fantome/main/icon.png',
      tag: tag || 'fantome-nearby',
      vibrate: [200, 100, 200],
      data: { url: '/fantome/' }
    });
  }
});
