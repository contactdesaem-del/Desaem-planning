// ══════════════════════════════════════════════════════════════════════════════
// DESAEM — Service Worker (PWA + Notifications Push)
// ══════════════════════════════════════════════════════════════════════════════

const CACHE_NAME = 'desaem-v1';
const BASE = '/Desaem-planning';

// ── INSTALLATION : mise en cache des ressources de base ──────────────────────
self.addEventListener('install', event => {
  console.log('[SW] Install');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll([
        BASE + '/',
        BASE + '/index.html',
        BASE + '/manifest.json'
      ]).catch(e => console.log('[SW] Cache partiel:', e.message));
    })
  );
  self.skipWaiting();
});

// ── ACTIVATION ────────────────────────────────────────────────────────────────
self.addEventListener('activate', event => {
  console.log('[SW] Activate');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── FETCH : network first, fallback cache ─────────────────────────────────────
self.addEventListener('fetch', event => {
  // Ne pas intercepter les requêtes vers Google Apps Script
  if (event.request.url.includes('script.google.com')) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Mettre en cache les réponses réussies
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// ── PUSH NOTIFICATIONS ────────────────────────────────────────────────────────
self.addEventListener('push', event => {
  let data = { title: 'DESAEM', body: 'Nouvelle notification', tag: 'desaem-notif' };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch(e) {}

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: BASE + '/icon-192.png',
      badge: BASE + '/icon-192.png',
      tag: data.tag || 'desaem-notif',
      renotify: true,
      vibrate: [200, 100, 200],
      data: { url: data.url || BASE + '/' }
    })
  );
});

// ── CLIC SUR UNE NOTIFICATION ─────────────────────────────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url)
    ? event.notification.data.url
    : BASE + '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      // Si l'app est déjà ouverte, focus dessus
      for (const client of clientList) {
        if (client.url.includes('Desaem-planning') && 'focus' in client) {
          return client.focus();
        }
      }
      // Sinon ouvrir un nouvel onglet
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

// ── MESSAGES DEPUIS L'APP ─────────────────────────────────────────────────────
// L'app envoie des messages au SW pour déclencher des notifications locales
// (utilisé pour les alertes tchat et missions sans serveur push externe)
self.addEventListener('message', event => {
  if (!event.data) return;

  if (event.data.type === 'NOTIFY') {
    self.registration.showNotification(event.data.title || 'DESAEM', {
      body: event.data.body || '',
      icon: BASE + '/icon-192.png',
      badge: BASE + '/icon-192.png',
      tag: event.data.tag || 'desaem-notif',
      renotify: true,
      vibrate: [200, 100, 200],
      data: { url: BASE + '/' }
    });
  }
});
