// Service worker: precache every app file, serve cache-first, so the app never needs the network after install.
// Bump CACHE with each release so installed phones pick up the change.
const CACHE = 'liftboard-v4';
const FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './js/app.js',
  './js/store.js',
  './js/state.js',
  './js/exercises.js',
  './js/ranks.js',
  './js/stats.js',
  './js/util.js',
  './js/ui.js',
  './js/charts.js',
  './js/plans.js',
  './js/views/lifts.js',
  './js/views/sheet.js',
  './js/views/progress.js',
  './js/views/plans.js',
  './js/views/settings.js',
  './vendor/chart.umd.min.js',
  './icons/180.png',
  './icons/192.png',
  './icons/512.png',
  './icons/512-maskable.png',
];

self.addEventListener('install', e => {
  // cache: 'reload' skips the HTTP cache so a new release never precaches stale files.
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' })))));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k.startsWith('liftboard-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    // ignoreSearch: ./?dev is the same cached shell as ./
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try {
      return await fetch(req);
    } catch (err) {
      if (req.mode === 'navigate') return (await cache.match('./')) || Response.error();
      throw err;
    }
  })());
});

self.addEventListener('message', e => {
  if (e.data === 'skip') self.skipWaiting();
});
