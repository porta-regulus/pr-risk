import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { headersFor, loadHeaderConfig } from '../build/security-headers';
import { expectAccessible } from './axe';

const DIST = fileURLToPath(new URL('../dist', import.meta.url));
const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string };
const NEXT = '9.9.9';
const TYPES: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
};

// Serves dist/ with the headers of deploy/headers.json, as vite preview does. After next() it
// serves the same build as version 9.9.9 with a new sw.js, as a new deploy would.
async function startServer() {
  const config = loadHeaderConfig();
  let deployed = false;
  const server = createServer((req, res) => {
    const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;
    const file = normalize(join(DIST, pathname === '/' ? 'index.html' : pathname));
    let body: Buffer | string;
    try {
      if (!file.startsWith(DIST + sep)) throw new Error('outside dist');
      // One read with no check before it, so the file cannot change between a check and the read.
      // Bytes, not text, so a font file arrives as it is in dist/.
      body = readFileSync(file);
    } catch {
      res.writeHead(404).end();
      return;
    }
    if (deployed && file.endsWith('.js')) {
      body = body.toString('utf8').split(version).join(NEXT).replace(/^const PR_RISK_VERSION = "/m, 'const PR_RISK_VERSION = "next-');
    }
    res.writeHead(200, { ...headersFor(config, pathname), 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(body);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    origin: `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`,
    next: () => {
      deployed = true;
    },
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => {
          resolve();
        });
      }),
  };
}

// ADR-0004 T3 and CRA Annex I Part I point 2(c), gap F5. A real service worker update under the
// production CSP. The browser's own update check finds the new version. The open app says that it
// is ready and keeps the old version. The next start runs the new version and says so.
test('a new deploy shows a ready notice, then activates on the next start with its own notice', async ({ context }) => {
  test.skip(process.env.BASE_URL !== undefined, 'Needs a local server that can change the build.');
  const server = await startServer();
  const problems: string[] = [];
  context.on('weberror', (error) => problems.push(error.error().message));
  context.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') problems.push(message.text());
  });
  try {
    const first = await context.newPage();
    await first.goto(`${server.origin}/`);
    await expect.poll(() => first.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
    await expect(first.locator('.notice')).toHaveCount(0);

    // A new deploy. The next load of the page lets the browser find the new sw.js.
    server.next();
    await first.reload();
    const ready = first.getByRole('status').filter({ hasText: 'A new version of the app is ready.' });
    // The browser installs the new worker after the load. A slow runner can need some seconds.
    await expect(ready).toBeVisible({ timeout: 15_000 });
    await expect(first.getByText(`Version ${version}, build`)).toBeVisible();
    await expectAccessible(first, 'S1 with the notice that a new version is ready');
    await ready.getByRole('button', { name: 'Close notice', exact: true }).click();
    await expect(ready).toHaveCount(0);

    // Close all tabs of the app and open it again. The new version is active.
    // The waiting worker activates when no tab uses the old one. The browser can need a moment
    // after the close, and a tab that opens before then still gets the old version, so try again.
    await first.close();
    let second = await context.newPage();
    await expect(async () => {
      if (second.url() !== 'about:blank') {
        await second.close();
        second = await context.newPage();
      }
      await second.goto(`${server.origin}/`);
      await expect(second.getByText(`Version ${NEXT}, build`)).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: 15_000 });
    await expect(second.getByRole('status').filter({ hasText: `Version ${NEXT} is now active.` })).toBeVisible();
    await expect(second.getByRole('status').filter({ hasText: 'A new version of the app is ready.' })).toHaveCount(0);
    expect(problems, 'errors, warnings and CSP violations').toEqual([]);
  } finally {
    await server.close();
  }
});

// ADR-0004 T3. "Use the new version now" on S1 activates the waiting version without a close of
// the tab, but only when no other tab of the app is open.
test('"Use the new version now" activates the new version in the open tab, and refuses with a second tab', async ({ context }) => {
  test.skip(process.env.BASE_URL !== undefined, 'Needs a local server that can change the build.');
  const server = await startServer();
  const problems: string[] = [];
  context.on('weberror', (error) => problems.push(error.error().message));
  context.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') problems.push(message.text());
  });
  try {
    const page = await context.newPage();
    await page.goto(`${server.origin}/`);
    await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
    server.next();
    await page.reload();
    const ready = page.getByRole('status').filter({ hasText: 'A new version of the app is ready.' });
    await expect(ready).toBeVisible({ timeout: 15_000 });

    // A second tab of the app blocks the change, so its code is never replaced.
    const other = await context.newPage();
    await other.goto(`${server.origin}/`);
    await ready.getByRole('button', { name: 'Use the new version now', exact: true }).click();
    await expect(ready).toContainText('Another tab of the app is open.');
    await expect(page.getByText(`Version ${version}, build`)).toBeVisible();

    // With one tab, the new version takes over and the page reloads once.
    await other.close();
    await expect(async () => {
      await ready.getByRole('button', { name: 'Use the new version now', exact: true }).click();
      await expect(page.getByText(`Version ${NEXT}, build`)).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 15_000 });
    await expect(page.getByRole('status').filter({ hasText: `Version ${NEXT} is now active.` })).toBeVisible();
    await expectAccessible(page, 'S1 after the new version took over');
    expect(problems, 'errors, warnings and CSP violations').toEqual([]);
  } finally {
    await server.close();
  }
});
