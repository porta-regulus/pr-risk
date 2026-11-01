import { scriptUrl } from './trusted-types';

// The parts of the service worker API that the update watch reads. Tests pass fakes.
interface WorkerLike extends EventTarget {
  readonly state: string;
}
interface RegistrationLike extends EventTarget {
  readonly installing: WorkerLike | null;
  readonly waiting: object | null;
}
interface ContainerLike extends EventTarget {
  readonly controller: object | null;
}

// Calls onUpdate when a new version is installed while an older one controls the page, or when
// a new service worker takes control from an older one. The first install also takes control
// (clients.claim in sw.js), but it is not an update, so a page with no controller gets no call.
// The browser's own update check finds the new version. This adds no request (ADR-0004 T3).
export function watchForUpdate(container: ContainerLike, registration: RegistrationLike, onUpdate: () => void): void {
  let controlled = container.controller !== null;
  const track = (worker: WorkerLike | null): void => {
    worker?.addEventListener('statechange', () => {
      if (worker.state === 'installed' && container.controller !== null) onUpdate();
    });
  };
  if (controlled && registration.waiting !== null) onUpdate();
  track(registration.installing);
  registration.addEventListener('updatefound', () => {
    track(registration.installing);
  });
  container.addEventListener('controllerchange', () => {
    if (controlled) onUpdate();
    controlled = container.controller !== null;
  });
}

export function registerServiceWorker(onUpdate: () => void): void {
  if (import.meta.env.DEV || !('serviceWorker' in navigator)) return;
  const container = navigator.serviceWorker;
  container
    .register(scriptUrl('/sw.js'), { scope: '/' })
    .then((registration) => {
      watchForUpdate(container, registration, onUpdate);
    })
    .catch((error: unknown) => {
      console.error('Service worker registration failed', error);
    });
}
