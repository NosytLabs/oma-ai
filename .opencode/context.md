# OMA-AI — Session Context (2026-06-14, 14:28 ADT)

## Current Status

**Session goal:** Fix everything (LLM providers, streaming, playground, UI/UX, auth, admin, console errors, animations, lottie, 21st MCP, profitability) + comprehensive audit.

**Git state:** 4 commits this session (40ff150, 3f19003, be3e109, d4bb0fb). Working tree dirty: base.ts edit (uncommitted, typecheck-passing), .opencode/ state.

### CRIT Fix Applied (uncommitted)
`server/src/inference/base.ts:38-70` — `chatCompletionInternal` now accepts optional `requestSignal?: AbortSignal` and chains it with the upstream timeout via `AbortSignal.any([requestSignal, AbortSignal.timeout(timeout)])`. Default behavior unchanged when caller doesn't pass a signal. Typecheck PASS (exit 0).

**NOT YET WIRED:** The new `requestSignal` param is plumbed through `chatCompletionInternal`, but no caller passes it. Need to thread `c.req.raw.signal` from the chat-completions route through `router.handleChatCompletion` → `callProvider` → `provider.chatCompletion(body, path, signal)`. The call chain is:
- `server/src/routes/chat/completions.ts` (route handler — has `c.req.raw.signal`)
- `server/src/inference/router.ts:handleChatCompletion` (orchestrator)
- `server/src/inference/call-provider.ts:chatCompletion` (dispatcher)
- Provider `chatCompletion(body, path)` (concrete, e.g. venice.ts:22)

### Comprehensive Audit Produced
- `docs/AUDIT-COMPREHENSIVE-2026-06-14.md` (643 lines, 62/100 health, 7 new HIGHs, 38 page.tsx files, ~60K LOC)
- `docs/AUDIT-STREAMING-PLAYGROUND-AUTH-2026-06-14.md` (198 lines, 1 CRIT + 4 HIGH)

Both audit reports are persisted to disk. The user's re-asking of the audit is redundant — the reports exist.

### OpenCode Config Tuned
- `compaction.tail_turns`: 20 → 8
- `compaction.min_free_context_pct`: 5 → 25
- `tool_output.max_lines`: 2000 → 500
- `tool_output.max_bytes`: 50000 → 20000
- Compaction now fires at 75% not 95%

## Recent Commit Log
- `d4bb0fb` — fix(catalog): rebuild models.json from live Venice API (90 text + 5 video)
- `be3e109` — fix(catalog): align OMA model IDs with live Venice API, fix rate-limit MODEL_LIMITS, update copy to 91+ models
- `3f19003` — fix(content): reconcile UI model catalog with server
- `40ff150` — fix(security): x402 CRITICALs + deposit validation + CheapTokens fixes

## Gates
- Server tests: 72/73 files, 861/863 pass (2 pre-existing rate-limit.test.ts failures)
- App tests: 7/7 files, 81/81 pass
- Server typecheck: pass
- App typecheck: pass
- Server lint: pass
- App lint: pass

## Pending Tasks (prioritized)

### CRITICAL (continue uncommitted CRIT fix)
1. **Wire `c.req.raw.signal` from route → router → callProvider → provider chatCompletion**. Files to touch: `server/src/routes/chat/completions.ts`, `server/src/inference/router.ts:handleChatCompletion`, `server/src/inference/call-provider.ts:chatCompletion`, then each provider's `chatCompletion` signature (venice.ts, openrouter.ts, together.ts, deepinfra.ts, claude.ts, gemini.ts, surplus.ts, antseed.ts, litellm.ts, morpheus.ts). All 10 providers need the extra arg. **Cheapest path**: add optional 3rd param to all of them in one pass.

### HIGH (the 4 HIGH from streaming audit)
2. **Fix SSE parser** in `server/src/inference/stream-tracker.ts:130` and `app/src/app/playground/page.tsx:291-313`. Split on `\n\n` not `\n`, buffer partial lines across reads, handle multi-data events.
3. **Wire playground model dropdown to live Venice** (`app/src/components/playground/ChatMessage.tsx:48-66`). Currently stale 17-entry hardcoded array. Fetch from `/v1/models` on mount with 5min staleTime.
4. **Add system prompt UI** to playground. Add a SYSTEM field at top of message list, inject `{role: 'system', content: ...}` as first message.
5. **Fix siwe@3 + ethers webpack break** causing 5 protected pages to 500. Per AGENTS.md, ethers is in `app/package.json` deps. Verify `app/node_modules/ethers` exists and webpack barrel optimization doesn't strip it.

