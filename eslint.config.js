import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// ADR-0004 E1. User text is rendered as text, never as HTML. No eval.
const noHtmlOrEval = {
  'no-eval': 'error',
  'no-new-func': 'error',
  'no-script-url': 'error',
  'no-restricted-properties': [
    'error',
    { property: 'innerHTML', message: 'Render text, not HTML (ADR-0004 E1).' },
    { property: 'outerHTML', message: 'Render text, not HTML (ADR-0004 E1).' },
    { property: 'insertAdjacentHTML', message: 'Render text, not HTML (ADR-0004 E1).' },
    { object: 'document', property: 'write', message: 'Render text, not HTML (ADR-0004 E1).' },
    { object: 'document', property: 'writeln', message: 'Render text, not HTML (ADR-0004 E1).' },
    { object: 'navigator', property: 'sendBeacon', message: 'The app makes no network requests (ADR-0004).' },
  ],
  'no-restricted-syntax': [
    'error',
    {
      selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
      message: 'Render text, not HTML (ADR-0004 E1).',
    },
  ],
};

// HANDOFF.md rule 6. The app makes no network requests at run time.
const noNetwork = {
  'no-restricted-globals': [
    'error',
    ...['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'WebTransport'].map((name) => ({
      name,
      message: 'The app makes no network requests (ADR-0004).',
    })),
  ],
};

export default defineConfig(
  {
    ignores: ['src/schema/generated/', 'dist/', 'coverage/', 'playwright-report/', 'test-results/', 'docs/', 'infra/', '.venv/'],
  },
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      ...noHtmlOrEval,
      '@typescript-eslint/no-implied-eval': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { ignoreRestSiblings: true }],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    rules: noNetwork,
  },
  {
    files: ['build/**/*.ts', 'test/**/*.ts', 'e2e/**/*.ts', '*.config.ts'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['build/sw-template.js'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: {
      sourceType: 'script',
      globals: { ...globals.serviceworker, PR_RISK_VERSION: 'readonly', PR_RISK_PRECACHE: 'readonly' },
    },
  },
  {
    files: ['eslint.config.js', 'scripts/**/*.mjs'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: globals.node },
  },
);
