# Architecture

Travel Prep is a deliberately small, framework-free Progressive Web App.

## Goals

1. **Minimal runtime dependencies.** Plain HTML, CSS and JavaScript shipped
   directly to the browser — no bundler or transpiler in the deploy path.
2. **Works offline.** Once visited, the app shell and seed data are cached by
   a service worker so the list keeps working on a plane.
3. **Fast updates.** Each push to `main` redeploys with a fresh cache key,
   and the page automatically reloads when the new service worker activates.
4. **Local-first data.** Nothing leaves the browser — no accounts, no backend.
5. **Accessible by default.** Semantic HTML, labelled controls, keyboard
   support, `prefers-reduced-motion` and `prefers-color-scheme` honoured.

## High-level flow

```
┌──────────────┐    fetch ./data/items.yaml    ┌────────────────────┐
│  index.html  │──────────────────────────────▶│ data/items.yaml    │
│  + main.js   │                               └────────────────────┘
│              │
│              │  load existing state           ┌────────────────────┐
│              │ ◀───────────────────────────── │ localStorage       │
│              │                                │ travel-prep:state  │
│              │  saveState()                   └────────────────────┘
│              │ ─────────────────────────────▶
│              │
│              │  registers                     ┌────────────────────┐
│              │ ─────────────────────────────▶ │ service-worker.js  │
│              │                                │ (cache + offline)  │
└──────────────┘                                └────────────────────┘
```

## Modules

| Module           | Responsibility                                                                    |
| ---------------- | --------------------------------------------------------------------------------- |
| `src/main.js`    | Bootstraps the app on `DOMContentLoaded` and registers the service worker.        |
| `src/app.js`     | All UI rendering, event handling and the suitcase animation.                      |
| `src/storage.js` | `localStorage` shape, JSON validation, and merging of YAML defaults with state.   |
| `src/yaml.js`    | Tiny YAML parser limited to the file shape we control.                            |
| `service-worker.js` | App-shell precache + network-first for HTML / YAML, cache-first for assets.    |

### Why a custom YAML parser?

The seed file is intentionally tiny and uses one simple shape (top-level keys
with string list values). A 50-line parser keeps us dependency-free. If the
data model grows, swap in [`js-yaml`](https://github.com/nodeca/js-yaml).

## State model

A single key, `travel-prep:state:v1`, holds:

```jsonc
{
  "version": 1,
  "theme": "auto" | "light" | "dark",
  "items": [
    { "id": "uuid", "name": "passport", "category": "must-have",
      "custom": false, "checked": false }
  ]
}
```

`mergeDefaults()` re-seeds defaults from YAML on every load while preserving
the user's `checked` flags and any custom items.

## PWA + auto-update strategy

- The service worker version is `travel-prep-${BUILD_ID}`.
- During GitHub Pages deploys (`.github/workflows/deploy.yml`), the workflow
  replaces the `__BUILD_ID__` placeholder in `service-worker.js` and
  `src/main.js` with the commit SHA + timestamp. This guarantees a unique
  cache name and a unique SW URL on every commit.
- `src/main.js` listens for `updatefound` and reloads the page once the new
  SW activates, so users always see the latest version without manually
  refreshing.

## Deployment

Two workflows under `.github/workflows/`:

| Workflow      | Trigger                       | Action                                           |
| ------------- | ----------------------------- | ------------------------------------------------ |
| `ci.yml`      | every push and PR             | `npm ci && npm test`                             |
| `deploy.yml`  | push to `main`, manual        | tests, stamp build id, deploy to GitHub Pages    |

## Testing

[Vitest](https://vitest.dev/) with the `jsdom` environment runs three layers:

- **Unit tests** — `tests/yaml.test.js`, `tests/storage.test.js`.
- **Integration tests** — `tests/app.test.js` drives `initApp` against a
  mocked `localStorage` and `fetchYaml`, exercising user flows end-to-end.
- **Accessibility** — the same integration suite runs
  [`axe-core`](https://github.com/dequelabs/axe-core) on the rendered DOM and
  fails on any serious / critical WCAG 2 A/AA violation.

## Future ideas

- Trip presets (beach / business / camping) selectable from the YAML.
- Quantities per item ("3× socks").
- Multiple concurrent trips.
- Optional sync via a passwordless backend.