### MEDIUM
6. **Add `X-Accel-Buffering: no`** to router streaming response (router.ts:138-141).
7. **Fix 2 pre-existing test failures** in `server/src/middleware/__tests__/rate-limit.test.ts:51-58` (tests query `deepseek-r1`, `gpt-4o-mini`, `gpt-5.5`, `o3`, `phi-4-mini` but those keys are no longer in MODEL_LIMITS after the cleanup).
8. **Fix `compare/surplus-min-discount-routing`** — markets a broken feature. Either remove the page or add a "coming soon" notice.
9. **Fix landing FEATURED_MODELS provider logos** — wrong logos (Anthropic vs Venice).
10. **Fix deposit page duplicate Connect Wallet buttons** (audit C-5).
11. **Unify model count copy** — 5 different counts (18+/28+/30+/50+/91+) on 9+ pages.

### LOW
12. **Surplus x402 signer**: EIP-3009 + Permit2 + base64 header
13. **Lottie dead assets** wire or delete
14. **21st MCP UI/UX polish**
15. **Per-token model allowlist** (new-api, 4-6h)
16. **Redemption codes** (new-api, ~1d)

## Key File References (use to resume)
- `server/src/inference/base.ts:38-70` — CRIT abort signal fix, uncommitted
- `server/src/inference/stream-tracker.ts:130` — HIGH SSE parser
- `app/src/app/playground/page.tsx:291-313` — HIGH client SSE parser
- `app/src/components/playground/ChatMessage.tsx:48-66` — HIGH stale 17-entry MODELS
- `app/src/components/account-login-modal.tsx` — auth + ethers issue
- `app/src/middleware.ts:5` — PROTECTED_PATHS, causes 500
- `server/src/inference/router.ts:138-141` — MED X-Accel-Buffering
- `server/src/middleware/__tests__/rate-limit.test.ts:51-58` — 2 pre-existing failures
- `app/src/app/compare/surplus-min-discount-routing/` — markets broken feature
- `server/models.json` — 90 text + 5 video (committed as d4bb0fb)
- `app/src/lib/models-data.ts` — 17 UI models (deepseek-v3.2)
- `server/src/x402/facilitator.ts` — 4/6 CRITICAL fixed
- `server/src/inference/surplus.ts:303-311` — TRACKED ISSUE, provider disabled
- `server/src/inference/venice.ts:22` — Venice chatCompletion needs new 3rd param

## Dev Server State
- Server dev fails without Postgres (sandbox limitation)
- App dev starts but middleware 500s (need to clear .next/)

## Audit Reports (all in docs/)
- `AUDIT-COMPREHENSIVE-2026-06-14.md` — 62/100 health, 7 new HIGHs, 643 lines
- `AUDIT-STREAMING-PLAYGROUND-AUTH-2026-06-14.md` — 1 CRIT, 4 HIGH, 198 lines
- `AUDIT-X402-2026-06-14.md` — 6 CRITICAL, 7 HIGH
- `AUDIT-OPERATIONAL-MODEL-2026-06-14.md` — 3 wallets needed
- `AUDIT-SITE-PAGES-2026-06-14.md` — FIXED in 3f19003
- `AUDIT-SURPLUS-2026-06-14.md` — NOT viable, provider disabled
- `AUDIT-NEW-API-REFERENCES-2026-06-14.md` — frontend gap remains
- `AUDIT-PONYTAIL-CLEANUP-2026-06-14.md` — ~340 LOC removable

## Provider Call Chain (for the abort signal fix)
- `routes/chat/completions.ts` has `c.req.raw.signal` (Hono exposes it)
- Calls into `router.handleChatCompletion(body, c)` or similar
- `router.ts:handleChatCompletion` calls `callProvider(reqBody)`
- `call-provider.ts:chatCompletion` dispatches to `provider.chatCompletion(body, path)` 
- `base.ts:chatCompletionInternal(body, path, signal?)` (just added the 3rd param)
- Each concrete provider (venice.ts, openrouter.ts, etc.) needs the 3rd param threaded through

## Not Asked / Out of Scope
- Production deploy (out of code scope)
- Real Postgres setup (sandbox limitation)
- Real Venice/Surplus API keys (would need operator's credentials)
- Browser MCP for actual user flows (chrome-devtools not available in env)
