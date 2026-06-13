# x402 + Facilitator Audit — Unit Test (Reviewer Re-Verification)

**Date:** 2026-06-13T20:57Z
**Reviewer session:** Reviewer (current session, dispatched to verify "x402 + facilitator audit" unit)
**Scope of original "audit":** the M5 Base MCP onchain audit (`.opencode/audit-2026-06-13v4/base-mcp-report.md`, 16.5K, 7 sections, ses_base_mcp_v4) + the M5.1 fix unit (`.opencode/unit-tests/2026-06-13T18-55-30Z-m5-1-fixes.md`).
**Files in scope:**
- `server/src/x402/facilitator.ts` (947 lines)
- `server/src/x402/crosschain.ts` (528 lines)
- `server/src/x402/receipt.ts` (45 lines)
- `server/src/x402/settlement-cache.ts` (135 lines)
- `server/src/x402/types.ts` (91 lines)
- `server/src/__tests__/x402-facilitator.test.ts` (558 lines, 30 tests)
- `server/src/__tests__/x402.test.ts` (9 tests)
- `server/src/__tests__/crosschain.test.ts` (12 tests)

## Static Analysis (LSP)

| File | Diagnostics |
|------|-------------|
| `x402/facilitator.ts` | ✅ No diagnostics found. All clean! |
| `x402/crosschain.ts` | ✅ No diagnostics found. All clean! |
| `x402/receipt.ts` | ✅ No diagnostics found. All clean! |
| `x402/settlement-cache.ts` | ✅ No diagnostics found. All clean! |
| `x402/types.ts` | ✅ No diagnostics found. All clean! |

## Build Verification

```
$ cd server && npx tsc --noEmit
EXIT: 0
```

No TypeScript errors. `tsc --noEmit` exit 0.

## Test Verification

### Targeted x402 Test Files

| Test File | Tests | Status | Duration |
|-----------|-------|--------|----------|
| `__tests__/x402-facilitator.test.ts` | 30 | ✅ 30/30 passed | 531ms |
| `__tests__/x402.test.ts` | 9 | ✅ 9/9 passed | 2.20s |
| `__tests__/crosschain.test.ts` | 12 | ✅ 12/12 passed | 1.90s |
| **x402 module total** | **51** | **✅ 51/51 passed** | **~4.6s** |

### Full Server Test Suite (regression check)

```
$ cd server && npx vitest run
Test Files  59 passed (59)
     Tests  685 passed (685)
  Start at  17:56:31
  Duration  10.86s
EXIT: 0
```

All 685 tests pass, 59 test files, no regressions.

## M5 / M5.1 Audit Findings Re-Verification

The original M5 audit found 2 HIGH-severity onchain bugs. The M5.1 unit-test record at `.opencode/unit-tests/2026-06-13T18-55-30Z-m5-1-fixes.md` verified both fixes. I independently re-verified via fresh grep + read:

```
$ grep -rn "C8DM4GMX5HEsPsS1\|cA3B8766" server/src/ app/src/ docs/
(no matches)

$ grep -n "USDC_MINT" server/src/routes/jupiter.ts
19:  export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
260: if (info.mint === USDC_MINT) { ... }
473: outputMint: USDC_MINT,
482: outputMint: USDC_MINT,

$ grep -n "asset" docs/API-DOCUMENTATION.md | grep "0x8335"
414: "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
```

✅ Both HIGH bugs fixed. EIP-55 checksum valid. Canonical Circle Solana USDC mint in use at 4 sites. Zero residual references to the old broken values.

## Code Quality & Modularity — **FAIL**

The M5 audit and M5.1 fix were functionally correct (onchain claims verified, bugs fixed, tests pass, typecheck clean). However, my **independent re-review of the x402 module** uncovered significant code-quality and modularity violations that the prior M5/M5.1 unit reviews did NOT catch (their scope was limited to onchain-bug fixes and cross-codebase grep, not module-internal structure). These are documented in **SYNC-25** for Worker remediation.

### Defects Found

#### Q1. **`server/src/x402/receipt.ts` is dead code (HIGH)**
- Exports: `RECEIPT_VERSION`, `signReceipt`, `verifyReceipt`, `createReceiptPayload` (45 lines).
- **Imports of this module from any other source/test file: 0.**
- `server/src/x402/facilitator.ts:161,163,173,192` defines its OWN private copies of the exact same 4 symbols.
- Result: The 45-line module is unused. Facilitator imports nothing from it; the worker added the module but never refactored facilitator to consume it.

