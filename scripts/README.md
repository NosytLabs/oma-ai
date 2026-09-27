# Scripts

Tooling for local development and operations.

## Layout

| Directory | Purpose |
|-----------|---------|
| `dev/` | Day-to-day local development |
| `ops/` | Production environment helper scripts |

## Dev

```bash
./scripts/dev/start-dev.sh          # app + server
./scripts/dev/local-db-up.sh        # Postgres 16 + Redis
./scripts/dev/start-chrome-debug.sh # Chrome CDP for browser harness
./scripts/dev/screenshot-audit.mjs  # full-page Playwright screenshots for visual review
```

## Ops

```bash
./scripts/ops/start-prod.sh                   # docker compose prod up (or down|logs)
./scripts/ops/check-launch-env.sh             # preflight: verify required prod env vars are set
```

## Root monorepo

From repo root:

```bash
pnpm run validate           # app + server: typecheck, lint, tests
pnpm run validate:app
pnpm run validate:server
pnpm run validate:typecheck
pnpm run validate:lint
pnpm run validate:test
```
