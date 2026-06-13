# OMA AI Gateway - Operations

## Commands

### Server (Hono.js)
```bash
cd server
npm run dev          # Start dev server (tsx watch)
npm run build        # Build for production
npm run start        # Start production server
npm run test         # Run all tests (vitest)
npm run typecheck    # TypeScript validation
npm run lint         # ESLint validation
```

### App/Frontend (Next.js)
```bash
cd app
npm run dev          # Start Next.js dev server
npm run build        # Build for production
npm run start        # Start production server
npm run typecheck    # TypeScript validation
npm run lint         # ESLint validation
npm run test         # Run frontend tests (vitest)
```

### Docker
```bash
docker compose build --no-cache
docker compose up -d
docker compose down
```

### Development
```bash
# From repo root
./scripts/start-dev.sh   # Start both servers (if present)

# Or manually (in separate terminals):
cd app && npm run dev
cd server && npm run dev
```

---

## Environment Setup

### Server (.env)
```env
# Required
DATABASE_URL=postgresql://user:pass@host/database
JWT_SECRET=dev-secret-change-me-in-prod-32ch  # 32 chars OK for dev; 40+ required for prod
ENCRYPTION_KEY=<32-byte AES key, base64 or hex> # AES-256-GCM at-rest (TOTP 2FA)
VENICE_API_KEY=sk-...

# Optional
REDIS_URL=redis://localhost:6379
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000
FACILITATOR_MODE=mock
TINYFISH_API_KEY=sk-tinyfish-...  # Web search MCP
```

### App (.env.local)
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Validation Gates

Before any commit, ensure:

- [ ] Server typecheck passes (`cd server && npm run typecheck` - 0 errors)
- [ ] Server lint passes (`cd server && npm run lint` - 0 errors)
- [ ] Server tests pass (`cd server && npm test`)
- [ ] App typecheck passes (`cd app && npm run typecheck` - 0 errors)
- [ ] App lint passes (`cd app && npm run lint` - 0 errors)
- [ ] App tests pass (`cd app && npm run test`)

---

## Directory Structure

This is a **flat monorepo** (no `oma/` wrapper, no workspaces). All top-level paths are real and live at the repo root.

