# OMA-AI v4 Mission Context — M2 Copy Polish Worker (Active)

## Current Status

**M2 Copy & Wording Polish worker `ses_copy_polish` in progress.**

### Mission 2 (v4) Context
- v3 mission: 131/131 todos [x], site 100% functional
- v4 mission adds: orange theme, copy polish, aggressive cleanup
- todo.md M2 status: pending (T2.1-T2.4 not started; this worker is assigned)
- Other active workers (parallel): Morpheus integration, codebase cleanup, admin/login/wallet audit

### M2 Worker Progress (ses_copy_polish)
**T2.1: Audit landing/marketing pages** — COMPLETE (all files read, mostly clean)
- `app/src/app/page.tsx` (591 lines) — **CLEAN** field-manual style, no edits needed
- `app/src/app/about/page.tsx` (909 lines) — **CLEAN** field-manual style
- `app/src/app/pricing/page.tsx` (374 lines) — **CLEAN** concrete numbers, action CTAs
- `app/src/app/models/page.tsx` (529 lines) — **CLEAN**

**T2.2: Audit marketing pages** — COMPLETE
- `app/src/app/compare/page.tsx` (244 lines) — **CLEAN**
- `app/src/app/use-cases/page.tsx` (132 lines) — **1 ISSUE** (line 69)
  - "From idea to working software — pick a category to see how OMA brings concepts to life." → "brings concepts to life" is fluffy marketing
  - FIX: replace with concrete copy
- `app/src/app/faq/page.tsx` (528 lines) — **CLEAN**
- `app/src/app/private-ai-api/page.tsx` (212 lines) — **2 ISSUES**
  - line 33-36: `title: 'Get Started Fast', desc: 'No paperwork. Just connect and start inferring.'` — vague CTA
  - line 188: `'Enterprise-grade security'` — buzzword
- `app/src/app/crypto-payments/page.tsx` (665 lines) — **CLEAN**

**T2.3: Audit dashboard + admin** — PARTIALLY COMPLETE
- `app/src/app/dashboard/page.tsx` (327 lines) — **CLEAN** (mostly data, no user-facing copy)
- `app/src/app/dashboard/credits/page.tsx` (623 lines) — **CLEAN**
- `app/src/app/dashboard/api-keys/page.tsx` (544 lines) — **CLEAN**
- `app/src/app/admin/page.tsx` (725 lines) — **CLEAN** (data tables only)
- STILL TO READ: `admin/users/page.tsx`, `admin/users/[id]/page.tsx`, `admin/fees/page.tsx`, `admin/rate-limits/page.tsx`, `admin/analytics/page.tsx`

**T2.4 Apply fixes** — NOT STARTED
- 3 surgical edits planned:
  1. use-cases/page.tsx:69 — replace "brings concepts to life"
  2. private-ai-api/page.tsx:33-36 — replace "Get Started Fast" with specific action
  3. private-ai-api/page.tsx:188 — replace "Enterprise-grade security" with concrete

**T2.5 Tone consistency** — DEFERRED (headings already field-manual consistent, CTAs mostly action-specific)

**T2.6 Verification** — NOT STARTED
- Required: `cd app && npm run typecheck` (0), `npm run lint` (0), `npm run build` (exit 0)
- All 3 edits are surgical string changes — zero risk to types/components

### Work Log
- `.opencode/work-log.md` updated: `ses_copy_polish (Worker): M2 copy polish - in_progress`

## Pending Tasks

1. **Read remaining admin pages** (4 files): users/, users/[id], fees, rate-limits, analytics — likely CLEAN (data-heavy)
2. **Apply 3 surgical fixes** (T2.4):
   - use-cases/page.tsx:69 rewrite
   - private-ai-api/page.tsx:33-36 rewrite
   - private-ai-api/page.tsx:188 rewrite
3. **Run verification** (T2.5):
   - `cd app && npm run typecheck` → 0 errors
   - `cd app && npm run lint` → 0 errors
   - `cd app && npm run build` → exit 0
4. **Update work-log.md** with files modified + verification results
5. **Report back to Commander** with: per-file issue list, total files modified, verification output

## Files Identified For Edits (Surgical)

| File | Line | Current | Replacement |
|------|------|---------|-------------|
| use-cases/page.tsx | 69 | "pick a category to see how OMA brings concepts to life." | "pick a category to see the patterns and code." |
| private-ai-api/page.tsx | 33-36 | {icon: Shield, title: 'Get Started Fast', desc: 'No paperwork. Just connect and start inferring.'} | {icon: Shield, title: 'Wallet to API', desc: 'Connect a wallet, get a key, hit the endpoint. No email, no KYC.'} |
| private-ai-api/page.tsx | 188 | "Enterprise-grade security" | "Audited on-chain settlement" |

## Recent Commits (unchanged from prior context)
- `3bcd020` docs(todo): mark S3.4.5 [x]
- `d4d9e0c` fix(a11y): resolve all 7 axe-core violations
- (others as before)

## Key File Paths
- `/Users/tyson/Desktop/Code/OMA-AI/app/src/app/page.tsx` (landing, clean)
- `/Users/tyson/Desktop/Code/OMA-AI/app/src/app/use-cases/page.tsx` (1 fix needed)
- `/Users/tyson/Desktop/Code/OMA-AI/app/src/app/private-ai-api/page.tsx` (2 fixes needed)
- `/Users/tyson/Desktop/Code/OMA-AI/.opencode/todo.md` (M2 status: pending → in_progress)
- `/Users/tyson/Desktop/Code/OMA-AI/.opencode/work-log.md` (this session)

## Validation Gates (must pass after edits)
- `cd app && npm run typecheck` → 0 errors
- `cd app && npm run lint` → 0 errors
- `cd app && npm run build` → exit 0

## Notes
- Most pages already follow a "field manual" / "schematic" aesthetic (stop-slop pass complete)
- Copy is mostly: specific, plain-spoken, with concrete numbers and named features
- No buzzword sweeps needed; only 3 isolated edits required
- 3 edits are pure text changes — no prop renames, no component restructuring
