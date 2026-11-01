import { describe, expect, it } from 'vitest';
import { serviceWorkerSource } from '../build/service-worker';
import { watchForUpdate } from '../src/service-worker';

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
