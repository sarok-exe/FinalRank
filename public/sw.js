// FinalRank Service Worker — Static Asset Cache
// Caches public assets: images, audio, fonts, and engine files.
// Never caches user data, API responses, or game PGNs.

// Bumped to v3 so the service worker re-installs and re-precaches engine files
// with their current response headers. v2 cached /engines/*.js with the OLD
// Content-Security-Policy header (no 'wasm-unsafe-eval'), which kept blocking
// WebAssembly in the engine worker even after the live site was fixed.
const CACHE_NAME = 'finalrank-static-v3';

// Assets to pre-cache on install
const PRECACHE_URLS = [
  '/',
  '/img/classifications/brilliant.svg',
  '/img/classifications/best.svg',
  '/img/classifications/excellent.svg',
  '/img/classifications/good.svg',
  '/img/classifications/inaccuracy.svg',
  '/img/classifications/mistake.svg',
  '/img/classifications/blunder.svg',
  '/img/classifications/book.svg',
  '/img/classifications/forced.svg',
  '/img/classifications/critical.svg',
  '/img/classifications/sharp.svg',
  '/img/classifications/correct.svg',
  '/img/classifications/incorrect.svg',
  '/engines/stockfish-17-lite-single.js',
  '/engines/stockfish-17-lite-single.wasm',
  '/engines/stockfish-18-lite-single.js',
  '/engines/stockfish-18-lite-single.wasm',
  '/engines/stockfish-18-lite.js',
  '/engines/stockfish-18-lite.wasm',
];

// Cache-first for static assets; network-only for everything else
const CACHEABLE_PREFIXES = ['/img/', '/audio/', '/fonts/', '/engines/'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        PRECACHE_URLS.map((url) =>
          cache.add(url).catch(() => {
            // Ignore missing assets — not all are guaranteed on every build
          })
        )
      );
    }).then(() => {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', (event) => {
  const url = event.request.url;
  const isCacheable = CACHEABLE_PREFIXES.some((prefix) => url.includes(prefix));

  if (!isCacheable) {
    // For non-static requests, pass through to network — never cache user data
    return;
  }

  // Cache-first strategy for static assets
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        return cached;
      }
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || (response.type !== 'basic' && response.type !== 'cors')) {
          return response;
        }
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, clone);
        });
        return response;
      }).catch(() => {
        // If network fails and not cached, let the browser handle the error
        return fetch(event.request).catch(() => new Response('', { status: 408 }));
      });
    })
  );
});

// Listen for cache-clear message from the app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.delete(CACHE_NAME).then(() => {
        // Notify all clients that cache was cleared
        self.clients.matchAll().then((clients) => {
          clients.forEach((client) => {
            client.postMessage({ type: 'CACHE_CLEARED' });
          });
        });
      })
    );
  }
});
