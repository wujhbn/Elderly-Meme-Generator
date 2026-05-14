const CACHE_NAME = 'warm-greet-v1';

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(clients.claim());
});

self.addEventListener('fetch', (e) => {
  // Pass through network requests
  e.respondWith(fetch(e.request).catch(() => new Response("Network error")));
});
