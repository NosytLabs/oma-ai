# OMA-AI — Session Context (2026-06-14, 13:54 ADT)

## Current Status

**Session goal:** Fix everything — LLM provider debugging, streaming, playground, UI/UX, auth, admin, console errors, animations, lottie, 21st MCP logos, profitability, site functionality.

**Git state:** 2 commits this session (40ff150, 3f19003). Working tree dirty from catalog fix subagent.

### Live Research Completed (firecrawl + context7)
**CheapTokens:** x402 USDC on Base, keys expire midnight UTC daily, OpenAI-compatible via `api.venice.ai/api/v1`.
**Venice:** 91 text models, 99 video models, OpenAI-compatible, supports streaming, multimodal, x402 wallet auth.
**Surplus Intelligence:** x402 v2 with Permit2 (`upto`) and EIP-3009 (`exact`), `PAYMENT-SIGNATURE` header is **base64-encoded JSON**.

### CRITICAL Production Bug Found
**The live Venice API has 91 text models. OMA catalog has 11+ broken IDs.** Comparison:
- OMA has `claude-sonnet-4` → Venice has `claude-sonnet-4-5`/`4-6`
- OMA has `claude-opus-4` → Venice has `claude-opus-4-5/6/7/8`
- OMA has `gemini-2.5-pro` → Venice has `gemini-3-1-pro-preview`
- OMA has `gpt-4o-mini` → Venice has `openai-gpt-4o-mini-2024-07-18`
- OMA has `deepseek-v3` → Venice has `deepseek-v3.2`
- **Every chat call to Venice currently fails with model-not-found.**

