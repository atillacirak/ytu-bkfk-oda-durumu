// YTÜ BKFK - Progressive Web App (PWA) Service Worker
const CACHE_NAME = 'bkfk-oda-v2';
const STATIC_ASSETS = [
  '/',
  '/css/style.css',
  '/js/app.js',
  '/icons/logo.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/manifest.webmanifest'
];

// Install Event -> Cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event -> Clean old caches & claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event -> Network-first with cache fallback
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Do not intercept or cache SSE streams or POST APIs
  if (url.pathname.startsWith('/api/events') || event.request.method !== 'GET') {
    return;
  }

  // Network first, fallback to cache for HTML/CSS/JS
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          if (event.request.mode === 'navigate') {
            return caches.match('/');
          }
        });
      })
  );
});
