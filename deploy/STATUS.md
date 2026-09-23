# Project status

Last audit: 2026-09-23.

OMA-AI is a TypeScript monorepo (Next.js app + Hono API) with USDC deposits,
optional Polar card checkout, and x402 verify/settle → credit balance → API spend.

## Current production state

- **Web frontend:** `https://oma-ai.com` / `https://www.oma-ai.com` resolves and serves the OMA Next.js application.
- **Vercel project:** `oma` has a READY production deployment from GitHub `main`, currently at commit `e30f6086141b1598f0400c48ecc9eb9323d037e3`.
- **Verified source:** the newer `main` application state passed frozen install, full validation, app build, and server build in GitHub Actions run `35870621887` after fixing one unused test import.
- **Deployment gap:** GitHub does not currently have a `VERCEL_TOKEN` secret, so the verified newer source could not be explicitly redeployed from Actions. Do not add or expose a token merely to make CI green.
- **API DNS:** `api.oma-ai.com` did not resolve in the September 23 external check. Treat the API as unavailable on that public hostname until DNS and the intended backend target are verified.

The public frontend can therefore be healthy while the API hostname is unavailable. A green frontend request is not proof of end-to-end inference availability.

## Local verify

- `./scripts/dev/local-db-up.sh`
- `./scripts/dev/start-dev.sh`
- `pnpm validate`
- `./scripts/ops/check-launch-env.sh` (against `.env.prod`)

## Earn path

1. Guest website chat (free OMA-AI models, daily cap)
2. Magic link / SIWE wallet login
3. USDC deposit on Base (when `USDC_DEPOSIT_ADDRESS` is set)
4. x402 `/x402/verify` + authenticated `/x402/settle` → credits `credit_balances`
5. API keys spend credits on `/v1/chat/completions` (conditional deduct; no silent floor-to-zero)

## Deployment paths

- **Current verified web host:** Vercel project `oma`.
- **Backend:** verify the intended production target and restore `api.oma-ai.com` DNS before claiming the API is live.
- **Coolify:** optional self-hosting path documented in `deploy/coolify/README.md`; it is not the verified current frontend host.
- **Neon Function:** the repository also contains `server/neon.ts` for the backend deployment path documented in the root README.

Do not point working frontend DNS at a new host as a cleanup step. Hosting changes require verifying environment variables, domains, health endpoints, and rollback paths first.

## Product truth

- Credits never expire while the account is active.
- x402 is verify → settle → credit → spend with API key (not a mid-request 402 on chat).
- Card checkout is Setup required until Polar is configured.
