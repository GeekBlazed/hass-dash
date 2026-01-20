import { registerSW } from 'virtual:pwa-register';

export function registerServiceWorker(): void {
  if (!import.meta.env.PROD) return;

  // Lighthouse CI (and similar synthetic runs) can become flaky if a brand-new
  // service worker install triggers reload/update behavior on a fresh origin.
  // Opt out explicitly via query string for stable audits.
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    if (params.has('lhci') || params.get('sw') === '0') return;
  }

  registerSW({
    immediate: true,
  });
}
