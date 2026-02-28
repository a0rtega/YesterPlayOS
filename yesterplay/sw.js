const CACHE_NAME = 'yesterplay-v1';
const ASSETS = [
  'index.html',
  'style.css',
  'script.js',
  'config.json',
  'favicon.png',
  'fonts/w95fa.woff2'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => {
      return response || fetch(e.request);
    })
  );
});
