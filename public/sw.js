/*
 * Service worker for Shmotkee.
 *
 * Strategy:
 *   - Navigations (HTML) → network-first. Always grab the freshest
 *     index.html when online; fall back to cache only when offline.
 *     This is non-negotiable: index.html references content-hashed
 *     asset filenames, so a stale cached HTML points to dead assets.
 *   - Same-origin assets → cache-first. Asset URLs already contain a
 *     content hash, so a cached response is always valid.
 *   - All other (cross-origin) → pass through.
 *
 * On activate, delete every previous cache regardless of name to clear
 * out anything left behind by older SW versions.
 *
 * Bump VERSION when changing strategy itself (not on every deploy —
 * the cache stays valid across deploys thanks to content hashes).
 */

const VERSION = 'shmotkee-v3';
const RUNTIME = `${VERSION}-runtime`;

self.addEventListener('install', () => {
  // No precache. Runtime requests populate the cache as needed.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== RUNTIME).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigations: network-first.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          const copy = response.clone();
          caches.open(RUNTIME).then((c) => c.put(request, copy)).catch(() => {});
          return response;
        } catch {
          const cache = await caches.open(RUNTIME);
          const hit = (await cache.match(request)) || (await cache.match('./'));
          return hit ?? new Response('Offline', { status: 503 });
        }
      })(),
    );
    return;
  }

  // Same-origin static assets: cache-first.
  event.respondWith(
    (async () => {
      const cache = await caches.open(RUNTIME);
      const hit = await cache.match(request);
      if (hit) return hit;
      const response = await fetch(request);
      if (response.ok && response.type !== 'opaque') {
        cache.put(request, response.clone()).catch(() => {});
      }
      return response;
    })(),
  );
});
