# `app/e2e/`

Playwright specs (`*.spec.ts`) that drive real Chromium against the frontend
at `http://localhost:3000`. Playwright builds and starts the frontend when
needed, and always owns a fresh server in CI. It can reuse a running local
dev server outside CI. The automatic test server points at a local backend
on port 3001; the UI suite also exercises unavailable-backend behavior.

Visual audits live in `scripts/dev/screenshot-audit.mjs` (19 routes,
desktop + mobile) and capture to `/tmp/oma-audit/`. When Resend is
unset, magic-link URLs are logged by the dev server for session-bound
verification flows.

## Running

```bash
# From app/ (starts the frontend automatically):
cd app
pnpm test:e2e

# Optional: start the local backend/dev stack first for manual integration
# exploration. Never point automated payment/sign-in tests at live accounts.
# ./scripts/dev/start-dev.sh

# Visual audit (all public routes, desktop + mobile):
node ../scripts/dev/screenshot-audit.mjs
```

## Output

- Spec artifacts: `playwright-report/` and `test-results/` (gitignored)
- Audit screenshots: `/tmp/oma-audit/`
