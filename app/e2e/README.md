# `app/e2e/`

Playwright Test Suite specs (`*.spec.ts`) and standalone Node audit
scripts (`*.mjs`) that drive a real Chromium browser against the
running dev stack (`http://localhost:3000` + `:3001`).

The `.mjs` scripts are session-bound audit/verification tools used to
lock in fixes and surface regressions. They read magic-link URLs from
the dev server stdout (when Resend is unset) and capture screenshots
to `/tmp/pw-flows/` for inspection.

## Running

```bash
# Make sure both servers are up:
cd /Users/tyson/Desktop/Code/products/oma-ai
./scripts/dev/start-dev.sh

# Then from app/:
cd app
pnpm e2e:persist       # 8 model-persistence assertions
pnpm e2e:web-search    # /v1/search end-to-end
pnpm e2e:chat-smoke    # 9-step chat smoke flow

# Or run the Playwright Test Suite:
npx playwright test
```

## Output

- Spec artifacts: `playwright-report/` and `test-results/` (gitignored)
- Audit screenshots: `/tmp/pw-flows/`
- Server log (for magic-link capture): `/tmp/oma-dev.log`