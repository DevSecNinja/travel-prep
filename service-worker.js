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
  './src/share.js',
  './src/yaml.js',
  './src/storage.js',
  './src/i18n/index.js',
  './src/i18n/en.js',
  './src/i18n/nl.js',
  './data/items.yaml',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      // Use cache:'reload' so each file is always fetched from the network,
      // bypassing the browser's HTTP cache.  Without this, iOS (and other
      // clients) can serve a stale HTTP-cached copy of app.js / styles.css
      // into the new SW cache, making the precached shell look identical to
      // the previous version even though a new build was deployed.
      await Promise.all(
        APP_SHELL.map(async (url) => {
          const res = await fetch(new Request(url, { cache: 'reload' }));
          if (res.ok) await cache.put(url, res);
        }),
      );
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
  // Always fetch source scripts fresh so that the stamped BUILD_ID in
  // main.js is up-to-date.  On iOS the HTTP cache can pin the old SW URL
  // even after a redeploy, preventing updates unless main.js is re-fetched
  // and re-registers with the new ?v= query string.
  const isScript = url.pathname.endsWith('.js') &&
    url.pathname.includes('/src/');

  if (isHtml || isYaml || isScript) {
    event.respondWith(networkFirst(req));
  } else {
    event.respondWith(cacheFirst(req));
  }
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE_NAME);
  try {
    // Use cache:'no-cache' to revalidate with the server on every request,
    // bypassing the browser's HTTP cache.  This prevents a stale HTTP-cached
    // copy of main.js (or any other network-first resource) from being served
    // even when the device is online.
    const fresh = await fetch(new Request(req, { cache: 'no-cache' }));
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
    const fresh = await fetch(new Request(req, { cache: 'no-cache' }));
    if (fresh.ok) cache.put(req, fresh.clone());
    return fresh;
  } catch {
    // Offline and not in cache — nothing we can do for non-navigation requests.
    return new Response('', { status: 503, statusText: 'Service Unavailable' });
  }
}
