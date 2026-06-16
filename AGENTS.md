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
/Users/tyson/Desktop/Code/OMA-AI/
├── app/                  # Next.js 15 frontend (React 19, Tailwind 4)
│   ├── package.json
│   ├── src/              # App Router pages, components, hooks, lib, test
│   ├── public/           # Static assets (favicon.svg, logos/)
│   ├── docs/             # Audit reports, runbooks, architecture
│   ├── scripts/          # Frontend scripts
│   ├── AGENTS.md         # This file
│   ├── opencode.jsonc
│   └── README.md
├── server/               # Hono.js API server (Node 20, TypeScript ESM)
│   ├── package.json
│   ├── src/
│   │   ├── index.ts
│   │   ├── auth/         # SIWE + Solana + API key auth
│   │   ├── credits/      # Credit engine
│   │   ├── db/           # Drizzle ORM + Postgres
│   │   ├── inference/    # Multi-provider AI routing
│   │   ├── jobs/         # Background cron jobs
│   │   ├── lib/          # Shared server utilities
│   │   ├── middleware/   # Request middleware
│   │   ├── routes/       # API endpoints
│   │   ├── x402/         # x402 payment facilitator
│   │   └── __tests__/    # vitest tests
│   └── drizzle.config.ts
├── contracts/            # Solidity (orphan per audit, but listed)
├── deploy/coolify/       # Self-hosted deploy configs
├── docs/                 # Project-level docs (archive/ for old audit reports)
├── hooks/                # Project-level git hooks
├── scripts/              # start-dev.sh, deploy.sh
├── skills/               # Custom agent skills
├── docker-compose.yml    # Project-level orchestration
├── .gitignore
├── DEPLOY.md
├── opencode.jsonc
├── package.json          # Project-level workspace
└── README.md
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
