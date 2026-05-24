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
JWT_SECRET=your-40-char-secret-key-here
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
├── server/src/              # Hono.js API server
│   ├── routes/             # API endpoints
│   │   ├── auth.ts         # SIWE authentication
│   │   ├── chat.ts         # Inference endpoints
│   │   ├── deposit.ts      # Payment deposits
│   │   ├── models.ts       # Model listing
│   │   ├── onramp.ts       # Fiat on-ramp
│   │   └── credits/        # OMA credits & staking
│   ├── inference/          # AI provider routing
│   │   ├── router.ts       # Circuit breaker + failover
│   │   ├── venice.ts       # Venice AI integration
│   │   ├── antseed.ts      # AntSeed backup
│   │   ├── litellm.ts      # LiteLLM integration
│   │   ├── models.ts       # Model catalog
│   │   ├── tinyfish.ts      # TinyFish web search
│   │   ├── tinyfish-fetch.ts # TinyFish web fetch
│   │   └── provider-health.ts
│   ├── credits/            # Credit system
│   │   ├── balance.ts      # Balance management
│   │   ├── deposit.ts      # Deposit processing
│   │   └── oracle.ts       # Price oracle
│   ├── x402/               # Payment facilitator
│   │   ├── facilitator.ts  # x402 implementation
│   │   └── crosschain.ts   # Cross-chain deposits
│   ├── auth/               # Auth utilities
│   │   ├── siwe.ts         # SIWE implementation
│   │   ├── api-keys.ts     # API key management
│   │   └── middleware.ts   # Auth middleware
│   └── db/                 # Database
│       ├── schema.ts       # Drizzle schema
│       └── client.ts       # DB client
├── app/src/                # Next.js frontend
│   ├── app/               # Pages (App Router)
│   │   ├── page.tsx        # Landing
│   │   ├── dashboard/     # User dashboard
│   │   ├── deposit/        # Deposit page
│   │   ├── pricing/        # Pricing page
│   │   ├── models/         # Model showcase
│   │   ├── playground/     # API playground
│   │   └── docs/           # Documentation
│   └── components/         # UI components
├── contracts/             # Solidity contracts
├── deploy/coolify/        # Coolify deployment configs
└── docs/                  # Documentation
```

---

## Key Files

| File | Purpose |
|------|---------|
| `server/src/index.ts` | Main server entry point |
| `server/src/config.ts` | Environment validation |
| `server/src/routes/chat.ts` | /v1/chat/completions endpoint |
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
- Verify `JWT_SECRET` is 40+ characters
- Check `FACILITATOR_MODE` is set correctly (mock for dev)

---

*Last updated: 2026-05-22*