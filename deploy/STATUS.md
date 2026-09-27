# Project status

Reviewed 2026-09-25.

OMA is a TypeScript monorepo with a Next.js web application and a Hono API.
It exposes an OpenAI-compatible inference gateway, prepaid credits, USDC
settlement on Base, optional Polar card checkout, and x402 verify/settle
workflows.

## Source of truth

- GitHub `main` is the only active branch.
- Vercel production deploys the web application from `main`.
- The backend runs separately on Neon and is reached by the Next.js `/api/*`
  proxy.
- `www.oma-ai.com` is the canonical public host. The apex redirects to it.
- There is intentionally no `api.oma-ai.com` DNS dependency.

Do not pin a production commit or deployment ID in this document. Those values
change frequently; GitHub `main` and the Vercel deployment view are the
authoritative current state.

## Verification

The repository root owns the full deterministic gate:

```bash
pnpm install --frozen-lockfile
pnpm validate
```

`pnpm validate` typechecks, lints, tests, and production-builds both the app
and server. The GitHub **CI** workflow is manual-only for Actions cost control
and runs the same validation path.

Useful targeted commands:

- `pnpm validate:app`
- `pnpm validate:server`
- `./scripts/dev/local-db-up.sh`
- `./scripts/dev/start-dev.sh`
- `./scripts/ops/check-launch-env.sh`

A green web deployment does not prove an upstream model is healthy. Verify
inference separately with the model catalog/status surface or a real
`/api/v1/chat/completions` request when validating a release.

## Deployment contract

### Web

Vercel serves the Next.js application and the public `/api/*` handlers.
App Router handlers under `app/api/**` proxy same-origin `/api/*` traffic to
the Neon endpoint via INTERNAL_PROXY_SECRET. They forward method, headers, body
and cookies verbatim and authenticate the Vercel-to-Neon hop; they do NOT
translate Better Auth session cookies into bearer tokens. Do not replace that
path with a blind rewrite.

### API and database

The Hono API and Postgres database are deployed on Neon. Backend-only secrets
belong with that deployment; do not duplicate inference/signing secrets into
Vercel merely to make frontend CI or previews green.

### Self-host reference

`deploy/coolify/` and the Docker compose files are retained as self-hosting
references. They are not the current production path. A hosting migration
requires an explicit environment, DNS, health-check, and rollback review.

## Product truth

- Guest website chat has a daily free allowance on the OMA-AI chat models.
- API-key traffic spends prepaid credits at the listed model rate.
- Credits do not expire while the account is active.
- x402 is verify → settle → credit balance → API spend; chat completions are
  not interrupted by a mid-request payment challenge.
- Card checkout exists only when Polar is configured.
- OMA does not persist prompt/completion content itself; the upstream inference
  provider still processes request content and its privacy/retention terms
  matter.

## Repository hygiene

Completed one-off refactor plans are removed once their tests/code have landed.
Current architectural decisions should live in the code, tests, README, or a
durable runbook rather than accumulating dated plan files.
