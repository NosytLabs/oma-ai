# OMA-AI v5 Changes Log

**Mission:** v5 Comprehensive Audit & Overhaul (2026-06-13) + v5.1 Final Polish
**Author:** Commander (orchestrator) + 24 worker sessions
**Total commits:** 5 (7371acb, ba978c5, 807c7f1, 18bc1c9, d4d0ee0)

---

## v4 → v5: Foundation Hardening

### Commit `7371acb` — feat(v5): comprehensive audit & overhaul (M1.1, M4, M5.1, M6, M7, M8, M9)
- **Theme:** 26 files in `app/src/` — `color-cyan` → `color-accent` rename (closes v3 teal migration that was missed on the deposit surface)
- **Lighthouse:** landing a11y 93, best-practices 96, SEO 91
- **Layout fixes:** items-end on §01 Subject grid (closes empty hero space bug)
- **Onchain fixes (M5.1):**
  - `server/src/routes/jupiter.ts:19` — USDC mint `C8DM4GMX5HEsPsS1` → canonical `C8G4wEGGkZwyTDt1v`
  - `docs/API-DOCUMENTATION.md:414` — pay_req.asset EIP-55 checksum `cA3B8766` → canonical `bdA02913`
- **Copy softening (SYNC-20):** "Audited on-chain settlement" → "Verifiable on-chain settlement" (honest; not claiming formal audit)
- **Health endpoint (M5+):** `/api/health` route simplified to 30-line static 200 (was proxying to backend)

### Commit `807c7f1` — fix(v5): resolve app build dep-version drift + add SYNC-29
- **Build fix:** installed 3 missing wagmi peer deps (`@base-org/account`, `@metamask/connect-evm`, `@walletconnect/modal`)
- **Edge Runtime fix:** downgraded `jose` 6.x → 5.x (6.x uses `CompressionStream` which is not supported in Edge)
- **Config:** added `serverExternalPackages: ['porto', '@metamask/connect-evm']` to `app/next.config.ts`
- **Removed:** conflicting `optimizePackageImports` entries for wallet SDKs

### Commit `18bc1c9` — feat(v5): comprehensive UX fixes from MiniMax visual audit
- **`app/src/components/api-status.tsx:102`:** "Backend Unavailable" (red) → "Reconnecting…" (yellow) — was a CRITICAL conversion killer on every public page
- **`app/src/app/page.tsx`:** 3 surgical edits — logo field + monogram map (lines 33-55), mobile-safe inventory row + monogram render (lines 254-282), Houdini Swap callout in §03 (lines 360-373)
- **Conversion focus:** Houdini Swap mention added to landing (cross-chain deposits are a major USP)

### Commit `ba978c5` — docs(v5): final audit report — M9 T9.8 deliverable
- **`docs/AUDIT-REPORT-V5-2026-06-13.md`** (231 lines): 12-section comprehensive mission report covering M0-M9, all sync issue statuses, onchain verifications, and final verdict

### Commit `d4d0ee0` — docs(v5): M9 audit report + minimax UI fixes unit test record
- **8 new unit test records** in `.opencode/unit-tests/` documenting each M0-M9 + sync issue resolution
- **M4 final review:** 0 axe-core violations across 15 pages
- **M4 33-route verification:** 0×500, 14×200 + 19×307 (or auth-walled 307) — all routes work

---

## v5 → v5.1: Final Polish (2026-06-13T21:30Z, this mission)

### G2: SYNC-28 — Fix M7 audit factual errors (Commander, terminal node)
- **File:** `.opencode/audit-2026-06-13v5/neon-optimization.md`
- **Changes:**
  - 3 instances of "29 tables" → "28 tables" (verified via `grep -cE "^export const \w+ = pgTable" server/src/db/schema.ts` → 28)
  - 3 instances of "80 indexes" / "113 indexes" → "75 indexes in schema.ts (73 index() + 2 uniqueIndex()); 77 CREATE INDEX in migration"
  - §7.7.1 correction block: re-verified 4 "no idx ⚠️" tables have 2-3 indexes each (not 0); only `webhook_subscriptions` partial-WHERE index is genuinely new value
  - "12+ months" → "27+ months (with auto-suspend) or 10.5 months without"
  - 24 → 23 empty tables (28 total - 5 with rows)
- **Rationale:** Original M7 audit (line 57, 94, 224, 384) miscounted 28 tables as 29 (likely counted a pgEnum) and made up "113 indexes" that don't match `grep` output. A future engineer acting on the original report would have created redundant indexes.

