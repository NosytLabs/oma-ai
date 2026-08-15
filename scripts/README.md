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
```

## Ops

```bash
./scripts/ops/start-prod.sh                   # docker compose prod up (or down|logs)
```

## Root monorepo

From repo root:

```bash
npm run validate           # app + server: typecheck, lint, tests
npm run validate:app
npm run validate:server
```
