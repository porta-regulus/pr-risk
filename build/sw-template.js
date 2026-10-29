// Service worker body. build/service-worker.ts adds PR_RISK_VERSION and
// PR_RISK_PRECACHE above this text.
//
// Rules (ADR-0004 T3):
// 1. Cache only the files of this build, in a cache named after the build hash.
// 2. No skipWaiting. A new version activates on the next start of the app.
// 3. Serve same-origin GET requests from the cache. Navigations get the app shell.

const CACHE = `pr-risk-${PR_RISK_VERSION}`;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PR_RISK_PRECACHE)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.filter((name) => name.startsWith('pr-risk-') && name !== CACHE).map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(request.mode === 'navigate' ? '/' : url.pathname);
      return hit ?? fetch(request);
    })(),
  );
});
