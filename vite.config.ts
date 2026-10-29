import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import { securityHeaders } from './build/security-headers.ts';
import { serviceWorker } from './build/service-worker.ts';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

export default defineConfig({
  plugins: [securityHeaders(), serviceWorker()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __GIT_SHA__: JSON.stringify(process.env.GITHUB_SHA ?? 'local'),
  },
  oxc: {
    jsx: { runtime: 'automatic', importSource: 'preact' },
  },
  build: {
    target: 'es2022',
    // Keep every asset a separate file. The CSP has no data: for fonts or scripts.
    assetsInlineLimit: 0,
    modulePreload: { polyfill: false },
    sourcemap: false,
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
});
