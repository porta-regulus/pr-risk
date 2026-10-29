import { scriptUrl } from './trusted-types';

export function registerServiceWorker(): void {
  if (import.meta.env.DEV || !('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register(scriptUrl('/sw.js'), { scope: '/' }).catch((error: unknown) => {
    console.error('Service worker registration failed', error);
  });
}
