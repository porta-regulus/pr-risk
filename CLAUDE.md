# CLAUDE.md

Free, open-source, local-first risk app by PortaRegulus (working name PortaRegulus Risk, code name `pr-risk`). Separate from CVD Portal.

Start with [docs/HANDOFF.md](docs/HANDOFF.md). It lists the first 5 build tasks and their done criteria. The full requirements are in [docs/SPEC.md](docs/SPEC.md). Decisions are in [docs/adr/](docs/adr/). Do not reopen an ADR without the product owner.

## Commands

```bash
npm ci --ignore-scripts
```

```bash
npm run lint && npm run typecheck && npm test
```

```bash
npm run build && npm run test:e2e
```

```bash
npm run test:browser
```

```bash
npm run test:performance
```

After a change to `docs/schema/`, run `npm run gen:schema` and commit `src/schema/generated/`. CI fails when the generated files or `test/fixtures/python-parity.json` are out of date.

Hosting is static files on GCP (ADR-0006). See `infra/gcp/README.md`. Security headers live in `deploy/headers.json` and must stay equal to ADR-0004.

## Python checks for docs/

```bash
python3 -m venv .venv && .venv/bin/pip install jsonschema referencing numpy
```

```bash
.venv/bin/python -I docs/schema/validate.py
```

```bash
.venv/bin/python -I docs/reference/sim_reference.py docs/schema/examples/example-2-sme-quantitative.json --budget=60000
```

## Hard rules

1. No network request at run time, no telemetry, no sign-up, no paid feature, no server database (ADR-0003, ADR-0004, ADR-0006).
2. Never invent default frequencies or losses for a risk.
3. Matrices are display only. Ranking and funding use the simulation.
4. Files in `docs/schema/vendor/` are NIST originals pinned by SHA-256. Do not edit them.
5. Write prose in ASD-STE100 Simplified Technical English. No em dashes, semicolons or colons in prose.