### Subagent Fixes Applied (task ses_139048892ffe6XQ7q0Yv47pmV3)
Subagent fixed FALLBACK_MODELS + UI catalog + rate-limit MODEL_LIMITS:
- Renamed `deepseek-v3` → `deepseek-v3.2` everywhere
- Removed 28 fictional model IDs from `server/src/middleware/rate-limit/utils.ts`
- Replaced "17+ / 19+ / 50+ / 30+ / 28+ / 32+" with "91+" across 22+ files (page.tsx, about, faq, compare, docs, layout, pricing, models, opengraph-image, llms.txt, __tests__, openapi.ts, morpheus.ts, .env.example, docs/*.md)
- All typecheck + 81/81 app tests PASS

### CRITICAL Out-of-Scope Finding (subagent flagged)
**`server/models.json` (34KB on disk) overrides FALLBACK_MODELS at runtime!**
- `models.ts:402` — `MODEL_CATALOG = parsed.MODEL_CATALOG || FALLBACK_MODELS`
- models.json has 51 entries, many with WRONG Venice IDs (`deepseek-v3`, `deepseek-r1`, `qwen3.5-8b`, `llama-3.2-1b`, `anthropic/claude-3-5-sonnet`, `openai/gpt-4o-mini`, `meta-llama/*:free/budget` suffixes — those are OpenRouter IDs not Venice)
- **This is the ACTUAL cause of the production outage.** The subagent only fixed FALLBACK_MODELS, not the on-disk JSON.
- Verified: 51 entries in models.json; many veniceId fields like `deepseek-v3`, `llama-3.2-1b`, `qwen/qwen3-coder-32b:budget` don't exist in Venice's live catalog

## Current Working Tree State

Untracked: `server/models.json` was never committed. It lives in the repo but is gitignored? Need to check.

Subagent changes (uncommitted):
- `server/src/inference/models.ts` — deepseek-v3 → deepseek-v3.2
- `server/src/middleware/rate-limit/utils.ts` — removed 28 fictional IDs
- `app/src/lib/models-data.ts` — deepseek-v3 → deepseek-v3.2
- 22+ files: marketing copy "91+ models"

## Pending Tasks

### CRITICAL (just discovered — production outage cause)
1. **Fix `server/models.json`** — 51 entries with wrong Venice IDs. This is what the server actually loads. The on-disk file is the real source of truth that overrides FALLBACK_MODELS. Need to rebuild from live Venice catalog.

### HIGH (user explicitly asked)
2. **Debug streaming**: verify `POST /v1/chat/completions` with `stream: true` works with Venice. Check `server/src/inference/venice.ts` stream handling, SSE parsing, abort signals.
3. **Playground/chat fix**: `app/src/app/playground/page.tsx` + `app/src/components/playground/*` — check params, model selection, message rendering, no UI confusion.
4. **Auth flow**: account number login → dashboard tabs. `app/src/app/login/page.tsx`, `account-login-modal.tsx`, `dashboard/*`.
5. **Admin login + tabs**: same for `/admin/*`.
6. **Console error sweep**: all 21 pages.
7. **Next.js middleware 500s**: clear `app/.next/` and restart, or fix module resolution.
8. **21st MCP UI/UX**: pull design inspiration, audit layouts, animations, lottie polish.
9. **Lottie/animation audit**: check 2 dead lotties (lottie-404.json, lottie-playground-loader.json), fix FeaturedX402Lottie.
10. **Profitability**: verify `OMA_MARKUP_PCT=25` is correct vs real Venice costs.

### MEDIUM
11. **Surplus x402 signer**: implement EIP-3009 TransferWithAuthorization (exact) and Permit2 PermitWitnessTransferFrom (upto), base64-encode header.
12. **Add per-token model allowlist** (new-api pattern, 4-6h)
13. **Add redemption codes** (new-api pattern, ~1d)
14. **Add wallet-replenishment job for SURPLUS_WALLET_PRIVATE_KEY**
15. **Add cron for CheapTokens auto-refresh**

### LOW
16. **Drop OMA token references** from /terms, /crypto-payments, price-guard.ts
17. **Footer "last deploy" hardcoded** — wire to actual deploy SHA

## Key File References (use to resume)

- `server/src/inference/models.ts:402` — `MODEL_CATALOG = parsed.MODEL_CATALOG || FALLBACK_MODELS` (models.json override)
- `server/models.json` (34KB) — 51 entries, MANY wrong Venice IDs, overrides FALLBACK_MODELS at runtime
- `server/src/inference/venice.ts` — Venice provider, check stream handling
- `server/src/inference/cheaptokens.ts` — auto-buy, recently fixed
- `server/src/inference/surplus.ts:303-311` — TRACKED ISSUE, provider disabled
- `app/src/app/playground/page.tsx` + `app/src/components/playground/*` — chat UI
- `app/src/app/login/page.tsx` + `app/src/components/account-login-modal.tsx` — auth
- `app/src/app/dashboard/*` — user dashboard tabs
- `app/src/app/admin/*` — admin tabs
- `app/src/middleware.ts` — broken, 500s on protected pages
- `app/src/lib/models-data.ts` — 17 real models (renamed deepseek)
- `server/src/x402/facilitator.ts` — x402, 4 of 6 CRITICAL fixes applied
- `server/src/credits/deposit.ts` — security fixed
- `server/src/middleware/rate-limit/utils.ts:13-50` — 28 fictional IDs removed by subagent
- `app/src/app/models/page.test.tsx:55` — test expects "Claude Opus 4"

## Live Venice Ground Truth (91 text models)
Confirmed live at `https://api.venice.ai/api/v1/models?type=text`:
- aion-labs-aion-2-0, arcee-trinity-large-thinking
- claude-opus-4-5/6/7/8 (with -fast variants), claude-sonnet-4-5/4-6
- deepseek-v3.2, deepseek-v4-flash, deepseek-v4-pro
- gemini-3-1-pro-preview, gemini-3-5-flash, gemini-3-flash-preview
- google-gemma-3-27b-it, google-gemma-4-26b-a4b-it, google-gemma-4-31b-it, gemma-4-uncensored
- grok-4-20, grok-4-20-multi-agent, grok-4-3, grok-build-0-1
- kimi-k2-5, kimi-k2-6
- llama-3.2-3b, llama-3.3-70b
- minimax-m25, minimax-m27, minimax-m3, minimax-m3-preview
- openai-gpt-4o-2024-11-20, openai-gpt-4o-mini-2024-07-18
- openai-gpt-52, gpt-52-codex, gpt-53-codex, gpt-54, gpt-54-mini, gpt-54-pro, gpt-55, gpt-55-pro
- qwen3-235b-a22b-instruct-2507, qwen3-235b-a22b-thinking-2507
- qwen3-5-35b-a3b, qwen3-5-397b-a17b, qwen3-5-9b
- qwen3-6-27b, qwen3-coder-480b-a35b-instruct-turbo, qwen3-next-80b, qwen3-vl-235b-a22b
- venice-uncensored-1-2, venice-uncensored-role-play
- zai-org-glm-4.6, zai-org-glm-4.7, zai-org-glm-4.7-flash, zai-org-glm-5, zai-org-glm-5-1
- nvidia-nemotron-3-nano-30b-a3b, nvidia-nemotron-3-ultra-550b-a55b, nvidia-nemotron-cascade-2-30b-a3b
- mistral-small-2603, mistral-small-3-2-24b-instruct
- 91 total text models + 99 video models

### Video models (99 total, examples)
- grok-imagine-text-to-video (IS REAL — audit was wrong)
- kling-v3-pro-text-to-video, kling-v3-standard-text-to-video
- kling-o3-pro-text-to-video, kling-o3-standard-text-to-video
- seedance-2-0-text-to-video, seedance-1-5-pro-text-to-video
- sora-2-text-to-video, sora-2-pro-text-to-video
- veo3.1-full-text-to-video, veo3.1-fast-text-to-video
- vidu-q3-text-to-video, vidu-q3-image-to-video
- wan-2-7-text-to-video, wan-2-6-text-to-video
- runway-gen4-turbo, runway-gen4-aleph
- pixverse-v5.6-text-to-video, ltx-2-full-text-to-video

## Recent Commit Log
- `3f19003` — fix(content): reconcile UI model catalog with server — remove 28 fakes, fix model counts
- `40ff150` — fix(security): x402 CRITICALs + deposit validation + CheapTokens fixes
- `497b209` — test(app): mock lottie-react + update pricing filter test for new model names
- `d5fc207` — chore: delete dead code

## Audit Reports (all in docs/)
- `AUDIT-X402-2026-06-14.md` — 6 CRITICAL, 7 HIGH, 9 MEDIUM, 8 LOW
- `AUDIT-OPERATIONAL-MODEL-2026-06-14.md` — 3 wallets needed, not 1
- `AUDIT-SITE-PAGES-2026-06-14.md` — 5 pages 500, 28 fictional models (FIXED in 3f19003)
- `AUDIT-SURPLUS-2026-06-14.md` — NOT viable, 3 P0 breaks (provider disabled in 40ff150)
- `AUDIT-NEW-API-REFERENCES-2026-06-14.md` — backend patterns adopted, frontend gap remains
- `AUDIT-PONYTAIL-CLEANUP-2026-06-14.md` — ~340 LOC removable, 5 HIGH security fixes

## Dev Server State
- Server dev fails without Postgres (sandbox limitation)
- App dev starts but middleware 500s (need to clear .next/)

## Not Asked / Out of Scope
- Production deploy (CRITICAL-1 from prior session, still out of code scope)
- Real Postgres setup (sandbox limitation)
- Real Venice/Surplus API keys (would need operator's credentials)
- Browser MCP for actual user flows (chrome-devtools not available in env)
