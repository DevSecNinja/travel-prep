import { describe, it, expect } from 'vitest';
import { mergeDefaults, loadState, saveState, STORAGE_KEY } from '../src/storage.js';

function memStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    clear: () => map.clear(),
    key: () => null,
    length: 0,
  };
}

describe('storage', () => {
  it('saves and loads state round-trip', () => {
    const s = memStorage();
    const state = {
      version: 1,
      theme: 'dark',
      items: [
        { id: 'a', name: 'passport', category: 'must-have', custom: false, checked: true },
      ],
    };
    saveState(state, s);
    expect(loadState(s)).toEqual(state);
    expect(s.getItem(STORAGE_KEY)).toBeTruthy();
  });

  it('returns null for missing or corrupt state', () => {
    const s = memStorage();
    expect(loadState(s)).toBeNull();
    s.setItem(STORAGE_KEY, '{not json');
    expect(loadState(s)).toBeNull();
    s.setItem(STORAGE_KEY, '{"version":99}');
    expect(loadState(s)).toBeNull();
  });
});

describe('mergeDefaults', () => {
  const defaults = {
    'must-have': ['passport', 'socks'],
    'nice-to-have': ['umbrella'],
  };

  it('creates fresh state from defaults', () => {
    const merged = mergeDefaults(defaults, null);
    expect(merged.items).toHaveLength(3);
    expect(merged.items.every((i) => i.checked === false)).toBe(true);
    expect(merged.items.every((i) => i.custom === false)).toBe(true);
    expect(merged.theme).toBe('auto');
  });

  it('preserves checked state of existing default items (case-insensitive)', () => {
    const existing = {
      version: 1,
      theme: 'dark',
      items: [
        { id: 'p', name: 'Passport', category: 'must-have', custom: false, checked: true },
      ],
    };
    const merged = mergeDefaults(defaults, existing);
    const passport = merged.items.find((i) => i.name === 'passport');
    expect(passport.checked).toBe(true);
    expect(merged.theme).toBe('dark');
  });

  it('keeps user-added custom items', () => {
    const existing = {
      version: 1,
      theme: 'auto',
      items: [
        { id: 'x', name: 'kindle', category: 'nice-to-have', custom: true, checked: false },
      ],
    };
    const merged = mergeDefaults(defaults, existing);
    expect(merged.items.find((i) => i.name === 'kindle')).toMatchObject({
      custom: true,
      category: 'nice-to-have',
    });
  });
});
