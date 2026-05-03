/**
 * Integration tests that drive the real `initApp` against jsdom + an
 * in-memory localStorage. Covers the user-visible behaviours required by
 * the MVP:
 *   - rendering both categories from YAML
 *   - adding a custom item
 *   - checking / unchecking individually
 *   - "Uncheck all"
 *   - persistence across a "page reload"
 *   - axe accessibility scan
 */
import { readFileSync } from 'node:fs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import axe from 'axe-core';
import { initApp } from '../src/app.js';
import { STORAGE_KEY } from '../src/storage.js';
import { encodeSharePayload } from '../src/share.js';

const STYLES = readFileSync('styles.css', 'utf8');
const ANIMATION_FALLBACK_MS = 1200;

const YAML = `documents:
  - passport
clothing:
  - socks
toiletries:
  - umbrella
electronics:
  - laptop
pre-departure:
  - water plants
`;

const MANY_UNCHECKED_YAML = `documents:
  - passport
  - boarding pass
clothing:
  - socks
  - jacket
toiletries:
  - umbrella
electronics:
  - laptop
pre-departure:
  - water plants
`;

function memStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    clear: () => map.clear(),
    key: () => null,
    get length() { return map.size; },
  };
}

async function mount(storage = memStorage(), locationHash = '', yaml = YAML) {
  // Mirror the document-level attributes from index.html so accessibility
  // checks see the same surface as production.
  document.documentElement.lang = 'en';
  if (!document.querySelector('title')) {
    const t = document.createElement('title');
    t.textContent = 'Travel Prep — Packing List';
    document.head.appendChild(t);
  }
  document.body.innerHTML = '<main id="app"></main>';
  const root = document.getElementById('app');
  await initApp(root, {
    storage,
    fetchYaml: async () => yaml,
    locationHash,
  });
  return { root, storage };
}

