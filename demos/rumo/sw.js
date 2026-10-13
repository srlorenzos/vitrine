// Rumo — service worker: funciona offline (cache do app); chamadas /api nunca são cacheadas.
const V = 'rumo-v2-1';
const FILES = ['./', 'index.html', 'style.css', 'manifest.webmanifest', 'assets/icon.svg', 'src/util.js', 'src/store.js', 'src/gtd.js', 'src/tasks.js', 'src/agenda.js', 'src/finance.js', 'src/openfinance.js', 'src/habits.js', 'src/integrations.js', 'src/ai.js', 'src/sample.js', 'src/settings.js', 'src/boot.js', 'src/app.js'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api/')) return;
  e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(V).then(c => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request).then(m => m || caches.match('index.html'))));
});
