# `app/e2e/`

Playwright specs (`*.spec.ts`) that drive real Chromium against the
running dev stack (`http://localhost:3000` + `:3001`).

Visual audits live in `scripts/dev/screenshot-audit.mjs` (19 routes,
desktop + mobile) and capture to `/tmp/oma-audit/`. When Resend is
unset, magic-link URLs are logged by the dev server for session-bound
verification flows.

## Running

```bash
# Make sure both servers are up:
./scripts/dev/start-dev.sh

# Then from app/:
cd app
npx playwright test

# Visual audit (all public routes, desktop + mobile):
node ../scripts/dev/screenshot-audit.mjs
```

## Output

- Spec artifacts: `playwright-report/` and `test-results/` (gitignored)
- Audit screenshots: `/tmp/oma-audit/`