#### Q2. **`server/src/x402/settlement-cache.ts` is dead code (HIGH)**
- Exports: `acquireSettlementLock`, `releaseSettlementLock`, `settlementCache`, `cacheAccessOrder`, `MAX_CACHE_SIZE`, `PAYMENT_WINDOW_SECONDS`, `cleanExpiredCache`, `evictLRU`, `acquireCacheLock`, `atomicCacheSet`, `atomicCacheDelete` (135 lines).
- **Imports of this module from any other source/test file: 0.**
- `server/src/x402/facilitator.ts` duplicates ALL of the above inline (lines 19-25, 27-32, 110-151, 553-563).
- The settlement-cache.ts file documents itself as the **C1 fix** (replacing the racy `cacheLock: boolean` with a per-key async mutex), but the same fix was NEVER applied to facilitator.ts — facilitator.ts still has the unsafe OLD pattern.

#### Q3. **The "C1 fix" exists but is not applied (CRITICAL — safety regression)**
- `server/src/x402/settlement-cache.ts:26-31` documents the OLD `cacheLock: boolean` pattern as a known anti-pattern:
  > "The previous implementation used a module-level boolean `cacheLock` plus `setTimeout(..., 0)` to "queue" callers, which (a) was not actually FIFO, (b) dropped the queue head on busy event loops, and (c) could race on the settlementCache map itself outside the critical section."
- `server/src/x402/facilitator.ts:114` STILL defines `let cacheLock = false;` and uses it in:
  - `facilitator.ts:136-149` (atomicCacheSet — uses the unsafe boolean + setTimeout(...,0) busy-wait)
  - `facilitator.ts:553-563` (settlement-failure cleanup busy-wait `while (cacheLock) await sleep(1)`)
- This is the exact pattern the new file says is buggy. The fix is documented, the new module is written, but the integration step is missing. The settlement race that the C1 fix was supposed to close is **still open**.

#### Q4. **Type duplication: `facilitator.ts` redefines `types.ts` (MEDIUM)**
- `server/src/x402/types.ts:1-67` defines: `X402Version`, `PaymentPayload`, `PaymentSignature`, `PaymentRequired`, `PaymentResponse`, `SettlementRecord`, `SettlementResponse`, `PaymentMiddlewareConfig` — with `scheme: "evm" | "solana"` (correct broader union).
- `server/src/x402/facilitator.ts:38-104` re-defines the same 8 types, with `scheme: "evm"` (narrower — drops Solana).
- `server/src/x402/facilitator.ts` does NOT import from `./types.js`. Two divergent type definitions for the same shapes.
- Test files (`x402-facilitator.test.ts`) import types from `facilitator.js` and use them — so the narrower `scheme: "evm"` is the de-facto type, even though `types.ts` documents the broader `evm | solana`.
- Risk: A future change to `types.ts` won't propagate to facilitator; the broader Solana variant is documented as supported but not in the type contract used by the runtime.

#### Q5. **`atomicCacheSet` signatures diverge (MEDIUM — partial fix mismatch)**
- `server/src/x402/settlement-cache.ts:107` — `export async function atomicCacheSet(...)` (returns `Promise<void>`)
- `server/src/x402/facilitator.ts:136` — `function atomicCacheSet(...)` (returns `void`)
- If the new settlement-cache.ts module were wired in, the function contract is incompatible with how facilitator.ts currently calls it (sync). Partial migration.

#### Q6. **`setInterval(cleanExpiredCache, 300_000).unref()` registered twice (LOW — runtime waste)**
- `facilitator.ts:151` registers the interval.
- `settlement-cache.ts:135` registers the same interval.
- If the (currently dead) settlement-cache.ts is ever imported (or its module-level code runs), the interval will fire on a duplicate schedule. Currently latent; if a refactor ever imports it, this leaks a 2nd timer.

#### Q7. **`settlement-cache.ts` has a self-dead cleanup branch (LOW)**
- Lines 73-75:
  ```ts
  if (cacheMutexChains.get(cacheKey) === previous.then(() => current)) {
    cacheMutexChains.delete(cacheKey);
  }
  ```
- `previous.then(() => current)` is a freshly-created Promise; the value stored in the map is the result of an earlier `previous.then(() => current)` call. They will never be `===` identical. The cleanup branch is unreachable.
- Currently latent (module is dead), but if wired in, the `cacheMutexChains` map will grow unboundedly per cacheKey.

## Scope Compliance — Functional Layer

| M5 audit sub-task | Status | Evidence |
|-------------------|--------|----------|
| S5.1.1 — Verify USDC contract on Base mainnet | ✅ DONE | `get_token_info` MCP call transcript in audit §2.1; address `0x8335…29913` confirmed |
| S5.1.2 — Get current gas price for documentation | ✅ DONE | `get_base_gas_price` transcript in audit §2.2 (0.006 gwei) |
| S5.1.3 — Copy claims audit (15 claims) | ✅ DONE | Audit §4 table: 10 accurate, 4 not-onchain-verifiable, 1 needs fix |
| S5.1.4 — Document findings | ✅ DONE | `.opencode/audit-2026-06-13v4/base-mcp-report.md` (368 lines, 7 sections) |

