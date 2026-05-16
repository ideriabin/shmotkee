/*
 * Minimal service worker — caches the app shell so the PWA opens offline
 * after first visit. Data (items, sessions, outfits) lives in IndexedDB
 * and is untouched by this SW.
 */

const SHELL_VERSION = 'shell-v1';

// Relative paths resolve against the SW's URL — so on GitHub Pages where
// the SW lives at /shmotkee/sw.js, './' is /shmotkee/, etc.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_VERSION)
      .then((cache) => cache.addAll(['./', './index.html', './manifest.webmanifest', './icon.svg'])),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== SHELL_VERSION).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    caches.match(event.request).then((hit) => hit || fetch(event.request)),
  );
});
