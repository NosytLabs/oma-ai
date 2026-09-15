# Project status

Last audit: 2026-09-15 (UI/UX + content cleanup complete; Coolify DNS still pending).

OMA-AI is a TypeScript monorepo (Next.js app + Hono API) with USDC deposits,
optional Polar card checkout, and x402 verify/settle → credit balance → API spend.

## Local verify
- `./scripts/dev/local-db-up.sh`
- `./scripts/dev/start-dev.sh`
- `pnpm validate`
- `./scripts/ops/check-launch-env.sh` (against `.env.prod`)

## Earn path
1. Guest website chat (free OMA-AI models, daily cap)
2. Magic link / SIWE wallet login
3. USDC deposit on Base (when `USDC_DEPOSIT_ADDRESS` set)
4. x402 `/x402/verify` + authenticated `/x402/settle` → credits `credit_balances`
5. API keys spend credits on `/v1/chat/completions` (conditional deduct; no silent floor-to-zero)

## Coolify launch (chosen host)
See `deploy/coolify/README.md`.

Ops still required on your side:
1. Add Spaceship A records for `@`, `www`, `api` → Coolify VPS IP
2. Fill Coolify env (no placeholders): secrets, treasury, facilitator live key, Venice key
3. Deploy compose; confirm `https://api.oma-ai.com/health`
4. Optional: Polar for card earn path
5. Smoke: login → deposit $1 USDC → API call → balance drops

## Product truth
- Credits never expire while the account is active
- x402 is verify → settle → credit → spend with API key (not mid-request 402 on chat)
