// Service worker body. build/service-worker.ts adds PR_RISK_VERSION and
// PR_RISK_PRECACHE above this text.
//
// Rules (ADR-0004 T3):
// 1. Cache only the files of this build, in a cache named after the build hash.
// 2. A new version activates on the next start of the app, or at once when the user asks for it
//    and only one window of the app is open. No skipWaiting without that request.
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

// The user clicked "Use the new version now" in the old version (src/service-worker.ts). The new
// version takes over only when one window of the app is open, so it never replaces the code
// under another open tab. The reply goes back on the port of the request.
self.addEventListener('message', (event) => {
  const port = event.ports[0];
  // Only a window of this origin may ask.
  if (event.origin !== self.location.origin || event.data?.type !== 'activate-now' || port === undefined) return;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const alone = windows.length <= 1;
      if (alone) await self.skipWaiting();
      port.postMessage({ ok: alone });
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