```
.
├── server/src/                # Hono.js API server (Node 20, TypeScript ESM)
│   ├── index.ts               # Entry point (port 3001, /health, WebSocket)
│   ├── config.ts              # Environment validation
│   ├── constants.ts, tracing.ts, types.ts
│   ├── auth/                  # SIWE + Solana + API key auth
│   │   ├── api-keys.ts, encryption.ts, middleware.ts
│   │   └── siwe.ts, solana.ts
│   ├── credits/               # Credit engine (15 modules)
│   │   ├── add-credits.ts, balance.ts, budget-alerts.ts
│   │   ├── cctp-client.ts, deduction.ts, deposit.ts
│   │   ├── deposit-router.ts, houdini-client.ts
│   │   ├── index.ts, lifi-client.ts, oracle.ts
│   │   ├── preflight.ts, price-guard.ts, refunds.ts
│   │   └── staking.ts
│   ├── db/                    # Drizzle ORM + Postgres
│   │   ├── client.ts, schema.ts
│   ├── inference/             # Multi-provider AI routing (24 modules)
│   │   ├── router.ts          # Circuit breaker + failover
│   │   ├── venice.ts, antseed.ts, litellm.ts
│   │   ├── openrouter.ts, together.ts, deepinfra.ts
│   │   ├── tinyfish.ts, tinyfish-fetch.ts
│   │   ├── models.ts          # Model catalog
│   │   ├── provider-factory.ts, provider-selector.ts
│   │   ├── provider-health.ts, provider-result.ts
│   │   ├── call-provider.ts, stream-tracker.ts
│   │   ├── credit-preflight.ts, billing-service.ts
│   │   ├── usage-service.ts, cheaptokens.ts, surplus.ts
│   │   ├── base.ts, circuit-breaker.ts, types.ts
│   ├── jobs/                  # Background cron jobs (6)
│   │   ├── credit-expiry.ts, subscription-cron.ts
│   │   ├── deposit-notifications.ts, deposit-recovery.ts
│   │   ├── deposit-retry.ts, nonce-cleanup.ts
│   ├── lib/                   # Shared server utilities (10)
│   │   ├── api-errors.ts, dlq.ts, logger.ts
│   │   ├── quote-cache.ts, rate-limit-config.ts
│   │   ├── redis-client.ts, request-queue.ts
│   │   ├── router-utils.ts, settlement-retry.ts
│   │   ├── url-safety.ts, validation.ts
│   ├── middleware/            # Request middleware (8)
│   │   ├── audit.ts, cache.ts, idempotency.ts
│   │   ├── rate-limit.ts, rbac.ts, security.ts
│   │   └── spend-limit.ts, timeout.ts
│   ├── routes/                # API endpoints
│   │   ├── auth.ts, config.ts, credits.ts
│   │   ├── models.ts, onramp.ts, refunds.ts, search.ts
│   │   ├── analytics.ts, analytics-admin.ts
│   │   ├── export.ts, fetch.ts, invoices.ts
│   │   ├── jupiter.ts, queue.ts, sso.ts
│   │   ├── subscriptions.ts, teams.ts, withdraw.ts
│   │   ├── admin/             # Admin endpoints (subdir)
│   │   ├── chat/              # OpenAI-compatible chat (modality-split)
│   │   ├── chat-ws/           # WebSocket streaming
│   │   └── deposit/           # Multi-protocol deposit (usdc, status, lifi, houdini, cctp, balance, router)
│   ├── x402/                  # x402 payment facilitator (3)
│   │   ├── facilitator.ts     # EVM settlement, 501 stub for /v1/x402/proxy
│   │   ├── crosschain.ts      # /v1/x402/quote + /v1/x402/deposit
│   │   └── types.ts           # PaymentPayload, PaymentSignature
│   ├── types/bs58.d.ts        # Type augmentations
│   └── __tests__/             # 22 vitest test files
├── app/src/                   # Next.js 15 frontend (React 19, Tailwind 4)
│   ├── app/                   # App Router pages
│   │   ├── page.tsx           # Landing
│   │   ├── dashboard/         # User dashboard (keys, credits, etc.)
│   │   ├── deposit/           # Deposit page
│   │   ├── pricing/           # Pricing page
│   │   ├── models/            # Model showcase
│   │   ├── playground/        # API playground
│   │   ├── docs/              # Documentation
│   │   ├── admin/             # Admin surface
│   │   ├── about/, compare/, faq/, privacy/, terms/
│   │   └── image-generation/  # Image gen route
│   ├── components/            # UI components
│   ├── hooks/                 # React hooks
│   ├── lib/                   # Frontend utilities (api/, auth/, etc.)
│   └── test/                  # Frontend tests
├── contracts/                 # Solidity (OMA.sol)
├── deploy/coolify/            # Self-hosted deploy configs
├── docs/                      # Audit reports, runbooks, architecture
├── scripts/                   # start-dev.sh, deploy.sh
├── .opencode/                 # Commander orchestration state
├── .vercel/                   # Root Vercel project (legacy, gitignored)
├── app/.vercel/               # App Vercel project (current, gitignored)
└── docker-compose.yml
```

---

## Key Files

| File | Purpose |
|------|---------|
| `server/src/index.ts` | Main server entry point |
| `server/src/config.ts` | Environment validation |
| `server/src/routes/chat/index.ts` | /v1/chat/completions endpoint (split by modality) |
| `server/src/inference/router.ts` | AI routing with failover |
| `server/src/middleware/rate-limit.ts` | Rate limiting |
| `app/src/app/page.tsx` | Landing page |
| `app/src/components/navbar.tsx` | Navigation |

---

## Testing