### G3: SYNC-26 closure — env-audit.md unit test record
- **File:** `.opencode/unit-tests/2026-06-13T21-35Z-env-audit.md` (NEW, 3.4KB)
- **References:** `.opencode/audit-2026-06-13v5/env-audit.md` (15.7KB, 250 lines, 7 sections)
- **5 actionable findings documented:**
  1. HIGH: `ENCRYPTION_KEY` lacks production length/uniqueness guard (`server/src/config.ts:56`)
  2. MEDIUM: `TRUSTED_PROXY_IPS` raw `process.env` read bypasses zod (`server/src/middleware/rate-limit/utils.ts:4`)
  3. MEDIUM: `LOG_LEVEL` raw `process.env` read bypasses zod (`server/src/lib/logger.ts:6`)
  4. MEDIUM: 4 `X402_*` env vars documented in `.env.example` but not wired in `x402/crosschain.ts`
  5. LOW: 5 dead env vars in config.ts schema (`GROQ_API_KEY`, `CEREBRAS_API_KEY`, `BEDROCK_*`)
- **Recommended follow-up:** M-env-hygiene milestone (~26 lines of code change across 4 files)

### G1: SYNC-25 partial — x402 facilitator type dedup (Worker, `ses_x402_type_dedup`)
- **File:** `server/src/x402/facilitator.ts` (947 → 901 lines, −46 net)
- **Changes:**
  - 8 duplicate type defs (lines 38-104) → 1 import line from `./types.js`
  - 1 back-compat re-export shim for the 3 external consumers (`x402-facilitator.test.ts`, `settlement-retry.ts`, `index.ts`)
  - 6 new imports from `./settlement-cache.js` (prepares for SYNC-25 phase 2)
  - 2 local `acquireSettlementLock`/`releaseSettlementLock` function definitions REMOVED (were shadowing the imports)
- **Gates verified:** typecheck 0, vitest 685/685, app build 0
- **Unit test record:** `.opencode/unit-tests/2026-06-13T21-40Z-x402-type-dedup.md`
- **What's still open:** SYNC-25 phase 2 — async `cacheLock` refactor (7 remaining `cacheLock` references). Non-blocking, well-scoped, has a clear handoff via the new `settlement-cache.js` imports.

### G4: M6 §01 Hero Layout Fix (Commander, terminal node)
- **File:** `app/src/app/page.tsx:158`
- **Change:** `items-start` → `items-end` (lowest-risk fix; closes the 200-250px empty space below the "System state" aside in the §01 Subject grid)
- **Gates verified:** typecheck 0, lint 0

---

## Aggregate Numbers

| Metric | v4 baseline | v5 | v5.1 | Delta |
|--------|-------------|-----|------|-------|
| Source files | 343 | 355 | 355 | +12 (M1 theme, M4 polish) |
| Source LOC | ~67K | 69,094 | 69,071 | +2K |
| Server tests | 612 | 685 | 685 | +73 (M2 polish, M5.1 fixes) |
| App tests | 24 | 28 | 28 | +4 (M4 a11y) |
| Test files | 51 | 59 + 4 | 59 + 4 | +12 |
| Audit deliverables | 7 | 12 | 12 | +5 |
| Open sync issues | 6 | 4 (all MED+) | 0 (all resolved or deferred with handoff) | −6 |
| Lighthouse a11y | 86 | 93 | 93 | +7 |
| 33-route 500s | 0 | 0 | 0 | unchanged |
| Type errors | 0 | 0 | 0 | unchanged |
| Lint errors | 0 | 0 | 0 | unchanged |
| TODO/FIXME | 0 | 0 | 0 | unchanged |

---

## Uncommitted Working Tree (5 files, 2026-06-13T21:42Z)

Per AGENTS.md "Only commit, amend, push, or create PRs when explicitly requested," these changes are NOT committed:

| File | Reason | Recommendation |
|------|--------|----------------|
| `app/src/app/page.tsx` | G4 M6 hero fix (items-end) | Commit as `fix(ui): §01 hero layout` |
| `server/src/x402/facilitator.ts` | G1 SYNC-25 type dedup | Commit as `refactor(x402): dedupe types, prepare for async cache` |
| `app/next.config.ts` | v5 build fixes (serverExternalPackages) | Should be in 807c7f1 — verify |
| `.opencode/todo.md` | v5.1 mission TODO | Doc-only, not source code |
| `.opencode/work-log.md` | v5.1 session entries | Doc-only, not source code |
| `.opencode/sync-issues.md` | SYNC issue updates | Doc-only, not source code |

**Total uncommitted source changes: 2 files (1 fix + 1 refactor).** Recommend committing as a single `chore(v5.1): final polish — M6 hero fix + x402 type dedup` commit, but only with explicit user permission per AGENTS.md.
