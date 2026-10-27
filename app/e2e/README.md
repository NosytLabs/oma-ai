# Browser checks

Playwright runs Chromium against `http://127.0.0.1:3000`. Its configuration
builds and starts the frontend when needed and always owns a fresh server in
CI. Outside CI it can reuse a server already running at that address.

## Run

From the repository root:

```bash
# Complete browser suite:
pnpm --filter app test:e2e

# Chat behavior and responsive layout:
pnpm --filter app test:e2e chat.spec.ts chat-viewport.spec.ts

# Force a fresh build/server instead of reusing a local one:
CI=1 pnpm --filter app test:e2e chat.spec.ts chat-viewport.spec.ts
```

Install Playwright Chromium once with `pnpm --filter app exec playwright
install chromium`, or set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to an existing
compatible Chromium executable.

The managed server uses `NEXT_PUBLIC_API_URL=http://127.0.0.1:3001` and the
non-production analytics ID `NEXT_PUBLIC_GA_ID=G-OMA-E2E`. If reusing a server,
build it with the same values so no test traffic reaches the real property.

## Chat coverage and limits

`chat-fixtures.ts` intercepts chat, model, quota, authentication, and settings
requests with deterministic responses. It blocks external requests. These
specs do not require the API on port 3001 and do not call paid providers.

The chat specs cover sending/stopping, model selection, Interactive settings,
conversation migration, drafts through switching/reload, and chat layout at
phone, tablet, and desktop sizes. The wider suite also checks public
pages, account preview behavior, and unavailable-backend states.

For manual integration exploration, start the local stack with
`./scripts/dev/start-dev.sh`. Live authentication and provider checks are
separate from fixture-backed UI verification; see
[deployment verification](../../docs/deployment-health.md).

## Visual audits and output

`scripts/dev/screenshot-audit.mjs` captures public routes on desktop and mobile:

```bash
node scripts/dev/screenshot-audit.mjs
```

- Playwright reports and artifacts: `app/playwright-report/` and
  `app/test-results/` (gitignored).
- Visual audit screenshots: `/tmp/oma-audit/`.
