const CACHE_NAME = 'sgm-tracker-v3.1';
const STATIC_ASSETS = [
  './',
  'css/style.css?v=3.1.0',
  'js/main.js?v=3.1.0',
  'manifest.json',
  'icons/icon.svg'
];

// Install Event: Pre-cache core static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching static app assets...');
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event: Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Clearing old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event: Cache-first / Network-fallback strategy for static assets
self.addEventListener('fetch', (event) => {
  const request = event.request;
  
  // Non-GET requests (e.g. POST to /toggle) - let network try, handle offline gracefully
  if (request.method !== 'GET') {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(JSON.stringify({ status: 'ok', offline: true }), {
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // GET requests: Network first with Cache fallback
  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        console.log('[Service Worker] Serving from cache:', request.url);
        return caches.match(request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          if (request.headers.get('accept').includes('text/html')) {
            return caches.match('./');
          }
        });
      })
  );
});
