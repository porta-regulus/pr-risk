// HTTP security headers of ADR-0004. deploy/headers.json is the single source.
// The same file feeds the preview server, the meta tag in index.html and the
// Terraform backend buckets, so the tests check what production serves.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

export type HeaderMap = Readonly<Record<string, string>>;

export interface HeaderConfig {
  readonly default: HeaderMap;
  readonly paths: Readonly<Record<string, HeaderMap>>;
}

export const HEADERS_FILE = fileURLToPath(new URL('../deploy/headers.json', import.meta.url));

export function loadHeaderConfig(file: string = HEADERS_FILE): HeaderConfig {
  return JSON.parse(readFileSync(file, 'utf8')) as HeaderConfig;
}

export function headersFor(config: HeaderConfig, pathname: string): HeaderMap {
  return { ...config.default, ...config.paths[pathname] };
}

// A meta tag cannot set frame-ancestors (CSP Level 3, Sec. 6.4.2), so it is removed.
export function metaPolicy(config: HeaderConfig): string {
  const csp = config.default['Content-Security-Policy'];
  if (csp === undefined) throw new Error('deploy/headers.json has no Content-Security-Policy');
  return csp
    .split(';')
    .map((directive) => directive.trim())
    .filter((directive) => directive !== '' && !directive.startsWith('frame-ancestors'))
    .join('; ');
}

export function securityHeaders(): Plugin {
  const config = loadHeaderConfig();
  return {
    name: 'pr-risk-security-headers',
    // The self-hosted bundle carries the policy in a meta tag (ADR-0004).
    // Not in dev, because the Vite dev client needs a WebSocket.
    // The tag goes right after the charset, before any script it must govern.
    transformIndexHtml: {
      order: 'pre',
      handler(html, context) {
        if (context.server) return html;
        const charset = '<meta charset="utf-8" />';
        if (!html.includes(charset)) throw new Error(`index.html must contain ${charset}`);
        const tag = `<meta http-equiv="Content-Security-Policy" content="${metaPolicy(config)}" />`;
        return html.replace(charset, `${charset}\n    ${tag}`);
      },
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;
        for (const [name, value] of Object.entries(headersFor(config, pathname))) {
          res.setHeader(name, value);
        }
        next();
      });
    },
  };
}
