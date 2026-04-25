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
    // Track whether there was already a controller before this page load.
    // Used below to avoid reloading on the very first install (no previous SW).
    const hadController = !!navigator.serviceWorker.controller;

    // Guard against reloading more than once (both controllerchange and the
    // statechange path could fire for the same update).
    let reloading = false;
    function reloadOnce() {
      if (!reloading) {
        reloading = true;
        window.location.reload();
      }
    }

    // controllerchange fires whenever a new SW takes control via clients.claim().
    // This is the most reliable update signal on iOS standalone PWAs, where the
    // updatefound / statechange path can be missed after a hard close.
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hadController) reloadOnce();
    });

    navigator.serviceWorker
      .register('./service-worker.js?v=__BUILD_ID__')
      .then((reg) => {
        // Belt-and-suspenders: also listen on the installing worker's state
        // transitions for browsers that surface updatefound reliably.
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            if (
              newWorker.state === 'activated' &&
              navigator.serviceWorker.controller
            ) {
              // A new version has taken over — reload to pick it up.
              reloadOnce();
            }
          });
        });
        // Periodically check for updates while the page is open.
        setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
        // Also check when the tab / PWA window becomes visible again.
        // On iOS, the app can be backgrounded and foregrounded without a full
        // page reload, so this ensures we catch updates promptly on resume.
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            reg.update().catch(() => {});
          }
        });
      })
      .catch((err) => console.warn('SW registration failed:', err));
  });
}
