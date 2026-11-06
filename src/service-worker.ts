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

// activated: the new version took over, and the page reloads. other-tabs: another window of the
// app is open. no-update: no new version waits, or it gave no answer, for example a version from
// before this request existed. Then only a new start of the app activates it.
export type ActivateResult = 'activated' | 'other-tabs' | 'no-update';

interface WaitingLike {
  postMessage(message: unknown, transfer: Transferable[]): void;
}

// ADR-0004 T3. Asks the waiting version to take over now. The caller must have no unsaved work,
// because the page reloads.
export function requestActivation(container: Pick<ContainerLike, 'addEventListener'>, waiting: WaitingLike | null, reload: () => void, timeoutMs = 3000): Promise<ActivateResult> {
  if (waiting === null) return Promise.resolve('no-update');
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    // The new version can take control before its answer arrives, so listen before the request.
    let changed = false;
    let accepted = false;
    const finish = (): void => {
      resolve('activated');
      reload();
    };
    container.addEventListener(
      'controllerchange',
      () => {
        changed = true;
        if (accepted) finish();
      },
      { once: true },
    );
    const timer = setTimeout(() => {
      channel.port1.close();
      resolve('no-update');
    }, timeoutMs);
    channel.port1.onmessage = (event: MessageEvent) => {
      clearTimeout(timer);
      channel.port1.close();
      if ((event.data as { ok?: unknown } | null)?.ok !== true) {
        resolve('other-tabs');
        return;
      }
      accepted = true;
      if (changed) finish();
    };
    waiting.postMessage({ type: 'activate-now' }, [channel.port2]);
  });
}

let registered: ServiceWorkerRegistration | undefined;

export function activateNewVersion(): Promise<ActivateResult> {
  if (registered === undefined || !('serviceWorker' in navigator)) return Promise.resolve('no-update');
  return requestActivation(navigator.serviceWorker, registered.waiting, () => {
    window.location.reload();
  });
}

export function registerServiceWorker(onUpdate: () => void): void {
  if (import.meta.env.DEV || !('serviceWorker' in navigator)) return;
  const container = navigator.serviceWorker;
  container
    .register(scriptUrl('/sw.js'), { scope: '/' })
    .then((registration) => {
      registered = registration;
      watchForUpdate(container, registration, onUpdate);
    })
    .catch((error: unknown) => {
      console.error('Service worker registration failed', error);
    });
}
