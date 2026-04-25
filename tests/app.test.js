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
import { describe, it, expect, beforeEach, vi } from 'vitest';
import axe from 'axe-core';
import { initApp } from '../src/app.js';
import { STORAGE_KEY } from '../src/storage.js';

const YAML = `must-have:
  - passport
  - socks
nice-to-have:
  - umbrella
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

async function mount(storage = memStorage()) {
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
    fetchYaml: async () => YAML,
  });
  return { root, storage };
}

describe('app integration', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('renders both categories with seed items', async () => {
    const { root } = await mount();
    expect(root.querySelector('.list-must-have').textContent).toContain('passport');
    expect(root.querySelector('.list-must-have').textContent).toContain('socks');
    expect(root.querySelector('.list-nice-to-have').textContent).toContain('umbrella');
  });

  it('adds a user-entered item to the chosen category', async () => {
    const { root } = await mount();
    const input = root.querySelector('#new-item-name');
    const select = root.querySelector('#new-item-category');
    const form = root.querySelector('.add-form');
    input.value = 'kindle';
    select.value = 'nice-to-have';
    form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));

    expect(root.querySelector('.list-nice-to-have').textContent).toContain('kindle');
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
      .querySelectorAll('.item label')
      ;
    const names = Array.from(passportMatches).map((l) => l.textContent.toLowerCase());
    expect(names.filter((n) => n === 'passport')).toHaveLength(1);
  });

  it('checking an item updates the suitcase counter', async () => {
    const { root } = await mount();
    const cb = root.querySelector('.list-must-have .item input[type="checkbox"]');
    cb.checked = true;
    cb.dispatchEvent(new Event('change', { bubbles: true }));

    // animation falls back to immediate render under jsdom (no rAF transitions)
    // but we trigger setTimeout fallback in code; flush timers:
    await new Promise((r) => setTimeout(r, 850));
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
    await new Promise((r) => setTimeout(r, 850));
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
      await new Promise((r) => setTimeout(r, 850));
    }
    // remount
    const { root } = await mount(storage);
    expect(root.textContent).toContain('sunglasses');
    const sun = Array.from(root.querySelectorAll('.item label')).find(
      (l) => l.textContent === 'sunglasses',
    );
    expect(sun.previousElementSibling.checked).toBe(true);
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
});
