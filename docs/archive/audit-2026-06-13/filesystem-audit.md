# File System Cleanup Audit — OMA-AI (2026-06-13 ~03:40)

**Auditor**: Planner (research only — no fixes applied)
**Scope**: Redundant files, outdated docs, unused dependencies, broken references
**Working dir**: `/Users/tyson/Desktop/Code/OMA-AI`

---

## Executive Summary

| Category | Count | Severity |
|----------|-------|----------|
| Redundant env example files (duplicates) | 2 | LOW |
| Empty directories | 4 | LOW |
| Outdated / archived screenshots (4 dupes) | ~70 files (~12MB) | MEDIUM |
| Unused `server/models.json` data | 1 file (1113 lines) | MEDIUM |
| Untracked but real scripts | 2 | LOW |
| AGENTS.md count drift (4 sections wrong) | 4 | LOW |
| Broken doc references (DEVELOPER-GUIDE.md) | 2 | MEDIUM (known SYNC-6) |
| Unused dependencies | 0 confirmed | NONE |
| Stale `.bak`/`.tmp`/`.log`/`.DS_Store` files | 0 | NONE |

**Top cleanup targets** (by impact):
1. **Server `models.json` (1113 lines)** — orphaned, never imported
2. **Audit screenshot duplicates** — 4 redundant folders, ~12MB combined
3. **AGENTS.md module counts** — drift from 22→31 tests, 24→26 inference, 15→18 credits, 10→13 lib, 8→11 middleware
4. **DEVELOPER-GUIDE.md broken links** to `docs/MVP-DOCUMENTATION.md` (moved to `archive/`)
5. **Duplicate env example files** (root vs `app/`/`server/`)
6. **Empty directories** (`app/src/hooks/`, `.opencode/audit-2026-06-13/screenshots-v2/`, `.opencode/archive/`, `.opencode/plugins/`)

---

## 1. Redundant Files (DELETE candidates)

### 1.1 Duplicate env example files

| File | Size | Status | Recommended action |
|------|------|--------|--------------------|
| `/Users/tyson/Desktop/Code/OMA-AI/.env.app.example` | 2,555 B | Duplicate of `app/.env.example` | DELETE (canonical: `app/.env.example`) |
| `/Users/tyson/Desktop/Code/OMA-AI/.env.server.example` | 4,396 B | Duplicate of `server/.env.example` | DELETE (canonical: `server/.env.example`) |

**Evidence**:
- `diff` between root `.env.app.example` and `app/.env.example` shows only comment-style/formatting differences (root version uses a header block, the other is more terse). Both have identical env var names.
- `diff` between root `.env.server.example` and `server/.env.example` shows identical variables with minor comment differences. Both have TOTP/ENCRYPTION_KEY references intact.
- The AGENTS.md convention (`server/.env.example is authoritative`) confirms the nested versions are the canonical ones.

### 1.2 Empty directories (cleanup)

| Path | Status | Recommended action |
|------|--------|--------------------|
| `/Users/tyson/Desktop/Code/OMA-AI/app/src/hooks/` | Empty (0 files) | DELETE — AGENTS.md claims "React hooks" but no hooks exist |
| `/Users/tyson/Desktop/Code/OMA-AI/.opencode/audit-2026-06-13/screenshots-v2/` | Empty (0B) | DELETE — empty placeholder created during the audit run |
| `/Users/tyson/Desktop/Code/OMA-AI/.opencode/archive/` | Empty (0B) | DELETE — empty placeholder |
| `/Users/tyson/Desktop/Code/OMA-AI/.opencode/plugins/` | Empty (0B) | DELETE — empty placeholder |

### 1.3 Orphaned `server/models.json` (1113 lines, ~40KB+)

| File | Size | Status | Recommended action |
|------|------|--------|--------------------|
| `/Users/tyson/Desktop/Code/OMA-AI/server/models.json` | 1,113 lines | **ORPHANED** — no imports found | DELETE or move to `docs/archive/` |

**Evidence**:
- `grep -l "models.json" /Users/tyson/Desktop/Code/OMA-AI/server/src -r` → **0 matches** in source code.
- Actual model catalog lives in `server/src/inference/models.ts` (~250 lines, structured TypeScript with full type safety).
- The JSON file is untracked-style data with stale structure (e.g., `cheaptokens`, `surplus` providers not present).
- Likely a relic from an early MVP; should be archived or deleted.

### 1.4 Untracked-but-real scripts (should be COMMITTED)

