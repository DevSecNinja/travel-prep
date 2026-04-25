import { initApp } from './app.js';

const BUILD_ID = '__BUILD_ID__';

const root = document.getElementById('app');
if (root) {
  initApp(root, { buildId: BUILD_ID }).catch((err) => {
    console.error(err);
    root.innerHTML =
      '<p role="alert" class="error">Failed to load packing list. Please refresh.</p>';
  });
}

// Register the service worker for PWA / offline support.
// The hash query string is replaced at deploy time so every commit triggers an
// update via the workflow's `sed` step (see .github/workflows/deploy.yml).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./service-worker.js?v=__BUILD_ID__')
      .then((reg) => {
        // Auto-refresh when a new service worker takes control.
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            if (
              newWorker.state === 'activated' &&
              navigator.serviceWorker.controller
            ) {
              // A new version has taken over — reload to pick it up.
              window.location.reload();
            }
          });
        });
        // Periodically check for updates while the page is open.
        setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
      })
      .catch((err) => console.warn('SW registration failed:', err));
  });
}
