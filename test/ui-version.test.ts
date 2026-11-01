// The "version changed" rule of the notice of a new version (gap F5).
import { describe, expect, it } from 'vitest';
import { checkVersion, noticeState, onNoticeState, recordVersion, releaseUrl, SEEN_VERSION_KEY, setNoticeState, versionChanged } from '../src/ui/version';

function memoryStorage(initial?: string): Pick<Storage, 'getItem' | 'setItem'> & { readonly values: Map<string, string> } {
  const values = new Map<string, string>(initial === undefined ? [] : [[SEEN_VERSION_KEY, initial]]);
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}

const blocked: Pick<Storage, 'getItem' | 'setItem'> = {
  getItem: () => {
    throw new Error('SecurityError');
  },
  setItem: () => {
    throw new Error('SecurityError');
  },
};

describe('version changed rule', () => {
  it('is true only when a stored version differs from the active version', () => {
    expect(versionChanged(null, '1.0.0')).toBe(false);
    expect(versionChanged('1.0.0', '1.0.0')).toBe(false);
    expect(versionChanged('1.0.0-rc.1', '1.0.0')).toBe(true);
    expect(versionChanged('1.0.1', '1.0.0')).toBe(true);
  });

  it('records the version on a first start and shows no notice', () => {
    const storage = memoryStorage();
    expect(checkVersion('1.0.0', storage)).toBe(false);
    expect(storage.values.get(SEEN_VERSION_KEY)).toBe('1.0.0');
    expect(checkVersion('1.0.0', storage)).toBe(false);
  });

  it('shows the notice on each start until the user closes it', () => {
    const storage = memoryStorage('1.0.0-rc.1');
    expect(checkVersion('1.0.0', storage)).toBe(true);
    expect(storage.values.get(SEEN_VERSION_KEY)).toBe('1.0.0-rc.1');
    expect(checkVersion('1.0.0', storage)).toBe(true);
    recordVersion('1.0.0', storage);
    expect(checkVersion('1.0.0', storage)).toBe(false);
  });

  it('shows no notice and does not throw when the browser blocks storage', () => {
    expect(checkVersion('1.0.0', blocked)).toBe(false);
    expect(() => {
      recordVersion('1.0.0', blocked);
    }).not.toThrow();
    expect(checkVersion('1.0.0', undefined)).toBe(false);
  });

  it('links to the release notes of the active version', () => {
    expect(releaseUrl('1.0.0-rc.1')).toBe('https://github.com/porta-regulus/pr-risk/releases/tag/v1.0.0-rc.1');
  });

  it('shares one state between the screens', () => {
    const seen: boolean[] = [];
    const stop = onNoticeState((next) => seen.push(next.ready));
    setNoticeState({ ready: true });
    stop();
    setNoticeState({ ready: false });
    expect(seen).toEqual([true]);
    expect(noticeState()).toEqual({ changed: false, ready: false });
  });
});
