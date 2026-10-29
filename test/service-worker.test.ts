import { describe, expect, it } from 'vitest';
import { serviceWorkerSource } from '../build/service-worker';

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
