# Testing & Audit Strategy

## Scope
1. **Verify dev servers start** - both frontend (Next.js) and backend (Hono.js)
2. **Health check** - confirm /health endpoint responds
3. **Test suite** - 116 tests pass (server), verify no flakes
4. **Docker build** - both Dockerfiles build cleanly
5. **Frontend render** - pages compile and render without runtime errors
6. **Dual rate-limit audit** - two files (rate-limit.ts, rateLimit.ts) still exist, one should be removed
7. **Security audit** - env exposure, CORS config, auth middleware coverage
8. **Build audit** - verify production build succeeds

## Acceptance Criteria
- [ ] Server: `npm run dev` starts without crash
- [ ] App: `npm run dev` starts without crash  
- [ ] Health endpoint returns 200 (when server running)
- [ ] 116/116 tests passing (server)
- [ ] App production build succeeds
- [ ] Docker images build successfully
- [ ] No dual rate-limit file confusion
- [ ] Security headers present
- [ ] No env vars leaked in source
