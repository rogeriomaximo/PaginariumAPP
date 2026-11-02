const CACHE_NAME = 'paginarium-v3';

const urlsToCache = [
  '/',
  '/index.html',
  '/favicon.ico',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(urlsToCache);
    })
  );

  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );

  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Apenas requisições GET
  if (event.request.method !== 'GET') return;

  // API NUNCA deve usar o cache do Service Worker
  if (
    url.hostname === 'paginariumapi.onrender.com' ||
    url.pathname.startsWith('/alugueis') ||
    url.pathname.startsWith('/livros')
  ) {
    event.respondWith(
      fetch(event.request, {
        cache: 'no-store'
      })
    );
    return;
  }

  // Manifest sempre vem da rede
  if (url.pathname === '/manifest.json') {
    event.respondWith(fetch(event.request));
    return;
  }

  // Arquivos do aplicativo:
  // tenta cache primeiro e depois rede
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request).then(fetchResponse => {
        return caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, fetchResponse.clone());
          return fetchResponse;
        });
      });
    }).catch(() => caches.match('/index.html'))
  );
});