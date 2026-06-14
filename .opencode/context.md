# OMA-AI — Session Context (2026-06-14, 14:43 ADT)

## Current Status

**Session goal:** Fix everything (LLM providers, streaming, playground, UI/UX, auth, admin, console errors, animations, lottie, 21st MCP, profitability) + comprehensive audit.

**Git state:** 5 commits this session (40ff150, 3f19003, be3e109, d4bb0fb, de13137). Working tree dirty: 23 files from 3 subagents + 2 audit reports staged, NOT YET COMMITTED.

### 3 Subagents Just Completed (NOT YET COMMITTED)

**1. Abort signal wiring (ses_138cf57d9ffevMKEhSE2FPmYeV) — DONE**
- Threaded `c.req.raw.signal` from 3 routes through router, call-provider, and 10 providers
- Files: `server/src/routes/chat/{chat-completions,completions}.ts`, `chat-ws/index.ts`, `inference/router.ts`, `inference/call-provider.ts`, `inference/{base,venice,openrouter,together,deepinfra,antseed,litellm,morpheus,claude,gemini,surplus}.ts`
- Conditional: passes signal only when defined (keeps 1-arg test matchers in call-provider.test.ts green)
- New conditional: `signal !== undefined ? fn(reqBody, signal) : fn(reqBody)` in all 10 dispatch sites
- Added `expect.any(AbortSignal)` to inference.test.ts:410
- WS: created local AbortController, `ws.once("close", () => ac.abort())`, passed `ac.signal`
- Typecheck: PASS. Tests: 72/73 files, 861/863 (1 pre-existing rate-limit.test.ts failure)

**2. SSE parser fix (ses_138cf3023ffeyEDBrdRtKKVfDl) — DONE**
- `server/src/inference/stream-tracker.ts`: added `parseSSEBlock` helper, rewrote loop to split on `\n\n` with `\n` fallback, extracts `processData` + `handleBlock` closures, flushes trailing partial event at EOF
- `app/src/app/playground/page.tsx`: same pattern client-side
- Typecheck: PASS. Tests: 11/11 SSE tests + 81/81 app pass. 3 unrelated server failures (rate-limit, inference routing) pre-exist

**3. Playground model dropdown + system prompt (ses_138cf08a2ffeYj5lOsNONcLnZI) — DONE**
- Renamed hardcoded `MODELS` → `FALLBACK_MODELS` in ChatMessage.tsx
- Added `useLiveModels()` hook: calls `GET /v1/models` on mount, 5min module-level cache, async upgrade from sync fallback
- ModelSelector, MessageInput, SettingsPanel all switched to `useLiveModels()`
- Added persistent system prompt UI: collapsible block at top of `<main>`, `SYSTEM_PROMPT_KEY` localStorage, auto-opens if previously set
- In `sendMessage`: prepend `{role:'system', content:systemPrompt.trim()}` BEFORE web-search branch (user system stays first)
- Typecheck: PASS. Tests: 7/7 files, 81/81

### Uncommitted Working Tree (23 files)
- app/src/{app/playground/page, components/playground/{ChatMessage,ModelSelector,MessageInput,SettingsPanel}}.tsx
- server/src/__tests__/inference.test.ts
- server/src/inference/{base,call-provider,router,stream-tracker,venice,openrouter,together,deepinfra,antseed,litellm,morpheus,claude,gemini,surplus}.ts
- server/src/routes/chat/{chat-completions,completions}.ts
- server/src/routes/chat-ws/index.ts
- docs/AUDIT-{COMPREHENSIVE,STREAMING-PLAYGROUND-AUTH}-2026-06-14.md

### Gates Status (last verified)
- Server typecheck: PASS
- App typecheck: PASS
- Server lint: PASS
- Server tests: 72/73 files, 861/863 (1 pre-existing failure)
- App tests: 7/7 files, 81/81

### OpenCode Config Tuned
- `compaction.tail_turns`: 20 → 8
- `compaction.min_free_context_pct`: 5 → 25 (fires at 75%, was 95%)
- `tool_output.max_lines`: 2000 → 500
- `tool_output.max_bytes`: 50000 → 20000

## Recent Commit Log
- `de13137` — fix(perf): thread requestSignal into upstream calls (base.ts only)
- `d4bb0fb` — fix(catalog): rebuild models.json from live Venice API
- `be3e109` — fix(catalog): align OMA model IDs with live Venice API
- `3f19003` — fix(content): reconcile UI model catalog with server
- `40ff150` — fix(security): x402 CRITICALs + deposit validation + CheapTokens fixes

## Pending Tasks

