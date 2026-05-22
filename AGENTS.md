# OMA AI Gateway - Operations

## Commands
### Server (oma/server)
- Dev: `npm run dev`
- Build: `npm run build`
- Test: `npm test`
- Typecheck: `npm run typecheck`
- Lint: `npm run lint`

### App/Frontend (oma/app)
- Dev: `npm run dev`
- Build: `npm run build`
- Lint: `npm run lint`
- Typecheck: `npx tsc --noEmit`

### Docker
- Build all: `docker compose build --no-cache`
- Start: `docker compose up -d`
- Stop: `docker compose down`

## Validation Gates
- Tests must pass before committing
- Typecheck must pass (0 errors)
- Lint must pass (0 errors)

## Env Setup
Copy `server/.env.example` to `server/.env` (server) and `app/.env.example` to `app/.env.local` (app).
Key variables:
- DATABASE_URL (Neon Postgres or local)
- REDIS_URL (Upstash Redis or local)
- VENICE_API_KEY
- JWT_SECRET (40+ chars)
- FACILITATOR_MODE=mock (for dev)

## Testing Strategy

### Scope
1. Verify dev servers start - both frontend (Next.js) and backend (Hono.js)
2. Health check - confirm /health endpoint responds
3. Test suite - 116 tests pass (server), verify no flakes
4. Docker build - both Dockerfiles build cleanly
5. Frontend render - pages compile and render without runtime errors
6. Rate-limit file audit - rate-limit.ts is the single authoritative file
7. Security audit - env exposure, CORS config, auth middleware coverage
8. Build audit - verify production build succeeds

### Acceptance Criteria
- [ ] Server: `npm run dev` starts without crash
- [ ] App: `npm run dev` starts without crash
- [ ] Health endpoint returns 200 (when server running)
- [ ] 116/116 tests passing (server)
- [ ] App production build succeeds
- [ ] Docker images build successfully
- [ ] No dual rate-limit file confusion
- [ ] Security headers present
- [ ] No env vars leaked in source
