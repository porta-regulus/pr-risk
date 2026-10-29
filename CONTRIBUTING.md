# Contributing

Read [docs/HANDOFF.md](docs/HANDOFF.md) first. The requirements are in [docs/SPEC.md](docs/SPEC.md) and the decisions are in [docs/adr/](docs/adr/).

## Rules

1. Write prose (UI text, docs, commit messages) in ASD-STE100 Simplified Technical English. Do not use em dashes, semicolons or colons in prose.
2. The app makes no network request at run time. ESLint and a Playwright test check this.
3. Render user text as text, never as HTML.
4. Add a row to [DEPENDENCIES.md](DEPENDENCIES.md) before you add a dependency.
5. Do not add regulation or framework mappings per risk (SPEC.md Sec. 3.2).
6. Never invent a default frequency or loss for a risk.
7. Do not edit `docs/schema/vendor/`.

## Checks

Run these before you open a pull request. CI runs the same checks.

```bash
npm ci --ignore-scripts
```

```bash
npm run lint && npm run typecheck && npm test
```

```bash
npm run build && npx playwright install chromium && npm run test:e2e
```

```bash
npm run check:docs
```

## Sign-off

Sign off each commit with `git commit -s`. The sign-off states that you agree to the Developer Certificate of Origin 1.1 (https://developercertificate.org). Contributions are under Apache-2.0, the licence of this repository. There is no contributor licence agreement.

## Security problems

Do not open a public issue. Follow [SECURITY.md](SECURITY.md).
