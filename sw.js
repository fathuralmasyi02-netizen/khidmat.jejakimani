const CACHE_NAME = 'khidmat-ji-cache-v13';
const ASSETS_TO_CACHE = [
  './index.html',
  './style.css',
  './app.js',
  './assets/logo.png',
  './assets/icon.png',
  './assets/watermark.jpg'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
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
  // Only cache GET requests
  if (e.request.method !== 'GET') {
    return;
  }
  // Skip Firebase RTDB websockets or network fetch endpoints
  if (e.request.url.includes('firebaseio.com') || e.request.url.includes('firebasedatabase.app')) {
    return;
  }
  
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((cachedResponse) => {
      if (cachedResponse) {
        fetch(e.request).then((networkResponse) => {
          if (networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(e.request, networkResponse);
            });
          }
        }).catch(() => {});
        return cachedResponse;
      }
      return fetch(e.request);
    })
  );
});
