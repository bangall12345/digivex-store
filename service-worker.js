const CACHE_NAME = 'digivex-v10';
// admin.html sengaja tidak di-cache dan tidak dibundel ke APK.
const urlsToCache = [
  './', 'index.html', 'login.html', 'components.html',
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
// Network-first: perbaikan keamanan langsung sampai ke pengguna; cache hanya cadangan offline.
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(event.request).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE_NAME).then(c => c.put(event.request, copy)); }
      return res;
    }).catch(() => caches.match(event.request))
  );
});
