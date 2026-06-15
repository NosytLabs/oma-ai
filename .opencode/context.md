# OMA-AI — Session Context (2026-06-14, 22:30 ADT, v8 active)

## Current Status

**v8 session mid-flight.** Commit 801f3f0 landed. 34 source files uncommitted from v7. Visual audit requested.

### Shipped This Session
- `801f3f0`: doc path drift (cd oma→cd app), sync-issues cleanup, gitignore cruft — 6 files
- Site walkthrough: all 37 pages verified (23×200, 14×307, zero 500/404)
- `.opencode/audit-2026-06-14v8/site-walkthrough.md` written

### Uncommitted Working Tree (116 files)
- **30+ modified source/test** from v7: security (CRIT-2 nonce, V7 C1/C2/C3 deposit, V7 H1/H2/H3 auth), x402 facilitator, inference cleanup, streaming fix, app UX (footer SHA, nav)
- **50 deleted** `.opencode/unit-tests/` + **22 deleted** `docs/archive/` (v7 cleanup)
- **Untracked**: `docs/AUDIT-SITE-PAGES-2026-06-14-v7.md`, `app/src/components/__tests__/footer.isolated.test.tsx`, `server/src/lib/__tests__/privacy.test.ts`
- **models.json.bak** removed this session

### Verification (all green, 22:28Z)
- Server: 74 files / 859 tests pass
- App: 8 files / 85 tests pass
- Typecheck + lint: all 4 gates green
- Build: exit 0 in 32s
- LSP diagnostics: all clean

### v9 Deferred (17 items, ~40h)
SEC-3 DLQ redaction (3h), SEC-5 atomic deduction (2h), Ponytail S1-S5 (-380 LOC, 4h), SYNC-39 schema migration (2h), SEC-6 IP format (1h), SEC-7 middleware race (3h), SEC-8 nonce replay (2h), SEC-9 circuit-breaker race (1h), SEC-10 SIWE message (1h), OMA token cleanup (1h), Footer SHA verify (30m), Router extraction (30m), x402 naming (1h)

## Pending Tasks
1. **Visual audit** of the site (multi-model, screenshot pages)
2. **Commit v7 uncommitted changes** in logical groups
3. **Stage remaining v7 deletes** (models.json.bak already removed)
4. **SYNC-38**: dev-secret rotation advisory (user action)
5. **SYNC-39**: text→jsonb schema migration (2h)

## Key Paths
- Git root: `/Users/tyson/Desktop/Code/OMA-AI/app/`
- Frontend: `app/app/` (Next.js 15)
- Backend: `app/server/` (Hono.js 4)
- DB: Neon + Drizzle ORM
- Dev server: port 3003 (port 3000 orphaned)

## Key Files
- `server/src/inference/router.ts` — OTel, credit preflight, streaming
- `server/src/x402/facilitator.ts` — nonce replay, HMAC receipts
- `server/src/db/schema.ts` — 3 text→jsonb debt (SYNC-39)
- `server/src/auth/{middleware,api-keys,solana}.ts` — v7 H1/H2/H3
- `server/src/routes/deposit/{usdc,status}.ts` — v7 C1/C2/C3
- `app/src/components/{footer,navbar}.tsx` — v7 UX fixes
- `contracts/OMA.sol` — clean ERC-20 + EIP-2612

## Session Notes
- Subagent M3 bug: all dispatched workers return "(No output)" — use direct execution or task tool as workaround
- Port 3000 has orphan process — use 3003 or kill 70953
