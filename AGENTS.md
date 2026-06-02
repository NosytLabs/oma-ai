# OMA AI Gateway - Operations

## Commands

### Server (oma/server)
```bash
cd oma/server
npm run dev          # Start dev server (tsx watch)
npm run build        # Build for production
npm run start        # Start production server
npm run test         # Run all tests (vitest)
npm run typecheck    # TypeScript validation
npm run lint         # ESLint validation
```

### App/Frontend (oma/app)
```bash
cd oma/app
npm run dev          # Start Next.js dev server
npm run build        # Build for production
npm run start        # Start production server
npm run typecheck    # TypeScript validation
npm run lint         # ESLint validation
```

### Docker
```bash
cd oma
docker compose build --no-cache
docker compose up -d
docker compose down
```

### Development
```bash
# From oma root
./start-dev.sh       # Start both servers

# Or manually:
cd app && npm run dev &
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

- [ ] Server typecheck passes (`npm run typecheck` - 0 errors)
- [ ] Server lint passes (`npm run lint` - 0 errors)
- [ ] Server tests pass (`npm test`)
- [ ] App typecheck passes (`npm run typecheck` - 0 errors)
- [ ] App lint passes (`npm run lint` - 0 errors)

---

## Directory Structure

```
oma/
├── server/src/                # Hono.js API server (Node 22, TypeScript ESM)
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
│   ├── lib/                   # Shared server utilities (9)
│   │   ├── api-errors.ts, dlq.ts, logger.ts
│   │   ├── quote-cache.ts, rate-limit-config.ts
│   │   ├── redis-client.ts, request-queue.ts
│   │   ├── router-utils.ts, settlement-retry.ts
│   │   └── validation.ts
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
│   ├── x402/                  # x402 payment facilitator (7)
│   │   ├── facilitator.ts, crosschain.ts
│   │   ├── evm-verifier.ts, solana-verifier.ts
│   │   ├── settlement-cache.ts, signing.ts
│   │   └── types.ts
│   ├── types/bs58.d.ts        # Type augmentations
│   └── __tests__/             # 22 vitest test files
├── app/src/                   # Next.js 15 frontend (React 19, Tailwind 4)
│   ├── app/                   # App Router pages
│   │   ├── page.tsx           # Landing
│   │   ├── dashboard/         # User dashboard
│   │   ├── deposit/           # Deposit page
│   │   ├── pricing/           # Pricing page
│   │   ├── models/            # Model showcase
│   │   ├── playground/        # API playground
│   │   └── docs/              # Documentation
│   ├── components/            # UI components
│   ├── hooks/                 # React hooks
│   ├── lib/                   # Frontend utilities
│   └── test/                  # Frontend tests
├── packages/shared/           # Shared TS package
├── contracts/                 # Solidity (OMA.sol)
├── deploy/coolify/            # Self-hosted deploy configs
├── docs/                      # Audit reports, runbooks, architecture
└── scripts/                   # start-dev.sh, deploy.sh
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
cd oma/server
npm test
```

### Test specific file
```bash
cd oma/server
npx vitest run src/__tests__/api.test.ts
```

### Test with coverage
```bash
cd oma/server
npx vitest run --coverage
```

---

## Database

### Generate migrations
```bash
cd oma/server
npm run db:generate
```

### Push schema to DB
```bash
cd oma/server
npm run db:push
```

### Run migrations
```bash
cd oma/server
npm run db:migrate
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
- Check `REDIS_URL` in `.env`
- Ensure Redis is running locally or Upstash credentials are correct

### TypeScript errors
- Run `npm run typecheck` in both `server/` and `app/`
- Fix any type errors before committing

### Auth not working
- Verify `JWT_SECRET` is 32+ characters (40+ required for production)
- Check `FACILITATOR_MODE` is set correctly (mock for dev)

### Two `.vercel/project.json` files (root + app)
This is intentional. The monorepo has two Vercel projects:
- Root `.vercel/project.json` → `oma` (API server, legacy Vercel deploy)
- `app/.vercel/project.json` → `app` (Next.js frontend, current Vercel deploy)

Both are gitignored (line in `.gitignore`). The Vercel CLI writes these on every `vercel`/`vercel link` invocation. Do not delete them.

---

*Last updated: 2026-06-03*