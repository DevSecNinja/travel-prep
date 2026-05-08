/**
 * LocalStorage wrapper with a stable JSON shape.
 *
 * Shape:
 * {
 *   version: 1,
 *   items: [{ id, name, category: 'documents'|'clothing'|'toiletries'|'electronics'|'pre-departure', custom: boolean, checked: boolean }],
 *   theme: 'auto' | 'light' | 'dark',
 *   language: 'en' | 'nl'
 * }
 */

export const STORAGE_KEY = 'travel-prep:state:v2';

/**
 * @typedef {{ id: string, name: string, category: 'documents' | 'clothing' | 'toiletries' | 'electronics' | 'pre-departure', custom: boolean, checked: boolean }} Item
 * @typedef {{ version: 1, items: Item[], theme: 'auto'|'light'|'dark', language: 'en'|'nl' }} State
 */

/** @returns {State | null} */
export function loadState(storage = globalThis.localStorage) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.items)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** @param {State} state */
export function saveState(state, storage = globalThis.localStorage) {
  storage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/**
 * Merge defaults from YAML into existing state without clobbering user changes.
 *
 * - Items already present (matched by category + lowercased name) keep their
 *   `checked` value.
 * - New default items are added unchecked.
 * - Custom (user-added) items are preserved.
 *
 * @param {Record<string, string[]>} defaults
 * @param {State | null} existing
 * @returns {State}
 */
export function mergeDefaults(defaults, existing) {
  /** @type {State} */
  const next = {
    version: 1,
    items: [],
    theme: existing?.theme ?? 'auto',
    language: existing?.language ?? 'en',
  };

  const existingByKey = new Map();
  if (existing) {
    for (const it of existing.items) {
      existingByKey.set(`${it.category}::${it.name.toLowerCase()}`, it);
    }
  }

  /** @type {Array<'documents'|'clothing'|'toiletries'|'electronics'|'pre-departure'>} */
  const cats = ['documents', 'clothing', 'toiletries', 'electronics', 'pre-departure'];
  for (const cat of cats) {
    for (const name of defaults[cat] ?? []) {
      const key = `${cat}::${name.toLowerCase()}`;
      const prev = existingByKey.get(key);
      next.items.push({
        id: prev?.id ?? cryptoRandomId(),
        name,
        category: cat,
        custom: false,
        checked: prev?.checked ?? false,
      });
      existingByKey.delete(key);
    }
  }

  // Preserve any remaining items from existing state — these are user-added
  // custom items, or defaults that have since been removed from the YAML
  // (we keep them as custom so the user doesn't lose data).
  for (const it of existingByKey.values()) {
    next.items.push({ ...it, custom: true });
  }

  return next;
}

export function cryptoRandomId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}