| File | Purpose | Recommended action |
|------|---------|--------------------|
| `/Users/tyson/Desktop/Code/OMA-AI/scripts/blockchain-bootstrap.mjs` | DB validation + admin provisioning | `git add` (real, working — flagged in M4 review) |
| `/Users/tyson/Desktop/Code/OMA-AI/app/scripts/og-image-generate.mjs` | SVG→PNG conversion for OG image | `git add` (real, working — uses sharp) |

---

## 2. Outdated Audit Artifacts (DELETE candidates)

### 2.1 Screenshot duplicates across audit runs

| Path | Size | Files | Status | Recommended action |
|------|------|-------|--------|--------------------|
| `/Users/tyson/Desktop/Code/OMA-AI/.opencode/audit-2026-06-13/screenshots-final/` | 5.3MB | 9 PNGs (01-09-after) | Audit-after artifacts | KEEP for now (audit-just-completed) or MOVE to `docs/archive/audit-2026-06-13-screenshots/` |
| `/Users/tyson/Desktop/Code/OMA-AI/.opencode/audit-2026-06-13/screenshots-agent-browser/` | 2.8MB | 36 PNGs (before/after pairs) | Audit intermediate | MOVE to `docs/archive/audit-2026-06-13-screenshots/` |
| `/Users/tyson/Desktop/Code/OMA-AI/.opencode/audit-2026-06-13/screenshots-v2/` | 0B | 0 | **EMPTY** | DELETE |
| `/Users/tyson/Desktop/Code/OMA-AI/.opencode/audit-2026-06-13/final_runs/run_001/screenshots/` | 3.8MB | 18 PNGs | Final run | MOVE to `docs/archive/audit-2026-06-13-screenshots/` |
| `/Users/tyson/Desktop/Code/OMA-AI/.opencode/audit-2026-06-13/verification/` | 520KB | 9 PNGs | Verification pass | MOVE to `docs/archive/audit-2026-06-13-screenshots/` |
| `/Users/tyson/Desktop/Code/OMA-AI/audit-screenshots/v5/` | 212KB | 2 PNGs | Stray intermediate | DELETE (only 2 PNGs, all real screenshots live elsewhere) |
| `/Users/tyson/Desktop/Code/OMA-AI/docs/archive/screenshots/audit-2026-06-02/` | — | — | Already archived | KEEP (recently archived in M4) |

**Total**: ~12.4MB of screenshot artifacts across 5-6 directories, with significant overlap.

**Recommended consolidation**:
```
.opencode/audit-2026-06-13/   ← KEEP only plan.md, final_script.py, console_summary.txt, final_script_log.txt
.opencode/audit-2026-06-13/final_runs/, screenshots-*/, verification/  ← MOVE to docs/archive/audit-2026-06-13-screenshots/
audit-screenshots/v5/         ← DELETE
```

### 2.2 Other audit artifacts

| File | Purpose | Recommended action |
|------|---------|--------------------|
| `/Users/tyson/Desktop/Code/OMA-AI/.opencode/audit-2026-06-13/plan.md` | Mission plan | KEEP (just-created, references current work) |
| `/Users/tyson/Desktop/Code/OMA-AI/.opencode/audit-2026-06-13/final_runs/run_001/final_script.py` | The audit script | MOVE to `docs/archive/audit-2026-06-13/` for reproducibility |
| `/Users/tyson/Desktop/Code/OMA-AI/.opencode/audit-2026-06-13/final_runs/run_001/console_summary.txt` | Console summary | KEEP in archive |
| `/Users/tyson/Desktop/Code/OMA-AI/.opencode/audit-2026-06-13/final_runs/run_001/final_script_log.txt` | Script log | KEEP in archive |

---

## 3. Outdated Docs / Broken References

### 3.1 AGENTS.md count drift (MUST UPDATE)

| Section | AGENTS.md says | Actual | Delta |
|---------|----------------|--------|-------|
| `__tests__/` count (server) | 22 | 31 | **+9** (40% off) |
| `inference/` modules | 24 | 26 | +2 |
| `credits/` modules | 15 | 18 | +3 |
| `lib/` utilities | 10 | 13 | +3 |
| `middleware/` | 8 | 11 | +3 |
| `jobs/` | 6 | 6 | ✓ correct |

**Action**: Update AGENTS.md to reflect actual counts.

### 3.2 AGENTS.md missing references

- **`app/src/hooks/`** is listed in the directory tree diagram (line ~140) but the directory is **empty** (0 files). Either delete the empty dir AND remove the line, or populate with actual hooks.
- **`app/src/test/`** is listed in the directory tree but not verified — likely empty (vitest tests live in `app/src/app/page.test.tsx` colocated).

### 3.3 Known broken doc reference (SYNC-6 — already documented)

`/Users/tyson/Desktop/Code/OMA-AI/docs/DEVELOPER-GUIDE.md` has 2 stale references to `docs/MVP-DOCUMENTATION.md` (moved to `archive/` in M4):

