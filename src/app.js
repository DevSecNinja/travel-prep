import { parseYaml } from './yaml.js';
import {
  loadState,
  saveState,
  mergeDefaults,
  cryptoRandomId,
} from './storage.js';
import { buildShareUrl, readShareFromHash } from './share.js';

/** @typedef {import('./storage.js').State} State */
/** @typedef {import('./storage.js').Item} Item */

const CATEGORIES = /** @type {const} */ (['documents', 'clothing', 'toiletries', 'electronics', 'pre-departure']);
const CATEGORY_LABELS = {
  'documents': 'Documents',
  'clothing': 'Clothing',
  'toiletries': 'Toiletries',
  'electronics': 'Electronics',
  'pre-departure': 'Pre-departure',
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
  const locationHash = opts.locationHash ?? globalThis.location?.hash ?? '';
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
  // ----- GitHub Stars --------------------------------------------------------

  let cachedStarCount = /** @type {number|null} */ (null);

  render();
  fetchGitHubStars();

  // ----- Shared list import --------------------------------------------------

  const sharedItems = readShareFromHash(locationHash);
  if (sharedItems && sharedItems.length > 0) {
    try {
      if (globalThis.history?.replaceState && globalThis.location) {
        globalThis.history.replaceState(
          null,
          '',
          globalThis.location.pathname + globalThis.location.search,
        );
      }
    } catch {
      // Non-critical: removing the hash is a nice-to-have.
    }
    showImportDialog(sharedItems);
  }

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
    controls.appendChild(buildShareButton());
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
          <option value="documents">Documents</option>
          <option value="clothing">Clothing</option>
          <option value="toiletries">Toiletries</option>
          <option value="electronics">Electronics</option>
          <option value="pre-departure">Pre-departure</option>
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

    const uncheckedSection = document.createElement('section');
    uncheckedSection.className = 'list list-unchecked';
    uncheckedSection.setAttribute('aria-labelledby', 'heading-unchecked');
    const uncheckedHeading = document.createElement('h2');
    uncheckedHeading.id = 'heading-unchecked';
    uncheckedHeading.textContent = 'Unchecked items';
    uncheckedSection.appendChild(uncheckedHeading);

    const uncheckedItems = state.items.filter((i) => !i.checked);
    const uncheckedList = document.createElement('ul');
    uncheckedList.id = 'unchecked-items-list';
    uncheckedList.className = 'item-list';
    let uncheckedCollapsed = uncheckedItems.length > 5;
    if (uncheckedItems.length > 0) {
      const uncheckedToggle = document.createElement('button');
      uncheckedToggle.type = 'button';
      uncheckedToggle.className = 'unchecked-toggle';
      uncheckedToggle.setAttribute('aria-controls', uncheckedList.id);
      const updateUncheckedToggle = () => {
        uncheckedToggle.setAttribute('aria-expanded', String(!uncheckedCollapsed));
        uncheckedToggle.textContent = uncheckedCollapsed
          ? `Show ${uncheckedItems.length} items`
          : 'Hide items';
      };
      uncheckedToggle.addEventListener('click', () => {
        uncheckedCollapsed = !uncheckedCollapsed;
        uncheckedList.hidden = uncheckedCollapsed;
        updateUncheckedToggle();
      });
      updateUncheckedToggle();
      uncheckedSection.appendChild(uncheckedToggle);
    }
    if (uncheckedItems.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'empty';
      empty.textContent = 'Everything is packed';
      uncheckedList.appendChild(empty);
    } else {
      for (const item of uncheckedItems) {
        uncheckedList.appendChild(buildItem(item, 'unchecked-cb'));
      }
    }
    uncheckedList.hidden = uncheckedCollapsed;
    uncheckedSection.appendChild(uncheckedList);
    root.appendChild(uncheckedSection);

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
    const commitContent = isPlaceholder
      ? `dev`
      : `<a class="commit-link" href="https://github.com/DevSecNinja/travel-prep/commit/${shortHash}" target="_blank" rel="noopener">${shortHash}</a>`;
    footer.innerHTML = `
      <p>Travel Prep &mdash; Built by <a href="https://github.com/DevSecNinja" target="_blank" rel="noopener">DevSecNinja</a></p>
      <p class="storage-note">Your list is stored in this browser and will be lost if cache storage is cleared. For mobile, install Travel Prep as a PWA.</p>
      <span class="commit-sha">${commitContent}</span>
      <div class="github-star">
        <a href="https://github.com/DevSecNinja/travel-prep" target="_blank" rel="noopener" class="github-star-button">
          <span class="github-star-icon">⭐</span>
          <span id="starCountText">Star on GitHub</span>
        </a>
        <span class="github-star-cta">If you find this useful, please star the repo to support! 🧳</span>
      </div>
    `;
    root.appendChild(footer);

    if (cachedStarCount !== null) {
      updateStarCount(cachedStarCount);
    }
  }

  // ----- GitHub Stars --------------------------------------------------------

  async function fetchGitHubStars() {
    const CACHE_KEY = 'github_stars';
    const CACHE_DURATION = 60 * 60 * 1000; // 1 hour
    const REPO = 'DevSecNinja/travel-prep';

    try {
      const cached = storage.getItem(CACHE_KEY);
      if (cached) {
        const { count, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_DURATION) {
          cachedStarCount = count;
          updateStarCount(count);
          return;
        }
      }

      const response = await fetch(`https://api.github.com/repos/${REPO}`);
      if (response.ok) {
        const data = await response.json();
        const starCount = data.stargazers_count;
        storage.setItem(
          CACHE_KEY,
          JSON.stringify({ count: starCount, timestamp: Date.now() }),
        );
        cachedStarCount = starCount;
        updateStarCount(starCount);
      }
    } catch (error) {
      // Silently fail — star count is not critical
      console.debug('Could not fetch star count:', error);
    }
  }

  function updateStarCount(count) {
    const el = root.querySelector('#starCountText');
    if (el && count !== undefined) {
      const plural = count === 1 ? 'star' : 'stars';
      el.textContent = `${count.toLocaleString()} ${plural}`;
    }
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

  function buildShareButton() {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'share-btn';
    btn.textContent = '🔗 Share list';
    btn.addEventListener('click', () => {
      showShareDialog(buildShareUrl(state.items));
    });
    return btn;
  }

  /** @param {string} url */
  function showShareDialog(url) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'share-dialog-title');

    const dialog = document.createElement('div');
    dialog.className = 'modal';
    dialog.innerHTML = `
      <h2 id="share-dialog-title" class="modal-title">📤 Share your list</h2>
      <p class="modal-desc">Copy this link and send it to anyone — they can choose which items to add to their own list.</p>
      <div class="share-url-row">
        <input class="share-url-input" type="text" readonly aria-label="Shareable link" />
        <button type="button" class="share-copy-btn">Copy</button>
      </div>
      <div class="modal-actions">
        <button type="button" class="modal-close-btn">Done</button>
      </div>
    `;

    /** @type {HTMLInputElement} */ (dialog.querySelector('.share-url-input')).value = url;

    const copyBtn = /** @type {HTMLButtonElement} */ (dialog.querySelector('.share-copy-btn'));
    copyBtn.addEventListener('click', async () => {
      let success = false;
      try {
        await navigator.clipboard.writeText(url);
        success = true;
      } catch {
        const input = /** @type {HTMLInputElement} */ (dialog.querySelector('.share-url-input'));
        input.select();
        success = document.execCommand('copy');
      }
      copyBtn.textContent = success ? 'Copied!' : 'Copy failed';
      setTimeout(() => { copyBtn.textContent = 'Copy'; }, 2000);
    });

    const handleKeyDown = (/** @type {KeyboardEvent} */ e) => {
      if (e.key === 'Escape') close();
    };
    const close = () => {
      overlay.remove();
      document.removeEventListener('keydown', handleKeyDown);
    };
    dialog.querySelector('.modal-close-btn').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', handleKeyDown);

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    /** @type {HTMLInputElement} */ (dialog.querySelector('.share-url-input')).select();
  }

  /**
   * @param {Array<{name: string, category: string}>} sharedItems
   */
  function showImportDialog(sharedItems) {
    const valid = sharedItems.filter((i) => /** @type {readonly string[]} */ (CATEGORIES).includes(i.category));
    if (valid.length === 0) return;

    const existingKeys = new Set(
      state.items.map((i) => `${i.category}::${i.name.toLowerCase()}`),
    );
    const newItems = valid.filter(
      (i) => !existingKeys.has(`${i.category}::${i.name.toLowerCase()}`),
    );
    const alreadyItems = valid.filter(
      (i) => existingKeys.has(`${i.category}::${i.name.toLowerCase()}`),
    );

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'import-dialog-title');

    const dialog = document.createElement('div');
    dialog.className = 'modal';

    const title = document.createElement('h2');
    title.id = 'import-dialog-title';
    title.className = 'modal-title';
    title.textContent = '📥 Import shared list';
    dialog.appendChild(title);

    if (newItems.length === 0) {
      const note = document.createElement('p');
      note.className = 'modal-desc';
      note.textContent = 'All items from this shared list are already in your list.';
      dialog.appendChild(note);
    } else {
      const desc = document.createElement('p');
      desc.className = 'modal-desc';
      desc.textContent = 'Select the items you want to add to your list:';
      dialog.appendChild(desc);

      for (const cat of CATEGORIES) {
        const catNew = newItems.filter((i) => i.category === cat);
        const catExisting = alreadyItems.filter((i) => i.category === cat);
        if (catNew.length === 0 && catExisting.length === 0) continue;

        const section = document.createElement('section');
        section.className = 'import-category';

        const heading = document.createElement('h3');
        heading.className = 'import-category-heading';
        heading.textContent = CATEGORY_LABELS[cat];
        section.appendChild(heading);

        const ul = document.createElement('ul');
        ul.className = 'import-item-list';

        for (const item of catNew) {
          const li = document.createElement('li');
          li.className = 'import-item';
          const cb = document.createElement('input');
          cb.type = 'checkbox';
          cb.checked = true;
          cb.id = `import-cb-${cat}-${item.name}`;
          cb.dataset.name = item.name;
          cb.dataset.category = item.category;
          const lbl = document.createElement('label');
          lbl.htmlFor = cb.id;
          lbl.textContent = item.name;
          li.appendChild(cb);
          li.appendChild(lbl);
          ul.appendChild(li);
        }

        for (const item of catExisting) {
          const li = document.createElement('li');
          li.className = 'import-item import-item-existing';
          const cb = document.createElement('input');
          cb.type = 'checkbox';
          cb.checked = false;
          cb.disabled = true;
          cb.setAttribute('aria-label', `${item.name} — already in your list`);
          const lbl = document.createElement('label');
          lbl.textContent = `${item.name} (already in your list)`;
          li.appendChild(cb);
          li.appendChild(lbl);
          ul.appendChild(li);
        }

        section.appendChild(ul);
        dialog.appendChild(section);
      }
    }

    const actions = document.createElement('div');
    actions.className = 'modal-actions';

    const handleKeyDown = (/** @type {KeyboardEvent} */ e) => {
      if (e.key === 'Escape') close();
    };
    const close = () => {
      overlay.remove();
      document.removeEventListener('keydown', handleKeyDown);
    };
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', handleKeyDown);

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'modal-cancel-btn';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', close);
    actions.appendChild(cancelBtn);

    if (newItems.length > 0) {
      const importBtn = document.createElement('button');
      importBtn.type = 'button';
      importBtn.className = 'modal-import-btn';
      importBtn.textContent = 'Import selected';
      importBtn.addEventListener('click', () => {
        const checkboxes = /** @type {NodeListOf<HTMLInputElement>} */ (
          dialog.querySelectorAll('.import-item input[type="checkbox"]:checked:not(:disabled)')
        );
        let changed = false;
        for (const cb of checkboxes) {
          const name = cb.dataset.name ?? '';
          const category = /** @type {'documents'|'clothing'|'toiletries'|'electronics'|'pre-departure'} */ (cb.dataset.category ?? '');
          if (!name || !CATEGORIES.includes(category)) continue;
          const dup = state.items.find(
            (i) => i.category === category && i.name.toLowerCase() === name.toLowerCase(),
          );
          if (dup) continue;
          state.items.push({
            id: cryptoRandomId(),
            name,
            category,
            custom: true,
            checked: false,
          });
          changed = true;
        }
        if (changed) {
          saveState(state, storage);
          render();
        }
        close();
      });
      actions.appendChild(importBtn);
    }

    dialog.appendChild(actions);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    const firstFocusable = /** @type {HTMLElement|null} */ (
      dialog.querySelector('input[type="checkbox"]:not(:disabled), button')
    );
    if (firstFocusable) firstFocusable.focus();
  }

  /**
   * @param {Item} item
   * @param {string} [idPrefix]
   */
  function buildItem(item, idPrefix = 'cb') {
    const li = document.createElement('li');
    li.className = `item ${item.checked ? 'checked' : 'unchecked'}`;
    li.dataset.id = item.id;

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = item.checked;
    cb.id = `${idPrefix}-${item.id}`;
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
   * @param {'documents' | 'clothing' | 'toiletries' | 'electronics' | 'pre-departure'} category
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
