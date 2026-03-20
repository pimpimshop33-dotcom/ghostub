/**
 * GHOSTUB - Service Worker v3 (optimisé)
 * Stratégie : Network First pour les assets critiques, Cache First pour le reste
 * Avec fallback hors-ligne élégant
 */

const CACHE_NAME = 'ghostub-v23';
const STATIC_ASSETS = [
  '/ghostub/manifest.json',
  '/ghostub/icon.png',
  '/ghostub/ghost-design-v2.css'
];

// Fichiers à toujours servir depuis le réseau (jamais mis en cache)
const NETWORK_ONLY = [
  '/ghostub/app.js',
  '/ghostub/index.html',
  '/ghostub/ghost-micro.js'
];

// ── INSTALL — Pré-cacher les assets statiques ─────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ── ACTIVATE — Nettoyer les anciens caches ─────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── FETCH — Stratégie intelligente ─────────────────────────
self.addEventListener('fetch', e => {
  const url = e.request.url;
  const isGet = e.request.method === 'GET';
  
  if (!isGet) return;
  
  // Ne pas intercepter les appels Firebase/Cloudinary/API externes
  if (url.includes('firestore') || 
      url.includes('googleapis') || 
      url.includes('cloudinary') ||
      url.includes('nominatim')) {
    return;
  }
  
  // Fichiers critiques : réseau en priorité, cache en fallback
  const isCritical = NETWORK_ONLY.some(asset => url.includes(asset));
  
  if (isCritical) {
    e.respondWith(
      fetch(e.request, { cache: 'no-store' })
        .then(res => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }
  
  // Images, CSS, fonts : cache-first avec fallback réseau
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      
      return fetch(e.request).then(res => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => {
        // Fallback hors-ligne pour les images
        if (url.match(/\.(jpg|jpeg|png|gif|svg)$/i)) {
          return caches.match('/ghostub/icon.png');
        }
        return new Response('Ressource indisponible hors-ligne', { status: 404 });
      });
    })
  );
});

// ── PUSH NOTIFICATION — Améliorée ──────────────────────────
self.addEventListener('push', e => {
  let data = {};
  try { 
    data = e.data?.json() || {}; 
  } catch(err) {}
  
  const title = data.title || '👻 Ghostub';
  const body  = data.body  || 'Un message vous attend dans votre quartier.';
  const icon  = data.icon  || '/ghostub/icon.png';
  const url   = data.url   || '/ghostub/';
  const tag   = data.tag   || 'ghostub-nearby';
  const vibrate = data.vibrate || [200, 100, 200, 100, 200];
  
  e.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge: icon,
      tag,
      vibrate,
      data: { url, timestamp: Date.now() },
      actions: [
        { action: 'open', title: '👁 Voir' },
        { action: 'dismiss', title: 'Plus tard' }
      ]
    })
  );
});

// ── NOTIFICATION CLICK — Améliorée avec analytics ──────────
self.addEventListener('notificationclick', e => {
  e.notification.close();
  
  if (e.action === 'dismiss') return;
  
  const url = e.notification.data?.url || '/ghostub/';
  const timestamp = e.notification.data?.timestamp;
  
  // Analytics léger (stockage local du SW)
  e.waitUntil(
    (async () => {
      const cache = await caches.open('ghostub-analytics');
      const analytics = { event: 'notification_click', url, timestamp: timestamp || Date.now() };
      await cache.put('/analytics/last_click', new Response(JSON.stringify(analytics)));
      
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of clients) {
        if (client.url.includes('/ghostub') && 'focus' in client) {
          client.postMessage({ type: 'NOTIFICATION_CLICKED', url });
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })()
  );
});

// ── MESSAGE — Communication avec l'app principale ──────────
self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (e.data?.type === 'NOTIFY_NEARBY') {
    const { title, body, tag, icon } = e.data;
    self.registration.showNotification(
      title || '👻 Ghostub',
      {
        body: body || 'Un message vous attend.',
        icon: icon || '/ghostub/icon.png',
        badge: '/ghostub/icon.png',
        tag: tag || 'ghostub-nearby',
        vibrate: [200, 100, 200],
        data: { url: '/ghostub/' }
      }
    );
  }
  
  if (e.data?.type === 'GET_ANALYTICS') {
    e.waitUntil(
      (async () => {
        const cache = await caches.open('ghostub-analytics');
        const response = await cache.match('/analytics/last_click');
        if (response) {
          const data = await response.json();
          e.source.postMessage({ type: 'ANALYTICS_DATA', data });
        }
      })()
    );
  }
});
