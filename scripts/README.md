# Scripts

Local development and browser audit helpers. Production release procedures live
in [Deployment](../docs/DEPLOYMENT.md); account and API test tools live in
[Account tooling](../server/scripts/README.md).

## Layout

| Directory | Purpose |
|-----------|---------|
| `dev/` | Day-to-day local development |

## Dev

```bash
./scripts/dev/start-dev.sh          # app + server
./scripts/dev/local-db-up.sh        # local Postgres 16
./scripts/dev/start-chrome-debug.sh # Chrome CDP for browser harness
./scripts/dev/screenshot-audit.mjs  # full-page Playwright screenshots for visual review
```

## Root monorepo

From repo root:

```bash
pnpm run validate           # app + server: typecheck, lint, tests, production builds
pnpm run validate:app
pnpm run validate:server
pnpm run validate:typecheck
pnpm run validate:lint
pnpm run validate:test
```
