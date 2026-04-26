# 🧳 Travel Prep

A friendly, offline-capable packing list to help you prep for your next flight,
train or road trip.

> Plain HTML + CSS + vanilla JavaScript. No runtime framework. Tiny dependency
> footprint (dev-only test tooling).

## Features

- Five categories — **Documents**, **Clothing**, **Toiletries**, **Electronics**,
  and **Pre-departure** — seeded from [`data/items.yaml`](./data/items.yaml).
- Add your own items, check / uncheck them, or **uncheck all** with a single
  click after your trip.
- A 🧳 suitcase animation flies each item into the case as you pack it
  (respects `prefers-reduced-motion`).
- All your data lives **only in your browser** (`localStorage`).
- Soft, colourful, modern theme with **automatic dark / light mode** that
  follows your OS, plus a manual override.
- Installable **PWA** with a service worker that keeps everything available
  offline and auto-updates the page on every commit to `main`.

## Try it

The app is auto-deployed to GitHub Pages on every push to `main`:

> https://devsecninja.github.io/travel-prep/

### Run locally

```bash
npm install
npm start          # dev server at http://localhost:8080
npm test           # unit + integration + accessibility tests (vitest)
```

There's no build step — `npm start` serves the static files exactly as they're
deployed.

## Project layout

```
.
├── index.html               # app shell
├── styles.css               # theme + layout
├── manifest.webmanifest     # PWA manifest
├── service-worker.js        # offline cache + auto-update
├── src/
│   ├── main.js              # entry point + SW registration
│   ├── app.js               # rendering + interaction logic
│   ├── storage.js           # localStorage shape + merge helpers
│   └── yaml.js              # tiny YAML parser
├── data/items.yaml          # seed packing list
├── icons/                   # PWA icons
├── tests/                   # vitest + jsdom + axe-core
├── tools/serve.js           # zero-dep dev server
├── docs/ARCHITECTURE.md     # design notes
└── .github/workflows/       # CI + GitHub Pages deploy
```

See [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) for the design notes.

## Contributing

Issues and PRs welcome. Keep the philosophy in mind: **plain web platform, few
dependencies**.

## License

MIT — see [LICENSE](./LICENSE).
