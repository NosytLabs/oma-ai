# OMA AI Gateway - Quick Reference

## Quick Commands

### Start Development
```bash
cd oma/app && npm run dev    # Frontend on :3002
cd oma/server && npm run dev  # API on :3001
```

### Run All Tests
```bash
cd oma && bash test-all.sh
```

### Individual Checks
```bash
# Server
cd oma/server
npm run typecheck  # TypeScript
npm run lint       # ESLint
npm test           # Unit tests

# App  
cd oma/app
npm run typecheck # TypeScript
npm run lint       # ESLint
npm test           # Unit tests
```

### Database
```bash
cd oma/server
npm run db:generate  # Generate migrations
npm run db:push     # Push schema
npm run db:migrate  # Run migrations
```

## Ports
- Frontend: http://localhost:3002
- API: http://localhost:3001
- Health: http://localhost:3001/health

## Test Results
- Server: 103 tests passing
- App: 23 tests passing
- UI: 12/12 pages, 0 console errors
- All TypeScript: 0 errors
- All Lint: 0 errors