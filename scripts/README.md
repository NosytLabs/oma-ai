# Scripts

Tooling for local development, operations, and page audits.

## Layout

| Directory | Purpose |
|-----------|---------|
| `dev/` | Day-to-day local development |
| `ops/` | Deploy, bootstrap, wallets, cost checks, seed smoke |
| `audit/` | Accessibility / visual / UX capture (writes under gitignored dirs) |

A thin shim `scripts/start-dev.sh` still works for older docs and muscle memory.

## Dev

```bash
./scripts/dev/start-dev.sh          # app + server
./scripts/dev/local-db-up.sh        # Postgres 16 + Redis
./scripts/dev/start-chrome-debug.sh # Chrome CDP for browser harness
```

## Ops

```bash
./scripts/ops/validate-launch.sh              # pre-launch env / config checks
./scripts/ops/deploy.sh                       # VPS deploy helper
node --env-file=.env scripts/ops/blockchain-bootstrap.mjs
node scripts/ops/generate-platform-wallet.mjs # one-shot keypair (prints only)
./scripts/ops/neon-cost-check.sh [project_id]
node scripts/ops/e2e-seed-user.mjs            # seed-session dashboard smoke
```

## Audit

Requires a running frontend (usually `http://127.0.0.1:3000`) and Playwright from the `app` workspace.

```bash
node scripts/audit/axe-audit.mjs       # axe-core a11y pass
node scripts/audit/visual-audit.mjs    # screenshots + overflow/metrics → .visual-audit/
node scripts/audit/ux-audit-pages.mjs  # authenticated UX captures → $TMPDIR/oma-ux-audit/
```

Screenshot dumps (`.visual-audit/`, `app/public/screenshots-ux/`, etc.) are gitignored.
Set `VISUAL_AUDIT_OUT=/path` to redirect `visual-audit.mjs` output.

## App-local scripts

Frontend-only generators live under `app/scripts/`:

- `generate-changelog.mjs` — runs on `predev` / `prebuild`
- `generate-brand-assets.mjs` — raster exports from SVG (`npm run brand:generate` in `app/`)

## Root monorepo

From repo root:

```bash
npm run validate           # app + server: typecheck, lint, tests
npm run validate:app
npm run validate:server
```