describe('app integration', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('renders both categories with seed items', async () => {
    const { root } = await mount();
    expect(root.querySelector('.list-documents').textContent).toContain('passport');
    expect(root.querySelector('.list-clothing').textContent).toContain('socks');
    expect(root.querySelector('.list-toiletries').textContent).toContain('umbrella');
  });

  it('adds a user-entered item to the chosen category', async () => {
    const { root } = await mount();
    const input = root.querySelector('#new-item-name');
    const select = root.querySelector('#new-item-category');
    const form = root.querySelector('.add-form');
    input.value = 'kindle';
    select.value = 'electronics';
    form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));

    expect(root.querySelector('.list-electronics').textContent).toContain('kindle');
    // Custom items expose a remove button
    expect(root.querySelector('[aria-label="Remove kindle"]')).toBeTruthy();
  });

  it('does not add empty or duplicate items', async () => {
    const { root } = await mount();
    const input = root.querySelector('#new-item-name');
    const form = root.querySelector('.add-form');

    input.value = '   ';
    form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    input.value = 'PASSPORT'; // case-insensitive duplicate
    form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));

    const passportMatches = root
      .querySelectorAll('.list-documents .item label')
      ;
    const names = Array.from(passportMatches).map((l) => l.textContent.toLowerCase());
    expect(names.filter((n) => n === 'passport')).toHaveLength(1);
  });

  it('checking an item updates the suitcase counter', async () => {
    const { root } = await mount();
    const cb = root.querySelector('.list-documents .item input[type="checkbox"]');
    cb.checked = true;
    cb.dispatchEvent(new Event('change', { bubbles: true }));

    // animation falls back to immediate render under jsdom (no rAF transitions)
    // but we trigger setTimeout fallback in code; flush timers:
    await new Promise((r) => setTimeout(r, ANIMATION_FALLBACK_MS));
    const count = root.querySelector('.suitcase-count strong');
    expect(Number(count.textContent)).toBe(1);
  });

  it('"Uncheck all" clears every checked item', async () => {
    const { root, storage } = await mount();
    // Check everything directly via state by toggling each box.
    for (const cb of root.querySelectorAll('.item input[type="checkbox"]')) {
      cb.checked = true;
      cb.dispatchEvent(new Event('change', { bubbles: true }));
    }
    await new Promise((r) => setTimeout(r, ANIMATION_FALLBACK_MS));
    root.querySelector('.reset-btn').click();
    const checkedAfter = root.querySelectorAll('.item input[type="checkbox"]:checked');
    expect(checkedAfter).toHaveLength(0);
    // Persisted to storage too
    const saved = JSON.parse(storage.getItem(STORAGE_KEY));
    expect(saved.items.every((i) => !i.checked)).toBe(true);
  });

  it('persists state across a remount (simulated reload)', async () => {
    const storage = memStorage();
    {
      const { root } = await mount(storage);
      // add custom item and check it
      const input = root.querySelector('#new-item-name');
      const form = root.querySelector('.add-form');
      input.value = 'sunglasses';
      form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      const cb = Array.from(root.querySelectorAll('.item label'))
        .find((l) => l.textContent === 'sunglasses')
        .previousElementSibling;
      cb.checked = true;
      cb.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise((r) => setTimeout(r, ANIMATION_FALLBACK_MS));
    }
    // remount
    const { root } = await mount(storage);
    expect(root.textContent).toContain('sunglasses');
    const sun = Array.from(root.querySelectorAll('.item label')).find(
      (l) => l.textContent === 'sunglasses',
    );
    expect(sun.previousElementSibling.checked).toBe(true);
  });

  it('"Check all" marks every item as checked', async () => {
    const { root, storage } = await mount();
    root.querySelector('.check-all-btn').click();
    const checkedAfter = root.querySelectorAll('.item input[type="checkbox"]:checked');
    const allItems = root.querySelectorAll('.item input[type="checkbox"]');
    expect(checkedAfter).toHaveLength(allItems.length);
    // Persisted to storage too
    const saved = JSON.parse(storage.getItem(STORAGE_KEY));
    expect(saved.items.every((i) => i.checked)).toBe(true);
  });

  it('shows unchecked items in a dedicated section', async () => {
    const { root } = await mount();
    const cb = root.querySelector('.list-documents .item input[type="checkbox"]');
    cb.checked = true;
    cb.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((r) => setTimeout(r, ANIMATION_FALLBACK_MS));

    const unchecked = root.querySelector('.list-unchecked');
    expect(unchecked).toBeTruthy();
    expect(unchecked.querySelector('h2').textContent).toContain('Unchecked items');
    expect(unchecked.textContent).not.toContain('passport');
    expect(unchecked.textContent).toContain('socks');
  });

  it('keeps the current item anchored when unchecking adds it above', async () => {
    const { root } = await mount();
    root.querySelector('.check-all-btn').click();

    const item = root.querySelector('.list-documents .item');
    const itemId = item.dataset.id;
    const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;
    const scrollBy = vi.fn();
    vi.stubGlobal('scrollBy', scrollBy);
    let anchorReads = 0;
    HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect() {
      if (this.dataset?.id === itemId && this.closest('.list-documents')) {
        anchorReads += 1;
        const top = anchorReads === 1 ? 200 : 236;
        return {
          x: 0,
          y: top,
          top,
          left: 0,
          right: 100,
          bottom: top + 20,
          width: 100,
          height: 20,
          toJSON: () => ({}),
        };
      }
      return originalGetBoundingClientRect.call(this);
    };

    try {
      const cb = item.querySelector('input[type="checkbox"]');
      cb.checked = false;
      cb.dispatchEvent(new Event('change', { bubbles: true }));

      expect(scrollBy).toHaveBeenCalledWith(0, 36);
    } finally {
      HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
      vi.unstubAllGlobals();
    }
  });

  it('lets the unchecked items section be collapsed and expanded', async () => {
    const { root } = await mount();
    const unchecked = root.querySelector('.list-unchecked');
    const toggle = unchecked.querySelector('.unchecked-toggle');
    const list = unchecked.querySelector('.item-list');

    expect(toggle).toBeTruthy();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(list.hidden).toBe(false);

    toggle.click();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(list.hidden).toBe(true);
    expect(getComputedStyle(list).display).toBe('none');

    toggle.click();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(list.hidden).toBe(false);
    expect(getComputedStyle(list).display).not.toBe('none');
  });

  it('keeps unchecked items collapsed after packing an item', async () => {
    const { root } = await mount();
    root.querySelector('.list-unchecked .unchecked-toggle').click();

    const cb = root.querySelector('.list-documents .item input[type="checkbox"]');
    cb.checked = true;
    cb.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((r) => setTimeout(r, ANIMATION_FALLBACK_MS));

    const unchecked = root.querySelector('.list-unchecked');
    const toggle = unchecked.querySelector('.unchecked-toggle');
    const list = unchecked.querySelector('.item-list');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(list.hidden).toBe(true);
    expect(getComputedStyle(list).display).toBe('none');
  });

  it('keeps the rendered unchecked item list visually hidden when styles are loaded', async () => {
    const style = document.createElement('style');
    style.textContent = STYLES;
    document.head.appendChild(style);

    try {
      const { root } = await mount();
      root.querySelector('.list-unchecked .unchecked-toggle').click();
      const list = root.querySelector('.list-unchecked .item-list');

      expect(list.hidden).toBe(true);
      expect(getComputedStyle(list).display).toBe('none');
    } finally {
      style.remove();
    }
  });

  it('auto-collapses unchecked items when more than five are unpacked', async () => {
    const { root } = await mount(memStorage(), '', MANY_UNCHECKED_YAML);
    const unchecked = root.querySelector('.list-unchecked');
    const toggle = unchecked.querySelector('.unchecked-toggle');
    const list = unchecked.querySelector('.item-list');

    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.textContent).toContain('Show 7 items');
    expect(list.hidden).toBe(true);
    expect(getComputedStyle(list).display).toBe('none');

    toggle.click();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(list.hidden).toBe(false);
    expect(getComputedStyle(list).display).not.toBe('none');
  });

  it('marks unchecked items and shows an empty unchecked section once everything is packed', async () => {
    const { root } = await mount();
    const item = root.querySelector('.list-documents .item');
    expect(item.classList.contains('unchecked')).toBe(true);

    root.querySelector('.check-all-btn').click();
    const unchecked = root.querySelector('.list-unchecked');
    expect(unchecked.textContent).toContain('Everything is packed');
    expect(unchecked.querySelector('.item')).toBeNull();
  });

  it('stores new items in lowercase regardless of input case', async () => {
    const { root, storage } = await mount();
    const input = root.querySelector('#new-item-name');
    const form = root.querySelector('.add-form');
    input.value = 'SunGlAsSeS';
    form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    const labels = Array.from(root.querySelectorAll('.item label')).map((l) => l.textContent);
    expect(labels).toContain('sunglasses');
    const saved = JSON.parse(storage.getItem(STORAGE_KEY));
    const added = saved.items.find((i) => i.name === 'sunglasses');
    expect(added).toBeTruthy();
  });

  it('renders a footer with build id', async () => {
    const { root } = await mount();
    const footer = root.querySelector('.app-footer');
    expect(footer).toBeTruthy();
    expect(footer.textContent).toContain('Travel Prep');
  });

  it('renders a footer note about browser storage and mobile PWA install', async () => {
    const { root } = await mount();
    const note = root.querySelector('.app-footer .storage-note');
    expect(note).toBeTruthy();
    expect(note.textContent).toContain('stored in this browser');
    expect(note.textContent).toContain('lost if cache storage is cleared');
    expect(note.textContent).toContain('install Travel Prep as a PWA');
  });

  it('renders a footer with a real commit hash link when buildId is provided', async () => {
    document.body.innerHTML = '<main id="app"></main>';
    const r = document.getElementById('app');
    await initApp(r, {
      storage: memStorage(),
      fetchYaml: async () => YAML,
      buildId: 'abc123def456-20240101120000',
    });
    const footer = r.querySelector('.app-footer');
    expect(footer).toBeTruthy();
    const link = footer.querySelector('.commit-link');
    expect(link.href).toContain('abc123def456');
    expect(link.textContent).toBe('abc123def456');
  });

  it('renders a GitHub star button in the footer', async () => {
    const { root } = await mount();
    const footer = root.querySelector('.app-footer');
    expect(footer).toBeTruthy();
    const starButton = footer.querySelector('.github-star-button');
    expect(starButton).toBeTruthy();
    expect(starButton.href).toContain('github.com/DevSecNinja/travel-prep');
    expect(footer.querySelector('.github-star-icon')).toBeTruthy();
    expect(footer.querySelector('#starCountText')).toBeTruthy();
    expect(footer.querySelector('.github-star-cta')).toBeTruthy();
  });

  it('renders a DevSecNinja link in the footer', async () => {
    const { root } = await mount();
    const footer = root.querySelector('.app-footer');
    expect(footer).toBeTruthy();
    const links = Array.from(footer.querySelectorAll('a'));
    const devSecNinjaLink = links.find((a) => a.href.includes('github.com/DevSecNinja'));
    expect(devSecNinjaLink).toBeTruthy();
  });

  it('theme selection is saved and reflected on documentElement', async () => {
    const { root, storage } = await mount();
    const select = root.querySelector('.theme-select select');
    select.value = 'dark';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(JSON.parse(storage.getItem(STORAGE_KEY)).theme).toBe('dark');
  });

  it('has no critical accessibility violations (axe)', async () => {
    await mount();
    // Inject the page styles minimally so axe sees a real page.
    const results = await axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
    });
    const serious = results.violations.filter((v) =>
      ['serious', 'critical'].includes(v.impact),
    );
    if (serious.length) {
      // Helpful failure message
      console.error(JSON.stringify(serious, null, 2));
    }
    expect(serious).toEqual([]);
  });

  // ----- Share / Import -------------------------------------------------------

  it('renders a "Share list" button in the controls', async () => {
    const { root } = await mount();
    const btn = root.querySelector('.share-btn');
    expect(btn).toBeTruthy();
    expect(btn.textContent).toContain('Share list');
  });

  it('clicking the share button opens a share dialog', async () => {
    const { root } = await mount();
    root.querySelector('.share-btn').click();
    const overlay = document.body.querySelector('.modal-overlay');
    expect(overlay).toBeTruthy();
    expect(overlay.querySelector('.modal-title').textContent).toContain('Share');
    expect(overlay.querySelector('.share-url-input')).toBeTruthy();
    expect(overlay.querySelector('.share-copy-btn')).toBeTruthy();
    // Clean up
    overlay.remove();
  });

  it('share dialog URL contains all current items encoded in the hash', async () => {
    const { root } = await mount();
    root.querySelector('.share-btn').click();
    const urlInput = document.body.querySelector('.share-url-input');
    expect(urlInput.value).toContain('#share=');
    const hash = urlInput.value.split('#')[1];
    const { readShareFromHash } = await import('../src/share.js');
    const decoded = readShareFromHash('#' + hash);
    expect(decoded).toBeTruthy();
    expect(decoded.map((i) => i.name)).toContain('passport');
    // Clean up
    document.body.querySelector('.modal-overlay').remove();
  });

  it('opening with a #share= hash shows an import dialog', async () => {
    const sharedItems = [
      { name: 'kindle', category: 'electronics' },
      { name: 'travel pillow', category: 'clothing' },
    ];
    const hash = '#share=' + encodeSharePayload(sharedItems);
    await mount(memStorage(), hash);
    const overlay = document.body.querySelector('.modal-overlay');
    expect(overlay).toBeTruthy();
    expect(overlay.querySelector('#import-dialog-title').textContent).toContain('Import');
    expect(overlay.textContent).toContain('kindle');
    expect(overlay.textContent).toContain('travel pillow');
    // Clean up
    overlay.remove();
  });

  it('import dialog marks items already in the list as existing', async () => {
    // 'passport' is in the default YAML, so it should be marked as existing.
    const sharedItems = [
      { name: 'passport', category: 'documents' },
      { name: 'kindle', category: 'electronics' },
    ];
    const hash = '#share=' + encodeSharePayload(sharedItems);
    await mount(memStorage(), hash);
    const overlay = document.body.querySelector('.modal-overlay');
    expect(overlay.textContent).toContain('passport (already in your list)');
    // kindle is new, so it should appear as a selectable checkbox
    const newCbs = Array.from(overlay.querySelectorAll('.import-item input[type="checkbox"]:not(:disabled)'));
    expect(newCbs.map((cb) => cb.dataset.name)).toContain('kindle');
    // Clean up
    overlay.remove();
  });

  it('import dialog adds selected items to the list', async () => {
    const sharedItems = [
      { name: 'kindle', category: 'electronics' },
      { name: 'travel pillow', category: 'clothing' },
    ];
    const hash = '#share=' + encodeSharePayload(sharedItems);
    const { root } = await mount(memStorage(), hash);
    const overlay = document.body.querySelector('.modal-overlay');
    // Both items should be pre-checked; click Import selected.
    overlay.querySelector('.modal-import-btn').click();
    expect(document.body.querySelector('.modal-overlay')).toBeNull();
    expect(root.querySelector('.list-electronics').textContent).toContain('kindle');
    expect(root.querySelector('.list-clothing').textContent).toContain('travel pillow');
  });

  it('import dialog Cancel button dismisses without importing', async () => {
    const sharedItems = [{ name: 'kindle', category: 'electronics' }];
    const hash = '#share=' + encodeSharePayload(sharedItems);
    const { root } = await mount(memStorage(), hash);
    const overlay = document.body.querySelector('.modal-overlay');
    overlay.querySelector('.modal-cancel-btn').click();
    expect(document.body.querySelector('.modal-overlay')).toBeNull();
    expect(root.querySelector('.list-electronics').textContent).not.toContain('kindle');
  });

  it('import dialog shows "already in list" message when all items exist', async () => {
    // passport and umbrella are both in the defaults
    const sharedItems = [
      { name: 'passport', category: 'documents' },
      { name: 'umbrella', category: 'toiletries' },
    ];
    const hash = '#share=' + encodeSharePayload(sharedItems);
    await mount(memStorage(), hash);
    const overlay = document.body.querySelector('.modal-overlay');
    expect(overlay.textContent).toContain('already in your list');
    expect(overlay.querySelector('.modal-import-btn')).toBeNull();
    // Clean up
    overlay.remove();
  });
});
