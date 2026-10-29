import { expect, test } from '@playwright/test';
import { headersFor, loadHeaderConfig } from '../build/security-headers';

// HANDOFF.md task 1 step 5. Read every header of ADR-0004 on every kind of file.
const config = loadHeaderConfig();

test('every file has the headers of ADR-0004', async ({ request }) => {
  const index = await request.get('/');
  expect(index.ok()).toBe(true);
  const scripts = [...(await index.text()).matchAll(/src="(\/assets\/[^"]+\.js)"/g)].map((match) => match[1] ?? '');
  expect(scripts.length).toBeGreaterThan(0);

  for (const path of ['/', '/index.html', '/sw.js', '/manifest.webmanifest', '/icon.svg', ...scripts]) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
    const actual = response.headers();
    for (const [name, value] of Object.entries(headersFor(config, path))) {
      expect(actual[name.toLowerCase()], `${path} ${name}`).toBe(value);
    }
  }
});

test('the bundle carries the policy in a meta tag for self-hosting', async ({ request }) => {
  const html = await (await request.get('/')).text();
  expect(html).toMatch(/<meta http-equiv="Content-Security-Policy" content="default-src 'none';[^"]*connect-src 'none'/);
  expect(html).not.toMatch(/<meta http-equiv="Content-Security-Policy" content="[^"]*frame-ancestors/);
});
