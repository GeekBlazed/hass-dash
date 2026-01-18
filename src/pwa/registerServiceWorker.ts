import { registerSW } from 'virtual:pwa-register';

export function registerServiceWorker(): void {
  if (!import.meta.env.PROD) return;

  registerSW({
    immediate: true,
  });
}