| M5.1 fix sub-task | Status | Evidence |
|-------------------|--------|----------|
| S5.1.1.1 — Fix `jupiter.ts:19` USDC_MINT | ✅ DONE | Line 19 now `…C8G4wEGGkZwyTDt1v` |
| S5.1.1.2 — server typecheck | ✅ PASS | exit 0, no errors (re-confirmed at 20:57Z) |
| S5.1.1.3 — server tests | ✅ PASS | 685/685 (re-confirmed at 20:57Z) |
| S5.1.2.1 — Fix `API-DOCUMENTATION.md:414` | ✅ DONE | Line 414 now `…bdA02913` |
| S5.1.2.2 — EIP-55 checksum valid | ✅ PASS | `get_token_info` re-verified (2026-06-13T18:55Z) |

## Verdict

**FUNCTIONAL: PASS** — All M5 audit findings addressed. All M5.1 fixes applied and verified. All 685 server tests pass. TypeScript clean. x402 module: 51/51 tests pass.

**CODE QUALITY / MODULARITY: FAIL** — 7 defects found (Q1-Q7 above). Documented in **SYNC-25** for Worker remediation. These are NOT regressions (no test failures) and NOT blocking the M5/M5.1 sign-off, but they represent significant modularity violations that should be cleaned up in a follow-up task. Per the project's "no skipping Quality Checklist" rule, the x402 module is currently in a partially-migrated state with ~180 lines of dead code that the codebase would be better off without — OR the worker should wire in the new safe settlement-cache.ts and delete the inline copies from facilitator.ts (single source of truth).

## Recommendations (for next M-level task)

1. **M5.2 — Consolidate x402 module** (HIGH, recommended): Worker should:
   - Wire `server/src/x402/settlement-cache.ts` into `facilitator.ts` (replace inline `cacheLock` boolean + sync `atomicCacheSet` with the new per-key async mutex). This is a 1-file change in facilitator.ts and 1 file path update in the 10 test files that mock `../x402/facilitator.js`.
   - Wire `server/src/x402/receipt.ts` into `facilitator.ts` (delete the duplicate `RECEIPT_VERSION`/`signReceipt`/`verifyReceipt`/`createReceiptPayload` from facilitator.ts; import from `./receipt.js`).
   - Either delete the 2 dead modules OR keep them and have facilitator consume them. Either is correct; the current state (duplicated + dead) is not.
   - Type consolidation: delete the 8 type definitions from `facilitator.ts:38-104`; import from `./types.js`.
   - Re-run gates: `tsc --noEmit` + `npm test` (must remain 685/685).
2. **Optionally**: rename `crosschain.ts:28 LOCK_VALUE_PREFIX` to `LOCK_KEY_PREFIX` (it's a key, not a value). Cosmetic.

## Sign-off

- [x] LSP clean on all 5 x402 files
- [x] `tsc --noEmit` exit 0
- [x] 51/51 x402 module tests pass
- [x] 685/685 server tests pass (no regression)
- [x] M5 audit findings addressed (M5.1 fix verified)
- [ ] Code quality / modularity (Q1-Q7) — **FAIL**, SYNC-25 written

**x402 + facilitator unit — FUNCTIONAL PASS, MODULARITY FAIL. See SYNC-25 for code-quality remediation backlog.**

## What I did vs. what the prior reviewers did

| Item | M5 review (18:37Z) | M5.1 review (18:55Z) | This review (20:57Z) |
|------|---------------------|------------------------|------------------------|
| MCP re-verification | 2 calls (get_token_info, get_base_gas_price) | 1 call (get_token_info) | 0 (already verified) |
| Cross-codebase grep for residual bugs | yes | yes | yes |
| `lsp_diagnostics` on x402 files | not run | yes (jupiter.ts only) | yes (all 5 x402 files) |
| `tsc --noEmit` server-wide | not run | yes | yes |
| Targeted x402 test files | not run | not run | yes (x402, x402-facilitator, crosschain) |
| Full server test suite | not run | yes (685/685) | yes (685/685) |
| **Code quality / modularity review of x402 module internals** | **not done** | **not done** | **yes — 7 defects (Q1-Q7)** |

The M5/M5.1 reviews were scoped to onchain-bug verification. This review expanded scope to module internals per the Iron Law: "verify what the audit/implementation actually contains, not just that the prior commit landed." That broader scope revealed the dead-code and dual-implementation defects in Q1-Q3 that prior reviews missed.
