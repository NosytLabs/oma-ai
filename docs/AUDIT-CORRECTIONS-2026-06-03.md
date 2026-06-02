# OMA Audit Corrections — 2026-06-03

Delta from `docs/AUDIT-REPORT-2026-06-02.md` after direct file inspection on 2026-06-03.

## Test count correction

- **Audit claim**: "47 test files, 443 tests"
- **Actual (verified 2026-06-03)**: 43 test files, 406 tests
- Source of truth: `npm test` output from server/ and app/
- **Action**: treat server 406/406 (43 files) and app 28/28 (4 files) as authoritative going forward

## Items verified already done (stale audit claims)

| ID | Claim | Actual state | Action |
|---|---|---|---|
| MED-2 | Footer missing 4 links | All present (Models, Pricing, Docs, Playground, Dashboard, Admin, Deposit, Crypto Payments, Terms, Privacy) in `app/src/components/footer.tsx` | Mark VERIFIED |
| MED-7 | `lib/api.ts` vs `lib/api/*.ts` split exists | `app/src/lib/api/` does NOT exist; only monolith `app/src/lib/api.ts` (827 lines) | No-op — no split was made. Mark CLOSED-WONT-DO or schedule refactor |
| MED-8 | Remove `fix_pricing.py` | File does not exist in repo | No-op — already gone. Mark CLOSED |
| LOW-3 | GitHub org ownership | `.github/workflows/ci.yml` exists in oma repo; NosytLabs owns oma-ai per prior audit | No-op — verified. Mark CLOSED |
| LOW-7 | `X-Revenue-Id` correlation header | Already implemented at `server/src/index.ts:75-80`. Reads `X-Correlation-ID`, generates via `generateCorrelationId` from `./tracing.js`, sets `X-Request-ID` response header, logs `{ correlationId, error }` in onError at lines 144-149 | Mark VERIFIED |
| LOW-8 | `X-Content-Type-Options: nosniff` | Set at `server/src/middleware/security.ts:8` | Mark VERIFIED |
| MED-10 | lightningcss explicit dep | Tailwind v4 (`@tailwindcss/postcss`) uses lightningcss internally; no explicit dep needed in v4 architecture | Mark VERIFIED-NOT-APPLICABLE |

## New findings (introduced or discovered this session)

| ID | Severity | Finding | Fix |
|---|---|---|---|
| HIGH-1.5 | HIGH | API key cache hit path returned cached object without checking `active === false`. Revoked keys remained valid for `API_KEY_CACHE_TTL_SECONDS` (300s) | Added `active === false` check + cache delete to `validateApiKey` cache hit path. Added Redis cache invalidation to `revokeApiKey` and `refreshApiKey` | Committed 2026-06-03 (b46c224) |
| HIGH-4 | HIGH (regression) | 2026-06-02 patch added `logger.error(...)` to `server/src/config.ts:177` but `logger` was not imported. Typecheck was failing — verification-before-completion violation | Replaced with `console.warn` for dev-only placeholder check. Production fail-fast at lines 156-174 unchanged | Committed 2026-06-03 (b46c224) |
| MED-3.5 | MEDIUM | `app/src/app/layout.tsx:97` had `other: { 'theme-color': '#00ffc8' }` conflicting with `viewport.themeColor: '#0a0a0f'` at line 38. Browsers split between the two, behavior was unpredictable | Removed the `other` block. `viewport.themeColor` is now sole source of truth | Committed 2026-06-03 (494b383) |

## Items completed this session

| ID | Severity | File | Change |
|---|---|---|---|
| LOW-1 | LOW | `app/src/app/error.tsx` | Added "Report a Bug" `mailto:support@oma-ai.com` button |
| LOW-4 | LOW | `app/src/app/dashboard/page.tsx` | `pt-20` → `pt-4` |
| LOW-6 | LOW | `app/src/app/dashboard/page.tsx` | `role="alert" aria-live="polite"` on error banner |
| LOW-5 | LOW | `.github/workflows/deploy.yml` | New CI deploy workflow with 3 triggers, 4 jobs, concurrency control |
| B-1 | CRITICAL | `docs/CRITICAL-1-DEPLOYMENT-RUNBOOK.md` | New runbook: Model A = two Vercel projects, exact env-var lists, DNS, CORS, JWT iss/aud, cookie Domain, verification flow, rollback |

## Open (deferred — requires real work, not 1-shot edits)

| ID | Est. | Blocker | Required for launch? |
|---|---|---|---|
| MED-4 light-mode UI | 4h | Design sign-off | No |
| MED-5 admin dedup (748 lines + subroutes) | 1d | Multi-file refactor | No |
| MED-6 data-driven compare/use-cases | 0.5d | Template dedup | No |
| MED-11 `/api/v1/chat/completions` proxy | 2h | Only needed for Model B (single Vercel project) — Model A doesn't need it | No (Model A) |
| LOW-2 PWA install prompt | 4h | New manifest + service worker | No |

## Ship-blocker (not in repo)

**B-1 / CRITICAL-1**: `https://www.oma-ai.com/` currently serves a different product. `api.oma-ai.com` returns `404 DEPLOYMENT_NOT_FOUND`. The gateway in this repo is NOT deployed to its documented domain.

Execution requires Vercel + DNS account owner. See `docs/CRITICAL-1-DEPLOYMENT-RUNBOOK.md`.

## Final commit chain (this session)

```
b46c224 fix(server): resolve HIGH-1.5 revocation cache gap + HIGH-4 logger regression
494b383 fix(app): address MED-3.5 theme-color dedup, LOW-1/4/6 UI polish
<pending> chore(infra): add CI deploy workflow (LOW-5) and CRITICAL-1 deployment runbook
```

Gates: server typecheck PASS, lint PASS, 406/406 tests in 43 files PASS. App typecheck PASS, lint PASS.
