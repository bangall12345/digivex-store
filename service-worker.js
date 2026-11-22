const CACHE_NAME = 'digivex-v2';
const urlsToCache = [
  'index.html',
  'components.html',
  'style.css',
  'script.js',
  'supabase-config.js',
  'manifest.json',
  'logo.png',
  'banner-ml.jpg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});