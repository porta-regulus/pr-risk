import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { headersFor, loadHeaderConfig, metaPolicy } from '../build/security-headers';

// SPEC.md Sec. 11 item 2. The headers are exactly as in ADR-0004.
function adrHeaders(): Record<string, string> {
  const adr = readFileSync(new URL('../docs/adr/0004-local-first-data-and-threat-model.md', import.meta.url), 'utf8');
  const section = adr.split('## Required HTTP headers on the hosted origin')[1];
  const block = section?.split('```')[1];
  if (block === undefined) throw new Error('ADR-0004 has no header block');
  const headers: Record<string, string> = {};
  for (const line of block.trim().split('\n')) {
    const at = line.indexOf(': ');
    headers[line.slice(0, at)] = line.slice(at + 2);
  }
  return headers;
}

describe('security headers', () => {
  const config = loadHeaderConfig();

  it('equal the header block of ADR-0004', () => {
    expect(config.default).toEqual(adrHeaders());
  });

  it('apply the defaults to every path without an override', () => {
    expect(headersFor(config, '/assets/index.js')).toEqual(config.default);
  });

  it('differ for /sw.js only in connect-src, as the ADR-0004 exception says', () => {
    expect(Object.keys(config.paths)).toEqual(['/sw.js']);
    const csp = config.default['Content-Security-Policy'] ?? '';
    expect(headersFor(config, '/sw.js')).toEqual({
      ...config.default,
      'Content-Security-Policy': csp.replace("connect-src 'none'", "connect-src 'self'"),
    });
  });

  it('give a meta policy without frame-ancestors', () => {
    const meta = metaPolicy(config);
    expect(meta).not.toContain('frame-ancestors');
    expect(meta).toContain("connect-src 'none'");
    expect(meta).toContain("require-trusted-types-for 'script'");
  });
});
