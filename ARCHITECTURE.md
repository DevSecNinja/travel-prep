# Architecture & Design Decisions

## Overview

Travel Prep is a single-file static web application (`index.html`) with zero external runtime dependencies beyond a Google Fonts CDN link. It is designed to be opened on a phone while packing for a trip and deployed via GitHub Pages with no build step. It is installable as a Progressive Web App (PWA) for offline use on iOS, Android, and desktop.

## File Structure

```
.
├── index.html                      # Entire application (HTML + inline CSS + inline JS)
├── data/items.yaml                 # Default packing items (YAML source of truth)
├── manifest.json                   # PWA web app manifest
├── sw.js                           # Service worker for offline caching
├── icons/                          # PWA icons
│   ├── icon-192.png                # 192×192 app icon
│   ├── icon-512.png                # 512×512 app icon
│   ├── icon-maskable-192.png       # 192×192 maskable icon
│   └── icon-maskable-512.png       # 512×512 maskable icon
├── robots.txt                      # Search engine crawl rules
├── sitemap.xml                     # Sitemap for search engines
├── jest.config.js                  # Jest test configuration
├── playwright.config.js            # Playwright e2e test configuration
├── package.json                    # Project metadata & scripts
├── .github/workflows/pages.yml     # GitHub Pages deployment workflow
├── .github/CODEOWNERS              # Code ownership
├── renovate.json5                  # Renovate dependency management
├── tests/
│   ├── setup.js                    # Jest global setup
│   ├── unit/                       # Unit tests (logic, YAML parser, state)
│   ├── html-validation/            # HTML validation tests
│   ├── accessibility/              # Accessibility tests
│   ├── pwa/                        # PWA meta tag & service worker tests
│   └── e2e/                        # Playwright end-to-end tests
├── README.md                       # Project documentation
├── ARCHITECTURE.md                 # This file
└── LICENSE                         # MIT license
```

## Why a Single File?

Everything lives in one `index.html` with inline `<style>` and `<script>` blocks:

- **Zero build step** — no bundler, no npm runtime, no framework.
- **Deploy and forget** — push to `main` and GitHub Pages serves it.
- **Instant load** — one HTTP request for the document, one for the font.
- **Portable** — can be opened directly from the filesystem (`file://`).

## Data Flow

```
data/items.yaml  →  (fetched at runtime)  →  App state
                                               ↕
                                          localStorage
                                               ↕
                                          DOM rendering
```

1. **First visit:** The app fetches `data/items.yaml`, parses it with a minimal inline YAML parser, and uses it as the initial state. A fallback `DEFAULT_ITEMS` constant is embedded in the JS for when the YAML fetch fails (offline/file:// use).
2. **Subsequent visits:** State is loaded from `localStorage`. The YAML file is not re-fetched.
3. **User modifications:** Adding/checking/deleting items updates the in-memory state, re-renders the DOM, and persists to `localStorage`.

## Item State Model

Items in each category can be in two forms:

| Form | Shape | Meaning |
|------|-------|---------|
| String | `"passport"` | Default item, never toggled |
| Object | `{ name, checked, userAdded }` | Item that has been interacted with |

When a string item is first toggled, it's promoted to an object. This allows the YAML defaults to remain simple strings while supporting rich state once the user interacts.

## Categories

Two built-in categories with visual distinctions:

| Category | Color | Emoji | Purpose |
|----------|-------|-------|---------|
| Must-Have | Red | 🔴 | Essential items you can't travel without |
| Nice-to-Have | Yellow | 🟡 | Optional items that improve the trip |

## Suitcase Animation

When an item is checked:
1. The item card plays a `packItem` CSS animation (scale + translate + fade)
2. A chip with the item name appears in the suitcase area with a `dropIn` animation
3. The progress bar and counter update

When an item is unchecked (from the suitcase or the list):
1. The chip is removed from the suitcase
2. The card returns to its unchecked visual state
3. Progress updates accordingly

## Theme System

Three theme modes cycle on button press: **Auto → Light → Dark → Auto…**

| Mode | Behavior |
|------|----------|
| Auto | Follows `prefers-color-scheme` media query |
| Light | Forces light theme |
| Dark | Forces dark theme |

The active mode is persisted in `localStorage` under `travel-prep-theme`. CSS custom properties (60+ variables) on `:root` and `[data-theme="dark"]` control all colors, enabling instant theme switching without layout recalculation.

### Color Palette

**Light theme:** Soft indigo accents (`#6366f1`), white cards, light blue-gray background. Red for must-have badges, amber for nice-to-have.

**Dark theme:** Deep navy background (`#0f172a`), slate cards, purple accents. Warm-toned badges maintain contrast.

## Progressive Web App (PWA)

### Components

| File | Purpose |
|------|---------|
| `manifest.json` | App name, icons, theme color, display mode (`standalone`), start URL |
| `sw.js` | Service worker: caches app assets and fonts for offline use |
| `icons/` | PNG icons at 192×192 and 512×512, plus maskable variants |

### Caching Strategy

Cache-first with network fallback:

1. **Install** — Pre-caches `index.html`, `manifest.json`, `data/items.yaml`, and icons.
2. **Fetch** — Serves from cache first; falls back to network and caches new responses.
3. **Activate** — Deletes old cache versions when a new service worker deploys.

### Auto-Update Flow

1. GitHub Actions sets a unique `CACHE_NAME` per commit (`travel-prep-sha-<hash>`)
2. New service worker installs with the new cache name
3. On detection, an "Update available" banner appears
4. User taps → `SKIP_WAITING` message → new SW activates → page reloads

### iOS Support

Apple-specific meta tags ensure proper PWA behavior:
- `apple-mobile-web-app-capable` — standalone mode
- `apple-mobile-web-app-status-bar-style` — translucent status bar
- `apple-mobile-web-app-title` — home screen label
- `viewport-fit=cover` with `env(safe-area-inset-*)` for notch/Dynamic Island

## Deployment

### GitHub Pages (Production)

The workflow `.github/workflows/pages.yml` triggers on every push to `main`:

1. **Test job** — runs unit, HTML, accessibility, PWA, and e2e tests
2. **Deploy job** — updates SW cache version & footer SHA via `sed`, uploads to Pages

### Cache Versioning

The `CACHE_NAME` in `sw.js` includes a version string. Locally it's `travel-prep-v1.0.0`; in production the GitHub Actions workflow rewrites it to `travel-prep-sha-<short-sha>`. This ensures every deploy busts the old cache.

## Testing Strategy

| Suite | Tool | What it tests |
|-------|------|---------------|
| Unit | Jest + JSDOM | State management, YAML parser, item operations, localStorage |
| HTML | Jest + html-validate | Valid HTML5, meta tags, lang attribute |
| Accessibility | Jest + JSDOM | ARIA attributes, labels, heading hierarchy, interactive elements |
| PWA | Jest (Node) | Manifest fields, SW patterns, Apple meta tags, icon files |
| E2E | Playwright (WebKit) | Full user flows: check items, add items, delete, theme toggle, SW registration |

## Design Trade-offs

| Decision | Rationale |
|----------|-----------|
| Single file over components | Simplicity; no module system needed |
| Inline CSS/JS over separate files | One fewer HTTP request; easier to maintain |
| Minimal YAML parser over js-yaml | Zero runtime dependencies; our YAML is trivially simple |
| `localStorage` over IndexedDB | Simpler API; packing list data is small |
| CSS animations over JS animations | GPU-accelerated; no JavaScript overhead |
| String → Object item promotion | Keeps YAML defaults clean while supporting state |
