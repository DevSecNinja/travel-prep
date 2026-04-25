/**
 * PWA tests for Travel Prep.
 */

const fs = require('fs');
const path = require('path');

const htmlPath = path.resolve(__dirname, '../../index.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const manifestPath = path.resolve(__dirname, '../../manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const swPath = path.resolve(__dirname, '../../sw.js');
const sw = fs.readFileSync(swPath, 'utf8');

describe('PWA manifest', () => {
  test('has required name fields', () => {
    expect(manifest.name).toBeDefined();
    expect(manifest.short_name).toBeDefined();
  });

  test('display is standalone', () => {
    expect(manifest.display).toBe('standalone');
  });

  test('has theme and background colors', () => {
    expect(manifest.theme_color).toBeDefined();
    expect(manifest.background_color).toBeDefined();
  });

  test('has start_url and scope', () => {
    expect(manifest.start_url).toBeDefined();
    expect(manifest.scope).toBeDefined();
  });

  test('has required icon sizes', () => {
    const sizes = manifest.icons.map(i => i.sizes);
    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');
  });

  test('has maskable icons', () => {
    const maskable = manifest.icons.filter(i => i.purpose === 'maskable');
    expect(maskable.length).toBeGreaterThanOrEqual(1);
  });

  test('icon files exist', () => {
    for (const icon of manifest.icons) {
      const iconPath = path.resolve(__dirname, '../../', icon.src);
      expect(fs.existsSync(iconPath)).toBe(true);
    }
  });
});

describe('Service worker', () => {
  test('has CACHE_NAME defined', () => {
    expect(sw).toMatch(/const CACHE_NAME\s*=\s*'travel-prep-[^']+'/);
  });

  test('caches core assets', () => {
    expect(sw).toMatch(/ASSETS_TO_CACHE/);
    expect(sw).toMatch(/index\.html/);
    expect(sw).toMatch(/manifest\.json/);
  });

  test('handles SKIP_WAITING message', () => {
    expect(sw).toMatch(/SKIP_WAITING/);
    expect(sw).toMatch(/self\.skipWaiting/);
  });

  test('calls clients.claim() on activate', () => {
    expect(sw).toMatch(/self\.clients\.claim\(\)/);
  });

  test('has install event listener', () => {
    expect(sw).toMatch(/self\.addEventListener\('install'/);
  });

  test('has activate event listener', () => {
    expect(sw).toMatch(/self\.addEventListener\('activate'/);
  });

  test('has fetch event listener', () => {
    expect(sw).toMatch(/self\.addEventListener\('fetch'/);
  });
});

describe('Apple PWA meta tags', () => {
  test('has apple-mobile-web-app-capable', () => {
    expect(html).toMatch(/apple-mobile-web-app-capable/);
    expect(html).toMatch(/content="yes"/);
  });

  test('has apple-mobile-web-app-status-bar-style', () => {
    expect(html).toMatch(/apple-mobile-web-app-status-bar-style/);
  });

  test('has apple-mobile-web-app-title', () => {
    expect(html).toMatch(/apple-mobile-web-app-title/);
  });

  test('links to manifest.json', () => {
    expect(html).toMatch(/rel="manifest"\s+href="manifest\.json"/);
  });

  test('has theme-color meta', () => {
    expect(html).toMatch(/name="theme-color"/);
  });
});

describe('HTML references service worker', () => {
  test('registers service worker in script', () => {
    expect(html).toMatch(/serviceWorker\.register/);
    expect(html).toMatch(/sw\.js/);
  });

  test('handles update banner', () => {
    expect(html).toMatch(/updateBanner/);
    expect(html).toMatch(/SKIP_WAITING/);
  });
});
