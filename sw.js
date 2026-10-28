// Offline cache. Every file the app needs is stored on first visit; after that the app opens with no signal.
// Bump VERSION whenever a file changes so phones pick up the new copy on their next launch.
const VERSION = 'pp-v1';
const FILES = [
  './', 'index.html', 'style.css', 'app.js', 'manifest.webmanifest',
  'games/sudoku.js', 'games/target.js', 'games/mines.js', 'games/nonogram.js', 'games/binary.js',
  'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Serve from cache first; refresh the cached copy in the background when online.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.open(VERSION).then(async (cache) => {
      const hit = await cache.match(e.request, { ignoreSearch: true });
      const net = fetch(e.request)
        .then((res) => { if (res.ok && new URL(e.request.url).origin === location.origin) cache.put(e.request, res.clone()); return res; })
        .catch(() => null);
      return hit || (await net) || cache.match('index.html');
    })
  );
});
