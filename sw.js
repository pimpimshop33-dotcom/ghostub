// Fantôme — Service Worker
const CACHE = 'fantome-v1';

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(self.clients.claim());
});

// Réception d'une notification push
self.addEventListener('push', e => {
  const data = e.data ? e.data.json() : {};
  const title = data.title || '👻 Fantôme';
  const options = {
    body: data.body || 'Un fantôme est proche de vous.',
    icon: data.icon || '/fantome/icon.png',
    badge: '/fantome/icon.png',
    tag: data.tag || 'fantome',
    data: { url: data.url || '/fantome/' },
    vibrate: [200, 100, 200],
    requireInteraction: false
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

// Clic sur la notification → ouvre l'app
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || '/fantome/';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      for (const client of clients) {
        if (client.url.includes('/fantome/') && 'focus' in client) return client.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});

// Vérification périodique en arrière-plan (Background Sync)
self.addEventListener('periodicsync', e => {
  if (e.tag === 'check-ghosts') {
    e.waitUntil(checkNearbyGhosts());
  }
});

async function checkNearbyGhosts() {
  // Le vrai check se fait dans l'app — ici on notifie juste si nécessaire
  const clients = await self.clients.matchAll();
  if (clients.length > 0) return; // App ouverte, elle gère elle-même
}
