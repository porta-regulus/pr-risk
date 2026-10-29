// Emits sw.js with the list of files to cache for offline use.
// The cache name holds a hash of every file, so each build gets its own cache
// and a changed file always changes sw.js (ADR-0004 T3).
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

const TEMPLATE = fileURLToPath(new URL('./sw-template.js', import.meta.url));

function listFiles(dir: string): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  return entries.flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? listFiles(full) : [full];
  });
}

export function serviceWorkerSource(files: ReadonlyMap<string, Uint8Array | string>): string {
  const names = [...files.keys()].sort();
  const hash = createHash('sha256');
  for (const name of names) {
    hash.update(name);
    hash.update('\0');
    hash.update(files.get(name) ?? '');
    hash.update('\0');
  }
  const version = hash.digest('hex').slice(0, 16);
  const precache = ['/', ...names.filter((name) => name !== '/index.html')];
  return [
    `const PR_RISK_VERSION = ${JSON.stringify(version)};`,
    `const PR_RISK_PRECACHE = ${JSON.stringify(precache)};`,
    readFileSync(TEMPLATE, 'utf8'),
  ].join('\n');
}

export function serviceWorker(): Plugin {
  let publicDir = '';
  return {
    name: 'pr-risk-service-worker',
    apply: 'build',
    enforce: 'post',
    configResolved(config) {
      publicDir = config.publicDir;
    },
    generateBundle(_options, bundle) {
      const files = new Map<string, Uint8Array | string>();
      for (const output of Object.values(bundle)) {
        if (output.fileName.endsWith('.map')) continue;
        files.set(`/${output.fileName}`, output.type === 'chunk' ? output.code : output.source);
      }
      for (const full of listFiles(publicDir)) {
        files.set(`/${relative(publicDir, full).split(sep).join('/')}`, readFileSync(full));
      }
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: serviceWorkerSource(files) });
    },
  };
}
