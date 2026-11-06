import { describe, expect, it } from 'vitest';
import { serviceWorkerSource } from '../build/service-worker';
import { requestActivation, watchForUpdate } from '../src/service-worker';

function precacheOf(source: string): string[] {
  const line = source.split('\n').find((text) => text.startsWith('const PR_RISK_PRECACHE = '));
  return JSON.parse(line?.slice('const PR_RISK_PRECACHE = '.length, -1) ?? '[]') as string[];
}

describe('service worker source', () => {
  const files = new Map<string, string>([
    ['/index.html', '<html></html>'],
    ['/assets/index-abc.js', 'console.log(1)'],
  ]);

  it('caches the app shell as / and every other file', () => {
    expect(precacheOf(serviceWorkerSource(files))).toEqual(['/', '/assets/index-abc.js']);
  });

  it('changes when any file changes', () => {
    const changed = new Map(files).set('/assets/index-abc.js', 'console.log(2)');
    expect(serviceWorkerSource(changed)).not.toBe(serviceWorkerSource(files));
  });

  it('is the same for the same files in another order', () => {
    const reversed = new Map([...files].reverse());
    expect(serviceWorkerSource(reversed)).toBe(serviceWorkerSource(files));
  });
});

// Fakes of the service worker API for the update watch (gap F5, ADR-0004 T3).
class FakeWorker extends EventTarget {
  state = 'installing';
  moveTo(state: string): void {
    this.state = state;
    this.dispatchEvent(new Event('statechange'));
  }
}

class FakeRegistration extends EventTarget {
  installing: FakeWorker | null = null;
  waiting: FakeWorker | null = null;
  find(worker: FakeWorker): void {
    this.installing = worker;
    this.dispatchEvent(new Event('updatefound'));
  }
}

class FakeContainer extends EventTarget {
  constructor(public controller: object | null) {
    super();
  }
  takeControl(worker: object): void {
    this.controller = worker;
    this.dispatchEvent(new Event('controllerchange'));
  }
}

function watch(controller: object | null, registration = new FakeRegistration()) {
  const container = new FakeContainer(controller);
  let updates = 0;
  watchForUpdate(container, registration, () => {
    updates++;
  });
  return { container, registration, updates: () => updates };
}

describe('update watch', () => {
  it('stays quiet on the first install, which also takes control', () => {
    const { container, registration, updates } = watch(null);
    const worker = new FakeWorker();
    registration.find(worker);
    worker.moveTo('installed');
    worker.moveTo('activated');
    container.takeControl(worker);
    expect(updates()).toBe(0);
  });

  it('reports a new version that is installed while an older one controls the page', () => {
    const { registration, updates } = watch(new FakeWorker());
    const worker = new FakeWorker();
    registration.find(worker);
    expect(updates()).toBe(0);
    worker.moveTo('installed');
    expect(updates()).toBe(1);
  });

  it('reports a new version that already waits when the page starts', () => {
    const registration = new FakeRegistration();
    registration.waiting = new FakeWorker();
    expect(watch(new FakeWorker(), registration).updates()).toBe(1);
  });

  it('reports a new service worker that takes control from an older one', () => {
    const { container, updates } = watch(new FakeWorker());
    container.takeControl(new FakeWorker());
    expect(updates()).toBe(1);
  });

  it('reports an update after the first install of the same session', () => {
    const { container, registration, updates } = watch(null);
    const first = new FakeWorker();
    registration.find(first);
    first.moveTo('installed');
    container.takeControl(first);
    const second = new FakeWorker();
    registration.find(second);
    second.moveTo('installed');
    expect(updates()).toBe(1);
  });
});

// "Use the new version now" (ADR-0004 T3). The waiting worker answers on the port of the request.
describe('requestActivation', () => {
  class FakeWaiting {
    constructor(private readonly answer: { ok: boolean } | undefined) {}
    postMessage(message: unknown, transfer: Transferable[]): void {
      expect(message).toEqual({ type: 'activate-now' });
      const port = transfer[0] as MessagePort;
      if (this.answer !== undefined) port.postMessage(this.answer);
    }
  }

  it('reloads after the new version takes control', async () => {
    const container = new EventTarget();
    let reloads = 0;
    const result = requestActivation(container, new FakeWaiting({ ok: true }), () => {
      reloads += 1;
    });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(reloads).toBe(0);
    container.dispatchEvent(new Event('controllerchange'));
    await expect(result).resolves.toBe('activated');
    expect(reloads).toBe(1);
  });

  it('reports other open tabs and does not reload', async () => {
    let reloads = 0;
    await expect(requestActivation(new EventTarget(), new FakeWaiting({ ok: false }), () => (reloads += 1))).resolves.toBe('other-tabs');
    expect(reloads).toBe(0);
  });

  it('reports no update when nothing waits or the worker does not answer', async () => {
    await expect(requestActivation(new EventTarget(), null, () => undefined)).resolves.toBe('no-update');
    await expect(requestActivation(new EventTarget(), new FakeWaiting(undefined), () => undefined, 50)).resolves.toBe('no-update');
  });
});

describe('requestActivation order', () => {
  it('reloads also when the new version takes control before its answer arrives', async () => {
    const container = new EventTarget();
    let reloads = 0;
    const waiting = {
      postMessage(_message: unknown, transfer: Transferable[]): void {
        container.dispatchEvent(new Event('controllerchange'));
        (transfer[0] as MessagePort).postMessage({ ok: true });
      },
    };
    await expect(requestActivation(container, waiting, () => (reloads += 1))).resolves.toBe('activated');
    expect(reloads).toBe(1);
  });
});

describe('requestActivation switch timeout', () => {
  it('gives up when control does not change after a yes, and never reloads later', async () => {
    const container = new EventTarget();
    let reloads = 0;
    const waiting = {
      postMessage(_message: unknown, transfer: Transferable[]): void {
        (transfer[0] as MessagePort).postMessage({ ok: true });
      },
    };
    await expect(requestActivation(container, waiting, () => (reloads += 1), 1000, 30)).resolves.toBe('no-update');
    container.dispatchEvent(new Event('controllerchange'));
    expect(reloads).toBe(0);
  });
});
