import { parseYaml } from './yaml.js';
import {
  loadState,
  saveState,
  mergeDefaults,
  cryptoRandomId,
} from './storage.js';

/** @typedef {import('./storage.js').State} State */
/** @typedef {import('./storage.js').Item} Item */

const CATEGORIES = /** @type {const} */ (['must-have', 'nice-to-have']);
const CATEGORY_LABELS = {
  'must-have': 'Must-have',
  'nice-to-have': 'Nice-to-have',
};

/**
 * Initialise the app inside the given root element.
 * Exported so tests can drive it with a custom DOM and storage.
 *
 * @param {HTMLElement} root
 * @param {object} [opts]
 * @param {() => Promise<string>} [opts.fetchYaml]  - returns YAML text
 * @param {Storage} [opts.storage]
 * @param {string} [opts.buildId]  - stamped by deploy workflow
 */
export async function initApp(root, opts = {}) {
  const storage = opts.storage ?? globalThis.localStorage;
  const buildId = opts.buildId ?? '__BUILD_ID__';
  const fetchYaml =
    opts.fetchYaml ??
    (async () => {
      const res = await fetch('./data/items.yaml');
      if (!res.ok) throw new Error(`Failed to load items.yaml: ${res.status}`);
      return res.text();
    });

  const yamlText = await fetchYaml();
  const defaults = parseYaml(yamlText);
  /** @type {State} */
  let state = mergeDefaults(defaults, loadState(storage));
  saveState(state, storage);

  applyTheme(state.theme);
  render();

  // ----- Rendering -----------------------------------------------------------

  function render() {
    root.innerHTML = '';

    // Header
    const header = document.createElement('header');
    header.className = 'app-header';
    header.innerHTML = `
      <h1>🧳 Travel Prep</h1>
      <p class="tagline">Your friendly packing companion</p>
    `;
    const controls = document.createElement('div');
    controls.className = 'controls';
    controls.appendChild(buildThemeSelect());
    controls.appendChild(buildCheckAllButton());
    controls.appendChild(buildResetButton());
    header.appendChild(controls);
    root.appendChild(header);

    // Suitcase visual
    const suitcase = document.createElement('div');
    suitcase.className = 'suitcase';
    suitcase.id = 'suitcase';
    suitcase.setAttribute('aria-live', 'polite');
    suitcase.setAttribute('aria-label', 'Suitcase');
    const checkedCount = state.items.filter((i) => i.checked).length;
    suitcase.innerHTML = `
      <div class="suitcase-body" aria-hidden="true">
        <div class="suitcase-handle"></div>
        <div class="suitcase-stripe"></div>
      </div>
      <p class="suitcase-count"><strong>${checkedCount}</strong> / ${state.items.length} packed</p>
    `;
    root.appendChild(suitcase);

    // Add-item form
    const form = document.createElement('form');
    form.className = 'add-form';
    form.setAttribute('aria-label', 'Add a new item');
    form.innerHTML = `
      <label class="visually-hidden" for="new-item-name">Item name</label>
      <input id="new-item-name" name="name" type="text" placeholder="Add an item…" required maxlength="80" autocomplete="off" inputmode="text" />
      <label class="visually-hidden" for="new-item-category">Category</label>
      <select id="new-item-category" name="category">
        <option value="must-have">Must-have</option>
        <option value="nice-to-have">Nice-to-have</option>
      </select>
      <button type="submit">Add</button>
    `;
    const nameInput = /** @type {HTMLInputElement} */ (form.querySelector('#new-item-name'));
    nameInput.addEventListener('input', () => {
      const pos = nameInput.selectionStart;
      nameInput.value = nameInput.value.toLowerCase();
      if (pos !== null) nameInput.setSelectionRange(pos, pos);
    });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const nameEl = /** @type {HTMLInputElement} */ (
        form.querySelector('#new-item-name')
      );
      const catEl = /** @type {HTMLSelectElement} */ (
        form.querySelector('#new-item-category')
      );
      addItem(nameEl.value, /** @type {any} */ (catEl.value));
      nameEl.value = '';
      nameEl.focus();
    });
    root.appendChild(form);

    // Lists, one per category
    for (const cat of CATEGORIES) {
      const section = document.createElement('section');
      section.className = `list list-${cat}`;
      section.setAttribute('aria-labelledby', `heading-${cat}`);
      const heading = document.createElement('h2');
      heading.id = `heading-${cat}`;
      heading.textContent = CATEGORY_LABELS[cat];
      section.appendChild(heading);

      const ul = document.createElement('ul');
      ul.className = 'item-list';
      const items = state.items.filter((i) => i.category === cat);
      if (items.length === 0) {
        const empty = document.createElement('li');
        empty.className = 'empty';
        empty.textContent = 'Nothing here yet — add something above.';
        ul.appendChild(empty);
      } else {
        for (const item of items) {
          ul.appendChild(buildItem(item));
        }
      }
      section.appendChild(ul);
      root.appendChild(section);
    }

    // Footer
    const footer = document.createElement('footer');
    footer.className = 'app-footer';
    // BUILD_ID format set by deploy.yml: '<12-char-sha>-<YYYYMMDDHHmmss>'
    // e.g. 'abc123def456-20240101120000'
    const shortHash = buildId.includes('-') ? buildId.split('-')[0] : buildId;
    const isPlaceholder = shortHash === '__BUILD_ID__';
    footer.innerHTML = isPlaceholder
      ? `<p>Travel Prep &mdash; <a href="https://github.com/DevSecNinja/travel-prep" target="_blank" rel="noopener">source</a></p>`
      : `<p>Travel Prep &mdash; <a href="https://github.com/DevSecNinja/travel-prep/commit/${shortHash}" target="_blank" rel="noopener">${shortHash}</a></p>`;
    root.appendChild(footer);
  }

  function buildThemeSelect() {
    const wrap = document.createElement('label');
    wrap.className = 'theme-select';
    wrap.innerHTML = `
      <span class="visually-hidden">Theme</span>
      <select aria-label="Theme">
        <option value="auto">🌗 Auto</option>
        <option value="light">☀️ Light</option>
        <option value="dark">🌙 Dark</option>
      </select>
    `;
    const select = /** @type {HTMLSelectElement} */ (wrap.querySelector('select'));
    select.value = state.theme;
    select.addEventListener('change', () => {
      state.theme = /** @type {any} */ (select.value);
      saveState(state, storage);
      applyTheme(state.theme);
    });
    return wrap;
  }

  function buildCheckAllButton() {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'check-all-btn';
    btn.textContent = 'Check all';
    btn.addEventListener('click', () => {
      checkAll();
    });
    return btn;
  }

  function buildResetButton() {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'reset-btn';
    btn.textContent = 'Uncheck all';
    btn.addEventListener('click', () => {
      uncheckAll();
    });
    return btn;
  }

  /** @param {Item} item */
  function buildItem(item) {
    const li = document.createElement('li');
    li.className = 'item' + (item.checked ? ' checked' : '');
    li.dataset.id = item.id;

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = item.checked;
    cb.id = `cb-${item.id}`;
    cb.addEventListener('change', () => toggleItem(item.id, cb.checked, li));

    const label = document.createElement('label');
    label.htmlFor = cb.id;
    label.textContent = item.name;

    li.appendChild(cb);
    li.appendChild(label);

    if (item.custom) {
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'remove-btn';
      removeBtn.setAttribute('aria-label', `Remove ${item.name}`);
      removeBtn.textContent = '×';
      removeBtn.addEventListener('click', () => removeItem(item.id));
      li.appendChild(removeBtn);
    }

    return li;
  }

  // ----- Actions -------------------------------------------------------------

  /**
   * @param {string} name
   * @param {'must-have' | 'nice-to-have'} category
   */
  function addItem(name, category) {
    const trimmed = name.trim().toLowerCase();
    if (!trimmed) return;
    if (!CATEGORIES.includes(category)) return;
    // Prevent exact-duplicate (case-insensitive within category).
    const dup = state.items.find(
      (i) => i.category === category && i.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (dup) return;
    state.items.push({
      id: cryptoRandomId(),
      name: trimmed,
      category,
      custom: true,
      checked: false,
    });
    saveState(state, storage);
    render();
  }

  /** @param {string} id */
  function removeItem(id) {
    state.items = state.items.filter((i) => i.id !== id);
    saveState(state, storage);
    render();
  }

  /**
   * @param {string} id
   * @param {boolean} checked
   * @param {HTMLElement} li
   */
  function toggleItem(id, checked, li) {
    const item = state.items.find((i) => i.id === id);
    if (!item) return;
    item.checked = checked;
    saveState(state, storage);

    if (checked) {
      animateIntoSuitcase(li);
    } else {
      // Just re-render to update strikethrough / counts.
      render();
    }
  }

  function uncheckAll() {
    let changed = false;
    for (const it of state.items) {
      if (it.checked) {
        it.checked = false;
        changed = true;
      }
    }
    if (changed) {
      saveState(state, storage);
      render();
    }
  }

  function checkAll() {
    let changed = false;
    for (const it of state.items) {
      if (!it.checked) {
        it.checked = true;
        changed = true;
      }
    }
    if (changed) {
      saveState(state, storage);
      render();
    }
  }

  // ----- Animation -----------------------------------------------------------

  /** @param {HTMLElement} li */
  function animateIntoSuitcase(li) {
    const suitcase = root.querySelector('#suitcase');
    if (!suitcase || typeof li.getBoundingClientRect !== 'function') {
      render();
      return;
    }
    // Respect reduced-motion preferences.
    const reduce =
      globalThis.matchMedia &&
      globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      render();
      return;
    }

    const startRect = li.getBoundingClientRect();
    // Target the suitcase body itself so the item flies into the case, not just
    // the surrounding card.
    const suitcaseBody = suitcase.querySelector('.suitcase-body') ?? suitcase;
    const endRect = /** @type {Element} */ (suitcaseBody).getBoundingClientRect();
    const ghost = li.cloneNode(true);
    /** @type {HTMLElement} */ (ghost).classList.add('ghost');
    /** @type {HTMLElement} */ (ghost).style.left = startRect.left + 'px';
    /** @type {HTMLElement} */ (ghost).style.top = startRect.top + 'px';
    /** @type {HTMLElement} */ (ghost).style.width = startRect.width + 'px';
    document.body.appendChild(ghost);

    const dx =
      endRect.left + endRect.width / 2 - (startRect.left + startRect.width / 2);
    const dy =
      endRect.top + endRect.height / 2 - (startRect.top + startRect.height / 2);

    requestAnimationFrame(() => {
      /** @type {HTMLElement} */ (ghost).style.transform =
        `translate(${dx}px, ${dy}px) scale(0.1) rotate(15deg)`;
      /** @type {HTMLElement} */ (ghost).style.opacity = '0';
    });

    const cleanup = () => {
      ghost.remove();
      const sc = root.querySelector('#suitcase');
      if (sc) {
        sc.classList.remove('bump');
        // force reflow then re-add to retrigger animation
        void /** @type {HTMLElement} */ (sc).offsetWidth;
        sc.classList.add('bump');
      }
      render();
    };
    ghost.addEventListener('transitionend', cleanup, { once: true });
    // Safety net in case transitionend doesn't fire.
    setTimeout(cleanup, 1100);
  }

  // ----- Theme ---------------------------------------------------------------

  /** @param {'auto'|'light'|'dark'} theme */
  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
  }
}
