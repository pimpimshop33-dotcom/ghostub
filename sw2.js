// ── GHOSTUB Service Worker ──────────────────────────────
const CACHE_NAME = 'ghostub-v87';

// ── INSTALL — pré-cacher uniquement les assets non versionnés ─
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(c => c.addAll(['/ghostub/manifest.json']))
      .then(() => self.skipWaiting())
  );
});

// ── ACTIVATE — vider les anciens caches ─────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── FETCH ────────────────────────────────────────────────
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  const url = e.request.url;
  // Ne jamais intercepter Firestore / APIs Google
  if (url.includes('firestore') || url.includes('googleapis')) return;

  // 1) ASSETS VERSIONNÉS (app.js?v=, style.css?v=) → CACHE-FIRST
  //    L'URL change à chaque bump de version (?v=108, 109…), donc une nouvelle
  //    version = nouvelle URL = re-téléchargée UNE SEULE FOIS, puis servie
  //    instantanément depuis le cache. Fini les 383 Ko re-téléchargés à chaque
  //    ouverture. Les anciennes versions sont purgées au prochain bump de CACHE_NAME.
  const isVersionedAsset = /\/(app\.js|style\.css)\?v=/.test(url);
  if (isVersionedAsset) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(res => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
          }
          return res;
        });
      })
    );
    return;
  }

  // 2) DOCUMENT HTML / NAVIGATION → NETWORK-FIRST (toujours frais en ligne)
  //    Garde tes déploiements visibles immédiatement ; repli sur le cache
  //    si hors-ligne. C'est lui qui référence app.js?v=… donc on le veut à jour.
  const isNavigation =
    e.request.mode === 'navigate' ||
    url.endsWith('/ghostub/') ||
    url.includes('index.html');
  if (isNavigation) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
          }
          return res;
        })
        .catch(() =>
          caches.match(e.request).then(c => c || caches.match('/ghostub/'))
        )
    );
    return;
  }

  // 3) AUTRES RESSOURCES → CACHE-FIRST
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res && res.status === 200 && url.startsWith(self.location.origin)) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        }
        return res;
      });
    })
  );
});

// ── PUSH ─────────────────────────────────────────────────
self.addEventListener('push', e => {
  let data = {};
  try { data = e.data?.json() || {}; } catch(err) {}
  const title = data.title || '\ud83d\udc7b Ghostub — message proche';
  const body  = data.body  || 'Un message vous attend dans votre quartier.';
  const icon  = data.icon  || 'https://raw.githubusercontent.com/pimpimshop33-dotcom/ghostub/main/icon.png';
  const url   = data.url   || '/ghostub/';
  const tag   = data.tag   || 'ghostub-nearby';
  e.waitUntil(
    self.registration.showNotification(title, {
      body, icon, badge: icon, tag,
      vibrate: [200, 100, 200, 100, 200],
      data: { url },
      actions: [{ action: 'open', title: '\ud83d\udc41 Voir' }, { action: 'dismiss', title: 'Plus tard' }]
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

// ── MESSAGE ──────────────────────────────────────────────
self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (e.data?.type === 'NOTIFY_NEARBY') {
    const { title, body, tag } = e.data;
    self.registration.showNotification(title || '\ud83d\udc7b Ghostub', {
      body: body || 'Un message vous attend.',
      icon: 'https://raw.githubusercontent.com/pimpimshop33-dotcom/ghostub/main/icon.png',
      tag: tag || 'ghostub-nearby',
      vibrate: [200, 100, 200],
      data: { url: '/ghostub/' }
    });
  }
});
