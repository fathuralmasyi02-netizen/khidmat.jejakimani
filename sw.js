const CACHE_NAME = 'khidmat-ji-cache-v53';
const ASSETS_TO_CACHE = [
  './index.html',
  './style.css',
  './app.js',
  './assets/logo.png',
  './assets/icon.png',
  './assets/watermark.jpg',
  './assets/kwitansi_bg.png'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch(() => {});
    })
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  
  // Skip Firebase Realtime DB & WebSocket endpoints
  if (e.request.url.includes('firebaseio.com') || e.request.url.includes('firebasedatabase.app')) {
    return;
  }

  // Network-first strategy for scripts and document pages so Vercel & Localhost always sync fresh code!
  if (e.request.mode === 'navigate' || e.request.url.includes('app.js') || e.request.url.includes('index.html')) {
    e.respondWith(
      fetch(e.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const resClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, resClone));
        }
        return networkResponse;
      }).catch(() => {
        return caches.match(e.request);
      })
    );
    return;
  }

  // Fallback for static media assets
  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      if (cachedResponse) {
        fetch(e.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, networkResponse.clone()));
          }
        }).catch(() => {});
        return cachedResponse;
      }
      return fetch(e.request);
    })
  );
});
