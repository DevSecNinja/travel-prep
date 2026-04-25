/**
 * Unit tests for Travel Prep packing list logic.
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.resolve(__dirname, '../../index.html'), 'utf8');

let app;

beforeEach(() => {
  // Mock matchMedia (not available in JSDOM)
  window.matchMedia = window.matchMedia || function (query) {
    return {
      matches: false,
      media: query,
      onchange: null,
      addListener: function () {},
      removeListener: function () {},
      addEventListener: function () {},
      removeEventListener: function () {},
      dispatchEvent: function () { return false; },
    };
  };

  // Mock fetch (for YAML loading)
  global.fetch = jest.fn(() => Promise.resolve({ ok: false }));

  // Reset DOM
  document.documentElement.innerHTML = '';
  document.documentElement.setAttribute('lang', 'en');

  // Clear localStorage
  localStorage.clear();

  // Load fresh DOM
  document.documentElement.innerHTML = html.match(/<html[^>]*>([\s\S]*)<\/html>/i)?.[1] || '';

  // Execute scripts by evaluating the inline script
  const scriptContent = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  if (scriptContent) {
    eval(scriptContent);
  }
  app = window.__travelPrep;
});

describe('Default items', () => {
  test('should have two categories', () => {
    const state = app.getState();
    expect(state.categories).toHaveLength(2);
  });

  test('must-have category has correct default items', () => {
    const state = app.getState();
    const mustHave = state.categories.find(c => c.name === 'Must-Have');
    expect(mustHave).toBeDefined();
    const names = mustHave.items.map(i => typeof i === 'string' ? i : i.name);
    expect(names).toContain('passport');
    expect(names).toContain('toothbrush');
    expect(names).toContain('toothpaste');
    expect(names).toContain('socks');
    expect(names).toContain('underwear');
  });

  test('nice-to-have category has correct default items', () => {
    const state = app.getState();
    const niceHave = state.categories.find(c => c.name === 'Nice-to-Have');
    expect(niceHave).toBeDefined();
    const names = niceHave.items.map(i => typeof i === 'string' ? i : i.name);
    expect(names).toContain('sunscreen');
    expect(names).toContain('umbrella');
  });
});

describe('Toggle item', () => {
  test('should check an unchecked item', () => {
    app.toggleItem('Must-Have', 0);
    const state = app.getState();
    const item = state.categories[0].items[0];
    expect(item.checked).toBe(true);
  });

  test('should uncheck a checked item', () => {
    app.toggleItem('Must-Have', 0);
    app.toggleItem('Must-Have', 0);
    const state = app.getState();
    const item = state.categories[0].items[0];
    expect(item.checked).toBe(false);
  });
});

describe('Add item', () => {
  test('should add an item to a category', () => {
    app.addItem('sunglasses', 'Nice-to-Have');
    const state = app.getState();
    const niceHave = state.categories.find(c => c.name === 'Nice-to-Have');
    const names = niceHave.items.map(i => typeof i === 'string' ? i : i.name);
    expect(names).toContain('sunglasses');
  });

  test('should not add duplicate items', () => {
    const state = app.getState();
    const before = state.categories.find(c => c.name === 'Must-Have').items.length;
    app.addItem('passport', 'Must-Have');
    const after = app.getState().categories.find(c => c.name === 'Must-Have').items.length;
    expect(after).toBe(before);
  });

  test('should mark user-added items', () => {
    app.addItem('camera', 'Nice-to-Have');
    const state = app.getState();
    const niceHave = state.categories.find(c => c.name === 'Nice-to-Have');
    const camera = niceHave.items.find(i => typeof i !== 'string' && i.name === 'camera');
    expect(camera.userAdded).toBe(true);
  });

  test('should not add empty items', () => {
    const state = app.getState();
    const totalBefore = state.categories.reduce((sum, c) => sum + c.items.length, 0);
    app.addItem('', 'Must-Have');
    app.addItem('   ', 'Must-Have');
    const totalAfter = app.getState().categories.reduce((sum, c) => sum + c.items.length, 0);
    expect(totalAfter).toBe(totalBefore);
  });
});

describe('Delete item', () => {
  test('should remove an item from a category', () => {
    const state = app.getState();
    const before = state.categories[0].items.length;
    app.deleteItem('Must-Have', 0);
    const after = app.getState().categories[0].items.length;
    expect(after).toBe(before - 1);
  });
});

describe('Uncheck all', () => {
  test('should uncheck all checked items', () => {
    app.toggleItem('Must-Have', 0);
    app.toggleItem('Must-Have', 1);
    app.toggleItem('Nice-to-Have', 0);
    app.uncheckAll();
    const state = app.getState();
    for (const category of state.categories) {
      for (const item of category.items) {
        if (typeof item !== 'string') {
          expect(item.checked).toBe(false);
        }
      }
    }
  });
});

describe('YAML parser', () => {
  test('should parse simple YAML structure', () => {
    const yaml = `categories:
  - name: Must-Have
    emoji: "🔴"
    items:
      - passport
      - toothbrush

  - name: Nice-to-Have
    emoji: "🟡"
    items:
      - sunscreen`;

    const result = app.parseSimpleYAML(yaml);
    expect(result.categories).toHaveLength(2);
    expect(result.categories[0].name).toBe('Must-Have');
    expect(result.categories[0].items).toContain('passport');
    expect(result.categories[0].items).toContain('toothbrush');
    expect(result.categories[1].name).toBe('Nice-to-Have');
    expect(result.categories[1].items).toContain('sunscreen');
  });

  test('should return null for empty YAML', () => {
    expect(app.parseSimpleYAML('')).toBeNull();
  });
});

describe('localStorage persistence', () => {
  test('should save state to localStorage after toggle', () => {
    app.toggleItem('Must-Have', 0);
    const saved = JSON.parse(localStorage.getItem('travel-prep-data'));
    expect(saved).toBeDefined();
    expect(saved.categories[0].items[0].checked).toBe(true);
  });
});

describe('escapeHTML', () => {
  test('should escape HTML special characters', () => {
    expect(app.escapeHTML('<script>')).toBe('&lt;script&gt;');
    expect(app.escapeHTML('a & b')).toBe('a &amp; b');
  });
});
