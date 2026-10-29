// Check that every file of the local bundle is served byte for byte by the live
// origin (ADR-0004 S1). Usage: node scripts/verify-deploy.mjs <dist dir> <base URL>
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const [dist, base] = process.argv.slice(2);
if (!dist || !base) {
  console.error('Usage: node scripts/verify-deploy.mjs <dist dir> <base URL>');
  process.exit(2);
}

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const files = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? files(full) : [full];
  });

let failures = 0;
for (const full of files(dist)) {
  const path = `/${relative(dist, full).split(sep).join('/')}`;
  const response = await fetch(new URL(path, base), { cache: 'no-store', redirect: 'error' });
  const live = Buffer.from(await response.arrayBuffer());
  const ok = response.ok && sha256(live) === sha256(readFileSync(full));
  if (!ok) failures += 1;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${response.status} ${path}`);
}

// "/" must serve index.html, not the bucket listing.
const root = await fetch(new URL('/', base), { cache: 'no-store', redirect: 'error' });
const rootBody = Buffer.from(await root.arrayBuffer());
const rootOk = root.ok && sha256(rootBody) === sha256(readFileSync(join(dist, 'index.html')));
if (!rootOk) failures += 1;
console.log(`${rootOk ? 'OK  ' : 'FAIL'} ${root.status} / serves index.html (${root.headers.get('content-type') ?? ''})`);

// The bucket must stay private. A public bucket serves the app on the shared
// storage.googleapis.com origin, without the headers (ADR-0004 decision 3).
const bucket = process.env.SITE_BUCKET;
if (bucket) {
  const direct = await fetch(`https://storage.googleapis.com/${bucket}/index.html`);
  const ok = direct.status === 401 || direct.status === 403;
  if (!ok) failures += 1;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${direct.status} direct bucket read is refused`);
}

process.exit(failures === 0 ? 0 : 1);
