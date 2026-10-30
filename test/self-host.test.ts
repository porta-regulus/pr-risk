import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { headersFor, loadHeaderConfig } from '../build/security-headers';

// ADR-0004 E3 and CRA Annex I self-check gap F3. The server examples of docs/self-host.md
// give every path exactly the headers of deploy/headers.json.
const guide = readFileSync(new URL('../docs/self-host.md', import.meta.url), 'utf8');
const config = loadHeaderConfig();
const PATHS = ['/', '/index.html', '/assets/index.js', '/sw.js'];

function block(language: string): string[] {
  const text = guide.split('```' + language + '\n')[1]?.split('```')[0];
  if (text === undefined) throw new Error(`docs/self-host.md has no ${language} block`);
  return text.split('\n');
}

// nginx. The exact location "= /sw.js" wins over "location /".
function nginx(path: string): Record<string, string> {
  const headers: Record<string, string> = {};
  let location = '';
  for (const line of block('nginx')) {
    const opens = /^\s*location (= )?(\S+) \{$/.exec(line);
    if (opens !== null) location = `${opens[1] ?? ''}${opens[2] ?? ''}`;
    const header = /^\s*add_header (\S+) "([^"]*)" always;$/.exec(line);
    const applies = location === `= ${path}` || (location === '/' && path !== '/sw.js');
    if (header !== null && applies) headers[header[1] ?? ''] = header[2] ?? '';
  }
  return headers;
}

// Apache httpd. A header with an expr condition applies when the request path matches it.
function apache(path: string): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const line of block('apache')) {
    const header = /^\s*Header always set (\S+) "([^"]*)"(?: "expr=%\{REQUEST_URI\} (==|!=) '([^']*)'")?$/.exec(line);
    if (header === null) continue;
    const [, name = '', value = '', operator, target] = header;
    if (operator === undefined || (operator === '==') === (path === target)) headers[name] = value;
  }
  return headers;
}

// Caddy. "@app" is every path except /sw.js, and a bare block applies to every path.
function caddy(path: string): Record<string, string> {
  const headers: Record<string, string> = {};
  let inBlock = false;
  for (const line of block('caddy')) {
    if (/^\s*header \{$/.test(line)) inBlock = true;
    else if (inBlock && /^\s*\}$/.test(line)) inBlock = false;
    const single = /^\s*header (@app|\/sw\.js) (\S+) "([^"]*)"$/.exec(line);
    if (single !== null && (single[1] === '@app') === (path !== '/sw.js')) headers[single[2] ?? ''] = single[3] ?? '';
    const inner = inBlock ? /^\s*(\S+) "([^"]*)"$/.exec(line) : null;
    if (inner !== null) headers[inner[1] ?? ''] = inner[2] ?? '';
  }
  return headers;
}

describe('self-host guide', () => {
  for (const [server, read] of [
    ['nginx', nginx],
    ['Apache httpd', apache],
    ['Caddy', caddy],
  ] as const) {
    it(`gives the ${server} example the headers of deploy/headers.json on each path`, () => {
      for (const path of PATHS) expect(read(path), path).toEqual(headersFor(config, path));
    });
  }
});