### Run all server tests
```bash
cd server
npm test
```

### Test specific file
```bash
cd server
npx vitest run src/__tests__/api.test.ts
```

### Test with coverage
```bash
cd server
npx vitest run --coverage
```

### Frontend tests
```bash
cd app
npm test
```

---

## Database

```bash
cd server
npm run db:generate   # Generate migrations
npm run db:push        # Push schema to DB
npm run db:migrate     # Run migrations
```

---

## Health Check

```bash
# Server health
curl http://localhost:3001/health

# Expected response:
{"status":"ok","version":"2.0.0","service":"oma-ai"}
```

---

## Common Issues

### Redis not connecting
- Check `REDIS_URL` in `server/.env`
- Ensure Redis is running locally or Upstash credentials are correct

### TypeScript errors
- Run `cd server && npm run typecheck` and `cd app && npm run typecheck`
- Fix any type errors before committing

### Auth not working
- Verify `JWT_SECRET` is 32+ characters (40+ required for production)
- Check `FACILITATOR_MODE` is set correctly (mock for dev)

### Two `.vercel/project.json` files (root + app)
This is intentional. The monorepo has two Vercel projects:
- Root `.vercel/project.json` → `oma` (API server, legacy Vercel deploy)
- `app/.vercel/project.json` → `app` (Next.js frontend, current Vercel deploy)

Both are gitignored (line in `.gitignore`). The Vercel CLI writes these on every `vercel`/`vercel link` invocation. Do not delete them.

### Vitest version drift (intentional)
- `server` uses `vitest@^3.2.4` (matches Node 20 ESM toolchain)
- `app` uses `vitest@^4.1.7` (matches Next.js 15 React 19 plugin ecosystem)
- API is compatible. Do NOT unify majors unless a toolchain change forces it.

### Frontend `lib/api` is split
The old 827-line `app/src/lib/api.ts` monolith is now split into per-resource modules
under `app/src/lib/api/`. `app/src/lib/api.ts` is a thin re-export shim — all existing
`import { api, type Foo } from '@/lib/api'` call sites work unchanged. When adding
a new endpoint, add it to the relevant `api/*.ts` module and the barrel auto-exposes it.

### Server queue write-side is intentionally kept
`server/src/lib/request-queue.ts` exposes a full read+write API (`enqueueRequest`,
`peekQueue`, `removeFromQueue`, `clearQueue`, `startQueueProcessor`) but only the
read side (`getQueueStatus`, `getQueuePosition`, `getQueueStats`, `getQueueDepth`,
`processNextRequest`, `stopQueueProcessor`) is wired into routes today. The write
side is kept as a future-proofing surface for backpressure (planned for chat
gateway when a depth threshold is exceeded). It is fully tested. Do NOT delete
without first re-evaluating the backpressure design.

### `server/.env.example` is authoritative
All env vars referenced anywhere in `server/src/` are documented in
`server/.env.example` with comments. If you add a new env var to `config.ts`,
add it there too with a brief comment. Production guards in `config.ts`
`process.exit(1)` on missing required secrets; do not bypass them.

### `siwe@3` CJS-requires `ethers` (DO NOT REMOVE)
`app/package.json` must keep `ethers: ^6.13.4` even though every wallet code
path uses `viem`. `siwe@3`'s dist bundles (`utils.js:6`, `ethersCompat.js:4`)
both `require("ethers")` at module load, and webpack's barrel optimization
pulls them in via the `SiweMessage` import in `app/src/components/wallet-provider.tsx`.
Without `ethers` in `app/node_modules`, every page that touches wallet-provider
(which is most of them) returns HTTP 500. If you ever decide to remove ethers,
you must also downgrade siwe to `^2.3.x` (last v2 line, no ethers dep) — they
are coupled. Symptom if you forget: webpack build error "Module not found: Can't
resolve 'ethers'" → 500 on every public page → `/playground` (auth-walled) is
the only one that may still respond.

---

*Last updated: 2026-06-13*
