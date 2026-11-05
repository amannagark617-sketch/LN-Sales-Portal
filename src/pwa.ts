/// <reference types="vite/client" />
// Registers the service worker and reports when a newer version of the app is ready.
export const UPDATE_EVENT = 'ln-app-update';
let waiting: ServiceWorker | null = null;

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return;
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      const announce = (w: ServiceWorker | null) => { if (w && navigator.serviceWorker.controller) { waiting = w; window.dispatchEvent(new Event(UPDATE_EVENT)); } };
      if (reg.waiting) announce(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        w?.addEventListener('statechange', () => { if (w.state === 'installed') announce(w); });
      });
      // look for a new version whenever the app is opened again
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
      let reloading = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloading) { reloading = true; window.location.reload(); } });
    } catch { /* the app works without it */ }
  });
}

export const hasWaitingUpdate = () => !!waiting;
export function applyUpdate() { waiting?.postMessage({ type: 'SKIP_WAITING' }); }
