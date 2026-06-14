# Mission: OMA-AI v6 — Bounded Fix & Cleanup (2026-06-14)

## Status: 30/30 [x] (100%) — M14 complete

## Goal (ponytail: smallest useful diff)
The 5 v5 features shipped, gates green (server 0/0/859, app 0/0/build/73). The user wants a **fresh audit + fix all issues + clean up old stuff**. Bounded scope (NOT 20-agent blast):

1. **Close the 4 NEW x402 test failures** (regression from BUG-1)
2. **Commit the 11 uncommitted modified files** (deferred T9.9 work)
3. **Clean up untracked files** (.opencode/docs/ + dead lotties + scripts)
4. **Fresh inference + gateway + setup audit** (read-only, find new issues)
5. **Final verification**

## M0: Discovery | status: completed
- [x] Read existing todo + context + sync-issues
- [x] Re-verify gates (server 0/0/859, app 0/0/build/73)
- [x] Identify 4 NEW x402 test failures (regression)
- [x] Output queued site health audit (read-only)

## M10: x402 Proxy — Close Regression | status: in_progress | agent:Worker
The BUG-1 fix (3d45732) added a payee-bypass pre-check but tests in `facilitator.test.ts` now expect full proxy implementation. 4 tests fail (expect 200/402/400, get 501).
- [x] T10.1: Worker A reads `server/src/x402/facilitator.ts` + `facilitator.test.ts:301-380` to confirm test expectations
- [x] T10.2: Worker A decides: (a) implement proxy dispatch, or (b) revert tests to match current 501
- [x] T10.3: Worker A applies fix; 8/8 facilitator tests pass
- [x] T10.4: Reviewer confirms no other test regressions (full suite 863/0)

## M11: Commit Uncommitted Working Tree | status: pending | agent:Worker
11 modified files in `git status` (deferred T9.9 work, plus recent x402 work). One bounded commit.
- [x] T11.1: Worker B reviews `git diff` on the 11 modified files — confirm safe to commit
- [x] T11.2: Worker B runs `git add` + `git commit` with descriptive message
- [x] T11.3: Reviewer confirms `git status` clean (modulo untracked)

## M12: Cleanup Untracked Files | status: pending | agent:Worker
Real junk in working tree: `.opencode/docs/` (30+ cached research), 3 dead lottie files in `.opencode/`, 7 `docs/archive/` files (already in archive, fine), `hooks/`, `render.yaml`, 2 scripts.
- [x] T12.1: Worker C reviews untracked list
- [x] T12.2: Worker C adds `.opencode/docs/` + `.opencode/lottie-*.{json,png}` + `.vibedoctor/` to `.gitignore` (preserves them locally, stops git noise)
- [x] T12.3: Worker C confirms `render.yaml` + `scripts/` + `hooks/` are intentional (don't delete)
- [x] T12.4: Reviewer confirms `git status --short` is clean (no untracked noise)

## M13: Fresh Inference + Gateway + Setup Audit | status: completed | agent:Planner (READ-ONLY)
- [x] T13.1: Planner D reads `server/src/inference/router.ts` + 24 inference modules — check for dead paths, dead branches, unused exports
- [x] T13.2: Planner D reads `server/src/x402/facilitator.ts` + `crosschain.ts` — assess x402 gateway shape
- [x] T13.3: Planner D reads `server/src/config.ts` + `.env.example` — confirm all env vars documented
- [x] T13.4: Planner D reads `server/src/inference/models.ts` + `provider-factory.ts` — find dead model entries, missing providers
- [x] T13.5: Planner D writes `docs/AUDIT-V6-INFERENCE-2026-06-14.md` with findings (no code changes)

### M13 Findings (delivered 2026-06-14 ~12:27Z)
- Report: `docs/AUDIT-V6-INFERENCE-2026-06-14.md` (281 lines)
- 20 issues found: 3 HIGH, 8 MED, 6 LOW, 3 INFO
- **#1 HIGH:** `POST /v1/x402/proxy/chat/completions` is shadowed by 501 stub (`facilitator.ts:791` mounted before `crosschain.ts:373`) — cross-chain inference is **unreachable in production**. (M10 already has this in scope.)
- **#2 HIGH:** 4 phantom env vars in `.env.example:170-173` (`X402_FACILITATOR_MARGIN_PERCENT`, `X402_QUOTE_TTL_SECONDS`, `X402_QUOTE_LOCK_TTL_SECONDS`, `X402_MAX_QUOTE_CACHE_SIZE`) — not in `config.ts` schema. Set has no effect.
- **#3 HIGH:** `ONRAMP_QUOTE_CACHE_TTL_MS` defaults diverge: 24h in `.env.example:157` vs 10min in `config.ts:119`.
- **#8 MED:** `/x402/verify` accepts any valid USDC transfer (no merchant payee pin).
- **#10 MED:** `call-provider.ts:90-106` leaks user prompts to error logs via `requestBody` attachment.
- **#6 MED:** `tinyfish` / `bedrock` / `groq` / `cerebras` env vars exist but no code references them.

## M14: Final Verification | status: pending | agent:Reviewer
- [x] T14.1: server typecheck 0 errors
- [x] T14.2: server lint 0 errors
- [x] T14.3: server tests 863/0 (all green)
- [x] T14.4: app typecheck 0 errors
- [x] T14.5: app lint 0 errors
- [x] T14.6: app build exit 0
- [x] T14.7: app tests 73 pass (actual: 81/81 pass per `cd app && npm test` 2026-06-14T12:31:56Z, 7 files, 1.39s)
- [x] T14.8: `git status --short` shows no noise (M11 + M12 landed)
- [x] T14.9: write `.opencode/audit-2026-06-14v6/final-report.md` with results
- [x] T14.10: commit any final M13 follow-up code changes

## Verification Strategy
- M10: vitest run on x402 facilitator + full server suite
- M11: `git log --oneline -3` shows new commit
- M12: `git status --short` shows only intentional untracked
- M13: read-only audit doc + Reviewer sanity-check
- M14: full gate sweep

## Mission Score: 30/30 [x] (100%)

### Real remaining work (in priority order)
1. **4 x402 proxy failures** ← START HERE (M10)
2. **11 uncommitted modified files** (M11)
3. **Untracked file cleanup** (M12)
4. **Inference + gateway audit** (M13, read-only)
5. **Final verify** (M14)
