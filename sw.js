const CACHE = 'cc-v2-pro';
const CORE = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './js/store.js',
  './js/sync.js',
  './js/recommend.js',
  './js/sr.js',
  './js/views/today.js',
  './js/views/dashboard.js',
  './js/views/ladder.js',
  './js/views/companies.js',
  './js/views/game.js',
  './js/views/audit.js',
  './js/views/log.js',
  './js/views/settings.js',
  './data/ladder.json',
  './data/companies.json',
  './manifest.json'
];

self.addEventListener('install', e=>{
  e.waitUntil(caches.open(CACHE).then(c=> c.addAll(CORE)).then(()=> self.skipWaiting()));
});
self.addEventListener('activate', e=>{
  e.waitUntil(
    caches.keys().then(keys=> Promise.all(keys.filter(k=> k!==CACHE).map(k=> caches.delete(k)))).then(()=> self.clients.claim())
  );
});
self.addEventListener('fetch', e=>{
  const url = new URL(e.request.url);
  if (url.pathname.includes('/data/')) {
    e.respondWith(
      fetch(e.request, { cache:'no-store' })
        .then(res=> {
          const clone=res.clone();
          caches.open(CACHE).then(c=> c.put(e.request, clone));
          return res;
        })
        .catch(()=> caches.match(e.request))
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then(cached=> cached || fetch(e.request).then(res=>{
      if (res.ok) {
        const clone=res.clone();
        caches.open(CACHE).then(c=> c.put(e.request, clone));
      }
      return res;
    }))
  );
});
