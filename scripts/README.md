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
node scripts/dev/screenshot-audit.mjs # full-page Playwright screenshots for visual review
```

The database helper defaults to a PostgreSQL 16 data-directory path. Set
`PGDATA` for a different initialized cluster; it does not install or initialize
PostgreSQL. See the [development setup](../README.md#development) for the
required permissions and launcher dependencies.

The Chrome helper requires `lsof` and exits if its debugging port is occupied;
stop the existing listener or choose another port before starting it. Each port
uses its own `chrome-bh-PORT` profile and log in the system temporary directory.
Existing profiles and Chromium lock files are left intact.
Set `OMA_CHROME_BIN` to an absolute executable path to select a specific browser.

The screenshot audit uses `http://localhost:3000` and writes to `oma-audit` in
the system temporary directory by default. Set `BASE_URL` (or `PORT` for a
local site) and `DIR` to override the site and output directory. Failed captures
produce a nonzero exit status.

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

CI uses the `packageManager` version in the root `package.json` and caches the
pnpm store by `pnpm-lock.yaml`. Every job still performs a frozen-lockfile
install; generated build output and `node_modules` are not cached.

Run `pnpm check:deployment https://preview.example.com` against an explicit
deployment origin to check proxied API readiness and a signed-out session.
It sends no credentials; access-protected previews require a separate check.
Missing Redis credentials cause readiness to report a degraded dependency.

## Clear generated output

Stop running development and test servers before cleaning:

```bash
pnpm clean --dry-run # list generated paths first
pnpm clean           # remove generated output, caches, logs and reports
```

Cleanup scans direct generated output, caches and logs in the root, `app`, and
`server` workspaces, along with known audit, screenshot and report directories
such as `artifacts/brand-kit`. It also removes only the `.cache`, `.vite` and
`.vite-temp` cache directories inside each workspace's `node_modules`.

Tracked content, installed packages, package stores, environment files,
Vercel project linkage, local data and `.artifacts/database-backups/` recovery
backups are preserved. Reports beside those backups are still removed. Cleanup
does not follow symlinked workspace or parent directories. The next development
server or build regenerates its output; no dependency reinstall is needed.
