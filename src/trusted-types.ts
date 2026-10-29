// The one Trusted Types policy that the CSP allows ("trusted-types app-text").
// Script URLs go through an allow-list: the service worker, the hashed worker
// chunks of this build and, in development only, the Vite source paths.

interface ScriptUrlPolicy {
  createScriptURL(input: string): unknown;
}

interface TrustedTypesFactory {
  createPolicy(name: string, rules: { createScriptURL: (input: string) => string }): ScriptUrlPolicy;
}

const SCRIPT_URLS: ReadonlySet<string> = new Set(['/sw.js']);
const BUILD_CHUNK = /^\/assets\/[A-Za-z0-9_-]+\.js$/;

export function checkScriptUrl(input: string): string {
  if (SCRIPT_URLS.has(input) || BUILD_CHUNK.test(input)) return input;
  if (import.meta.env.DEV && input.startsWith('/src/')) return input;
  throw new TypeError(`Script URL not allowed: ${input}`);
}

let policy: ScriptUrlPolicy | undefined;

// Returns a TrustedScriptURL where the browser supports Trusted Types, else the
// checked string. Both are valid arguments for register() and new Worker().
export function scriptUrl(path: string): string {
  const factory = (globalThis as { trustedTypes?: TrustedTypesFactory }).trustedTypes;
  if (factory === undefined) return checkScriptUrl(path);
  policy ??= factory.createPolicy('app-text', { createScriptURL: checkScriptUrl });
  return policy.createScriptURL(path) as string;
}
