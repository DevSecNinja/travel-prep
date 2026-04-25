# ✈️ Travel Prep — Packing List

A colorful, offline-ready packing list app to prepare for your next flight, train, or car trip. Never forget your essentials!

🌐 **Live:** [devsecninja.github.io/travel-prep](https://devsecninja.github.io/travel-prep/)

## Features

- ✅ **Two categories** — Must-Have and Nice-to-Have items
- 🧳 **Suitcase animation** — checked items fly into a visual suitcase
- ➕ **Add your own items** — custom entries saved locally
- ↩️ **Uncheck all** — reset after your trip, or uncheck individually
- 💾 **Offline-ready PWA** — install on your phone, works without internet
- 🌙 **Dark / Light / Auto** theme — follows your system preference
- 📦 **Zero build step** — plain HTML, CSS, and JavaScript
- 🔄 **Auto-updates** — new service worker version deployed on every commit

## Getting Started

The app is a single static HTML file. No build step required.

```bash
# Open locally
open index.html

# Or serve with any static server
npx serve .
```

### Install as PWA

1. Open the live site on your phone
2. Tap "Add to Home Screen" (iOS) or the install prompt (Android)
3. The app works fully offline after installation

## Default Items

Default packing items are stored in [`data/items.yaml`](data/items.yaml):

| Category    | Items                                           |
|-------------|------------------------------------------------|
| Must-Have   | Passport, Toothbrush, Toothpaste, Socks, Underwear |
| Nice-to-Have | Sunscreen, Umbrella                            |

Users can add custom items via the in-app form. All data is stored in the browser's localStorage.

## Development

### Prerequisites

- Node.js 24+
- npm

### Install dependencies

```bash
npm install
```

### Run tests

```bash
# All Jest tests (unit + HTML + a11y + PWA)
npm test

# Individual suites
npm run test:unit
npm run test:html
npm run test:a11y
npm run test:pwa

# End-to-end (requires Playwright WebKit)
npx playwright install webkit --with-deps
npm run test:e2e
```

## Deployment

The app auto-deploys to GitHub Pages on every push to `main`:

1. Tests run (unit, HTML validation, accessibility, PWA, e2e)
2. Service worker cache version is set to the commit SHA
3. Static files are uploaded and deployed

See [`.github/workflows/pages.yml`](.github/workflows/pages.yml) for details.

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for design decisions, file structure, and technical details.

## License

[MIT](LICENSE)
