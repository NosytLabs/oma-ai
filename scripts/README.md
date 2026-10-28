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
./scripts/dev/local-db-up.sh        # start an initialized local Postgres cluster
./scripts/dev/start-chrome-debug.sh # Chrome CDP for browser harness
./scripts/dev/screenshot-audit.mjs  # full-page Playwright screenshots for visual review
```

The database helper defaults to a PostgreSQL 16 data-directory path. Set
`PGDATA` for a different initialized cluster; it does not install or initialize
PostgreSQL. See the [development setup](../README.md#development) for the
required permissions and launcher dependencies.

## Root monorepo

From repo root:

```bash
pnpm run validate           # app + server: typecheck, lint, tests, production builds
pnpm run validate:hygiene   # reject tracked build outputs and transient files
pnpm run validate:app
pnpm run validate:server
pnpm run validate:typecheck
pnpm run validate:lint
pnpm run validate:test
```

## Clear generated output

Stop running development and test servers before cleaning:

```bash
pnpm clean --dry-run # list generated paths first
pnpm clean           # remove build output, tool caches, coverage and browser reports
```

Cleanup is limited to known paths in the root, `app`, and `server` workspaces.
It preserves source assets, dependencies, environment files, Vercel project
linkage, and local data. The next development server or build regenerates its
output; no dependency reinstall is needed.