### IMMEDIATE (commit, uncommitted work at risk)
1. **Commit 23 files**: abort signal wiring (22 files) + playground model dropdown + system prompt (5 files) + 2 audit reports. Should be 2 commits: (a) backend abort signal + SSE parser + audit reports, (b) frontend playground + system prompt.

### HIGH (remaining from streaming audit + comprehensive audit)
2. **Fix siwe@3 + ethers webpack break** — causing 5 protected pages to 500. Per AGENTS.md, ethers must stay in app/package.json. Verify `app/node_modules/ethers` exists and webpack barrel optimization doesn't strip it. May need to add `serverComponentsExternalPackages: ["ethers"]` in next.config or webpack `resolve.alias`.
3. **Fix `compare/surplus-min-discount-routing` page** — markets a broken feature (Surplus provider is disabled, EIP-712 signer broken). Either remove the page or add a "coming soon" notice.
4. **Add `X-Accel-Buffering: no`** to router streaming response (router.ts:138-141) to prevent nginx buffering.
5. **Fix production API URL** — 16+ hardcoded references to `https://api.oma-ai.com/v1` returning 404. Either deploy or change to working URL.
6. **Fix landing FEATURED_MODELS provider logos** — wrong logos (Anthropic vs Venice).

### MEDIUM
7. **Fix 2 pre-existing test failures** in `server/src/middleware/__tests__/rate-limit.test.ts:51-58` (tests query `deepseek-r1`, `gpt-4o-mini`, `gpt-5.5`, `o3`, `phi-4-mini` but those keys are no longer in MODEL_LIMITS).
8. **Fix deposit page 2 different "Connect Wallet" buttons** (audit C-5).
9. **Unify model count copy** — 5 different counts (18+/28+/30+/50+/91+) on 9+ pages.
10. **Surplus x402 signer**: EIP-3009 + Permit2 + base64 header. Currently disabled.
11. **Lottie dead assets** wire or delete (`lottie-404.json`, `lottie-playground-loader.json`).
12. **21st MCP UI/UX polish**: layouts, animations, lottie, real logos.

### LOW
13. **Per-token model allowlist** (new-api pattern, 4-6h)
14. **Redemption codes** (new-api pattern, ~1d)
15. **Drop OMA token references** from /terms, /crypto-payments, price-guard.ts
16. **Footer "last deploy" hardcoded** — wire to actual deploy SHA

## Key File References (use to resume)
- 23 uncommitted files (see "Uncommitted Working Tree" above)
- `app/src/middleware.ts:5` — PROTECTED_PATHS, causes 500 (siwe/ethers issue)
- `app/src/app/compare/surplus-min-discount-routing/` — markets broken feature
- `server/src/inference/router.ts:138-141` — needs X-Accel-Buffering
- `server/src/middleware/__tests__/rate-limit.test.ts:51-58` — 2 pre-existing failures
- `app/src/app/deposit/page.tsx` — duplicate Connect Wallet buttons
- `server/models.json` — 90 text + 5 video (committed as d4bb0fb)
- `app/src/lib/models-data.ts` — 17 UI models (deepseek-v3.2)
- `server/src/x402/facilitator.ts` — 4/6 CRITICAL fixed
- `server/src/inference/surplus.ts:303-311` — TRACKED ISSUE, provider disabled

## Dev Server State
- Server dev fails without Postgres (sandbox limitation)
- App dev starts but middleware 500s (need to clear .next/)

## Audit Reports (all in docs/)
- `AUDIT-COMPREHENSIVE-2026-06-14.md` — 62/100 health, 7 new HIGHs, 643 lines
- `AUDIT-STREAMING-PLAYGROUND-AUTH-2026-06-14.md` — 1 CRIT, 4 HIGH, 198 lines
- `AUDIT-X402-2026-06-14.md` — 6 CRITICAL, 7 HIGH
- `AUDIT-OPERATIONAL-MODEL-2026-06-14.md` — 3 wallets needed
- `AUDIT-SITE-PAGES-2026-06-14.md` — FIXED
- `AUDIT-SURPLUS-2026-06-14.md` — NOT viable, provider disabled
- `AUDIT-NEW-API-REFERENCES-2026-06-14.md` — frontend gap remains
- `AUDIT-PONYTAIL-CLEANUP-2026-06-14.md` — ~340 LOC removable

## Not Asked / Out of Scope
- Production deploy (out of code scope)
- Real Postgres setup (sandbox limitation)
- Real Venice/Surplus API keys (would need operator's credentials)
- Browser MCP for actual user flows (chrome-devtools not available in env)
