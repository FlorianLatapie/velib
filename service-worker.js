const CACHE_NAME = 'velib-cache-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/styles.css',
  '/script.js',
  '/manifest.json',
  '/favicon.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS_TO_CACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(key => {
        if (key !== CACHE_NAME) return caches.delete(key);
      })
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  // Simple cache-first strategy
  event.respondWith(
    caches.match(event.request).then(cachedResp => {
      if (cachedResp) return cachedResp;
      return fetch(event.request).then(networkResp => {
        // Optionally cache new requests
        return caches.open(CACHE_NAME).then(cache => {
          // Don't cache opaque requests from other origins
          if (networkResp && networkResp.type !== 'opaque' && networkResp.status === 200) {
            cache.put(event.request, networkResp.clone());
          }
          return networkResp;
        });
      }).catch(() => {
        // Fallback could be an offline page or empty response
        return new Response('Offline', { status: 503, statusText: 'Offline' });
      });
    })
  );
});