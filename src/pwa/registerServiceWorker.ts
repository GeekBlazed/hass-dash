export function registerServiceWorker(): void {
  if (!import.meta.env.PROD) return;

  // Lighthouse CI (and similar synthetic runs) can become flaky if a brand-new
  // service worker install triggers reload/update behavior on a fresh origin.
  // Opt out explicitly via query string for stable audits.
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    if (params.has('lhci') || params.get('sw') === '0') return;
  }

  // Defer the SW module load itself to keep initial JS smaller.
  // (workbox-window is not needed to paint the UI.)
  void (async () => {
    const { registerSW } = await import('virtual:pwa-register');

    registerSW({
      immediate: true,
    });
  })();
}
