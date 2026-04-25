/* eslint-env serviceworker */
/**
 * Travel Prep service worker.
 *
 * Cache strategy:
 *   - Pre-caches the app shell on install.
 *   - Network-first for HTML and the YAML data file (so updates ship fast).
 *   - Cache-first for everything else.
 *
 * BUILD_ID is replaced by the deploy workflow on every commit, which busts
 * the cache and triggers an auto-update in the page.
 */
const BUILD_ID = '__BUILD_ID__';
const CACHE_NAME = `travel-prep-${BUILD_ID}`;

const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './manifest.webmanifest',
  './src/main.js',
  './src/app.js',
  './src/yaml.js',
  './src/storage.js',
  './data/items.yaml',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(APP_SHELL);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isHtml =
    req.mode === 'navigate' ||
    (req.headers.get('accept') ?? '').includes('text/html');
  const isYaml = url.pathname.endsWith('.yaml');

  if (isHtml || isYaml) {
    event.respondWith(networkFirst(req));
  } else {
    event.respondWith(cacheFirst(req));
  }
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const fresh = await fetch(req);
    if (fresh.ok) cache.put(req, fresh.clone());
    return fresh;
  } catch {
    const cached = await cache.match(req);
    if (cached) return cached;
    // Last-resort fallback for navigations: try absolute URL first, then
    // the relative path used when adding to the cache, then the root.
    const fallback =
      await cache.match(new URL('./index.html', self.location.href).href) ??
      await cache.match('./index.html') ??
      await cache.match('./');
    if (fallback) return fallback;
    throw new Error('offline-and-not-cached');
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(req);
  if (cached) return cached;
  try {
    const fresh = await fetch(req);
    if (fresh.ok) cache.put(req, fresh.clone());
    return fresh;
  } catch {
    // Offline and not in cache — nothing we can do for non-navigation requests.
    return new Response('', { status: 503, statusText: 'Service Unavailable' });
  }
}
