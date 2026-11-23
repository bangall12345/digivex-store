const CACHE_NAME = 'digivex-v5';
const urlsToCache = [
  './', 'index.html', 'login.html', 'admin.html', 'components.html',
  'style.css', 'script.js', 'supabase-config.js', 'manifest.json', 'assets/mobile-legends-hero.jpg', 'assets/digivex-mark.svg'
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache)));
  self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))));
  self.clients.claim();
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(caches.match(event.request).then(response => response || fetch(event.request)));
});
