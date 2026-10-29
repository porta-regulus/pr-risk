import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { checkScriptUrl } from '../src/trusted-types';

const allowed = (input: string): boolean => input === '/sw.js' || /^\/assets\/[A-Za-z0-9_-]+\.js$/.test(input) || input.startsWith('/src/');

describe('Trusted Types script URL policy', () => {
  it('allows the service worker and the hashed build chunks', () => {
    expect(checkScriptUrl('/sw.js')).toBe('/sw.js');
    expect(checkScriptUrl('/assets/worker-Bx8_kq2Z.js')).toBe('/assets/worker-Bx8_kq2Z.js');
  });

  it('rejects other origins, other paths and data URLs', () => {
    for (const input of ['sw.js', '/sw.js?x=1', '//evil.example/sw.js', 'https://evil.example/assets/a.js', 'data:text/javascript,1', '/assets/../a.js', '/assets/a.js?x', '/assets/sub/a.js']) {
      expect(() => checkScriptUrl(input), input).toThrow(TypeError);
    }
  });

  it('rejects every other URL', () => {
    fc.assert(
      fc.property(fc.oneof(fc.string(), fc.webUrl()), (input) => {
        fc.pre(!allowed(input));
        expect(() => checkScriptUrl(input)).toThrow(TypeError);
      }),
    );
  });
});
