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