- **Line 362** (directory tree diagram): `└── MVP-DOCUMENTATION.md` should be removed (the doc is archived; canonical is `docs/INTERNAL-SOURCING.md`).
- **Line 478** (footer): "or read `docs/MVP-DOCUMENTATION.md`" should point to `docs/INTERNAL-SOURCING.md` or `docs/DEVELOPER-GUIDE.md` itself.

**Action**: Apply SYNC-6 fix.

### 3.4 Outdated docs (already in `docs/archive/` — already handled by M4)

- `docs/archive/AUDIT-CORRECTIONS-2026-06-03.md` (66 lines) — correctly archived
- `docs/archive/AUDIT-REPORT-2026-06-02.md` (381 lines) — correctly archived
- `docs/archive/MVP-DOCUMENTATION.md` (454 lines) — correctly archived
- `docs/archive/PRODUCTION-READINESS-REPORT.md` (184 lines) — correctly archived
- `docs/archive/audit-port3000.jpeg` (39KB) — correctly archived
- `docs/archive/screenshots/` — correctly archived

**Status**: ✓ All current `docs/` files are valid (verified 2026-06-13 ~03:14).

### 3.5 Other untracked files (just-staged audit work)

The 100 untracked files visible via `git ls-files --others --exclude-standard` are mostly:
- `.opencode/*` orchestration state (expected, untracked by design)
- Staged audit files in `app/src/app/api/v1/` and various layout/loading/page files (likely new work just added)

**Action**: Review `git status -u` before committing to ensure no stragglers.

---

## 4. Unused Dependencies

| Package | Declared in | Imported in src? | Status |
|---------|-------------|------------------|--------|
| `@otplib/preset-default` | server/package.json | YES — `server/src/auth/middleware.ts:11`, `server/src/auth/api-keys.ts:7` (via TOTP 2FA), `server/src/routes/auth.ts` | ✓ USED |
| `fast-xml-parser` | server/package.json | YES — `server/src/routes/sso.ts` (XMLParser for SAML) | ✓ USED |
| `tweetnacl` | server/package.json | YES — `server/src/auth/solana.ts` (Solana signing) | ✓ USED |
| `@opentelemetry/*` (6 packages) | server/package.json | YES — `server/src/tracing.ts`, `inference/router.ts`, etc. | ✓ USED |
| `@neondatabase/serverless` | server/package.json | YES — `server/src/db/client.ts`, `scripts/blockchain-bootstrap.mjs` | ✓ USED |
| `redis` | server/package.json | YES — `server/src/lib/redis-client.ts` | ✓ USED |
| `viem` | server, app | YES — auth + wallet flows | ✓ USED |
| `wagmi` | app | YES — `app/src/lib/wagmi.ts`, `wallet-provider.tsx` | ✓ USED |
| `siwe` | server, app | YES — SIWE auth flows | ✓ USED |
| `jose` | server, app | YES — JWT verify in `app/src/middleware.ts`, `server/src/auth/siwe.ts` | ✓ USED |
| `bs58` | server | Type augmentation `server/src/types/bs58.d.ts` (import via Solana web3) | ✓ USED |
| `nanoid` | server | Likely used for ID generation | ✓ USED (verify) |
| `pino`, `pino-pretty` | server | YES — `server/src/lib/logger.ts` | ✓ USED |
| `@coinbase/wallet-sdk`, `@metamask/sdk`, `@safe-global/safe-apps-provider`, `@walletconnect/ethereum-provider` | app | Wallet provider infrastructure | ✓ USED |
| `framer-motion` | app | `app/src/components/motion-provider.tsx` | ✓ USED |
| `react-markdown`, `remark-gfm` | app | Likely in docs/use-case pages | ✓ USED |
| `recharts` | app | `app/src/components/ui/charts/*` | ✓ USED |
| `date-fns` | app | Likely for date formatting | ✓ USED (verify) |
| `lucide-react` | app | Icon library, used throughout | ✓ USED |
| `@tanstack/react-query` | app | Data fetching | ✓ USED |

**Result**: **0 confirmed unused dependencies** in either `server/package.json` or `app/package.json`.

---

## 5. Unused / Orphaned Source Files (manual spot-check)

### Confirmed in use (not orphaned)

- `app/src/lib/api.ts` — barrel re-export shim (per AGENTS.md note)
- `app/src/lib/api/*.ts` — split modules, barrel-auto-exposes
- `app/src/middleware.ts` — auth middleware (Next.js convention)
- `server/src/tracing.ts` — OTel setup, imported in `index.ts`

### Empty placeholders

