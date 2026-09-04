# `app/e2e/` — Playwright-driven audit scripts

These are standalone Node scripts that drive a real Chromium browser
against the running dev stack (`http://localhost:3000` + `:3001`).
They're not Playwright Test Suite specs (those live alongside as
`*.spec.ts`); they're one-off audit / verification scripts used to
lock in fixes and surface new bugs.

## Why both `.spec.ts` and `.mjs`?

- `*.spec.ts` are the canonical Playwright Test Suite tests, run via
  `npx playwright test`. They run in CI and live with the codebase.
- `*.mjs` here are session-bound audit scripts that:
  - Sign in as a real admin via the dev-fallback magic link
  - Need the server's stdout to be tailable (the magic-link URL is
    logged to `/tmp/oma-dev.log` when Resend is unset)
  - Drive long-running userflows that benefit from a 5-min wait + a
    single Playwright session
  - Capture screenshots to `/tmp/pw-flows/uf/` for visual review

The `.mjs` files used to live in `/tmp/pw-flows/` and disappeared
on every `/tmp` cleanup. They were moved here so this doesn't
happen again.

## Running

```bash
# Make sure both servers are up:
cd /Users/tyson/Desktop/Code/products/oma-ai
./scripts/dev/start-dev.sh
# (or `pnpm dev` from the monorepo root)

# Then from app/:
cd app
pnpm e2e:persist       # 8 model-persistence assertions
pnpm e2e:userflow      # full admin sign-in + chat + mobile
pnpm e2e:web-search    # /v1/search end-to-end
pnpm e2e:web-toggle    # audit P1 fix: WEB toggle clickable during stream
pnpm e2e:full          # all 13 public pages load 200
pnpm e2e:interactive   # chat streaming end-to-end

# Or run any one directly:
node e2e/pw-persist.mjs
```

## Output

- Screenshots: `/tmp/pw-flows/uf/<name>.png`
- Findings: `/tmp/pw-flows/uf/findings.txt`
- Server log (for magic-link capture): `/tmp/oma-dev.log`