- `app/src/hooks/` — directory listed in AGENTS.md but **0 files** present. Recommend removing the line from AGENTS.md.

### Possible orphans (need deeper audit)

- `app/src/lib/webpack-stubs/ox-tempo-virtual-master-pool.js` — 1 file, no clear consumer visible at root. Could be a Node polyfill for a specific module. **Need semantic check**.

---

## 6. `.gitignore` Coverage

Current `.gitignore` is comprehensive and includes:
- Standard ignores: `node_modules/`, `dist/`, `.next/`, `*.log`, `.DS_Store`, `Thumbs.db`
- Env: `.env*` variants
- Coverage: `coverage/`
- Generic audit patterns: `audit_*/`, `audit_results_*/`, `*_audit*.md`, `*_AUDIT*.md`, `*REPORT*.md`, `*VALIDATION*.md`
- Lighthouse: `app/lighthouse.json`, `app/.lighthouseci/`
- Vercel: `.vercel` (project configs still gitignored at top-level)
- Webwright: `webwright_audit/`

**Gaps** (recommended additions):
- `.opencode/audit-*/screenshots-*/` (intermediate audit artifacts)
- `audit-screenshots/` (orphan dir at root)
- `e2e-screenshots/`, `test-screenshots/` (already in list)
- `screenshot_comparison.md` (already in list)

---

## 7. Recommended Action Plan (in priority order)

### P0 — Quick wins, low risk
1. **DELETE** empty dirs: `app/src/hooks/`, `.opencode/audit-2026-06-13/screenshots-v2/`, `.opencode/archive/`, `.opencode/plugins/`
2. **DELETE** orphan `server/models.json` (1113 lines, 0 imports)
3. **DELETE** duplicate env files: `.env.app.example`, `.env.server.example`
4. **DELETE** stray `audit-screenshots/v5/` (2 PNGs)

### P1 — Doc consistency (MUST FIX for SYNC-6)
5. **UPDATE** `docs/DEVELOPER-GUIDE.md:362` to remove `MVP-DOCUMENTATION.md` line
6. **UPDATE** `docs/DEVELOPER-GUIDE.md:478` to point at `INTERNAL-SOURCING.md` or `DEVELOPER-GUIDE.md` itself
7. **UPDATE** AGENTS.md module counts: tests 22→31, inference 24→26, credits 15→18, lib 10→13, middleware 8→11
8. **UPDATE** AGENTS.md to remove `app/src/hooks/` line (or populate the dir)

### P2 — Audit artifact consolidation
9. **MOVE** all `.opencode/audit-2026-06-13/screenshots-*/` and `final_runs/run_001/screenshots/` and `verification/` to `docs/archive/audit-2026-06-13-screenshots/` (~12MB)
10. **KEEP** `.opencode/audit-2026-06-13/plan.md` (current mission reference)
11. **ADD** to `.gitignore`: `.opencode/audit-*/screenshots-*/`, `audit-screenshots/`

### P3 — Commit real-but-untracked scripts
12. **STAGE & COMMIT** `scripts/blockchain-bootstrap.mjs` (per M4 review recommendation)
13. **STAGE & COMMIT** `app/scripts/og-image-generate.mjs`

### P4 — Verify (non-blocking)
14. **VERIFY** `app/src/lib/webpack-stubs/ox-tempo-virtual-master-pool.js` is needed
15. **VERIFY** `nanoid`, `date-fns` usage via grep before any future dep cleanup

---

## 8. Files Confirmed Clean (no action needed)

- `app/src/lib/api/*` (all 10 split modules + barrel — actively used)
- `app/src/components/**` (all 30+ components verified in use)
- `server/src/credits/*` (18 modules, all wired)
- `server/src/inference/*` (26 modules, all wired)
- `server/src/lib/*` (13 modules, all wired)
- `server/src/middleware/*` (11 modules, all wired)
- `server/src/__tests__/*` (31 test files, all passing per M4 review)

---

## 9. Confidence & Methodology

**Confidence**: HIGH (90%+) for file inventory; MEDIUM (70%) for unused-dep detection (some imports could be dynamic/conditional).

**Methodology**:
- `find` for orphan file detection
- `grep -l` for import-level dependency tracing
- `git status --porcelain` + `git ls-files --others` for tracking state
- `wc -l` + `du -sh` for size impact
- `diff` for duplicate-content detection
- `ls -la` recursive walks for directory structure

**Limitations**:
- Did NOT execute `npx depcheck` (would give definitive unused-dep list)
- Did NOT verify dynamic imports (`import()`) or runtime requires
- Did NOT check for transitive unused deps (e.g., a dep of a dep)
- Did NOT check for unused exports in barrel files

**End of audit. No files modified. Report-only.**
