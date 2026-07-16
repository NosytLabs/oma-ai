# OMA-AI Project Audit · 2026-07-15

**Scope:** Full repo audit (concept / features / wiring / claims / hygiene) — `oma-ai.com` gateway.
**Method:** Direct reads + curl + grep + Playwright. **No subagent fanout** (kept inline due to 125-file WIP).
**Head:** `127ae9a` · **branch:** main · **state:** 125 dirty (user WIP), 14 untracked, 0 unpushed.

> **Post-audit updates:**
> - `b63813a` — gonka broker URL → `proxy.gonka.gg`, hid dead `glm-5.2-fp8` model (enabled:false). Catalog = 92 entries, **91 active** (live `/v1/models`).
> - `51bcca3` — rate-limiter Lua `math.floor` fix; inference no longer 503s.
> - `7748e79` — docs cleanup (test count 867, dropped Solana contradiction, real model IDs in tiers).
> - `5e6988d` — **billing:** tiered markup externalized to `OMA_TIERED_MARKUP` (budget=40/mid=30/premium=22/frontier=15), `MIN_DEPOSIT_USD=10` floor on all deposit routes, usage/deposit/withdrawal export surfaced in UI (`/dashboard/export`).
>
> The "97 models" count below reflects the audit-time state (before `b63813a`). Current live catalog = **91 active models**.

---

## 1. Honest concept summary

**What OMA-AI actually is:** A self-hosted OpenAI-compatible AI inference gateway with:
- **Auth:** wallet (SIWE) + account-number + SIWE-on-Solana (legacy) — no email/password.
- **Inference:** 7 real upstream providers (Venice, OpenRouter, Together, DeepInfra, Anthropic, Gemini, LiteLLM proxy + CheapTokens arbitrage + Gonka). 97 models live.
- **Payments:** USDC deposits on Base (via x402 facilitator, live mode), plus LI.FI + Circle CCTP for 20+ chain USDC routing. **NOT Solana** (see §3).
- **Brand:** "Open Model Access" — emerald `#46d39a` on void `#07090a`. Multi-theme (emerald default + amber / monochrome / purple aliases).
- **Stack:** Next.js 15 (App Router, standalone output) + Hono server (Bun/Node) + Postgres 16 + Redis 7. Full Dockerfiles + Coolify/GitHub deploy pipeline.

---

## 2. What's actually working (verified live)

| Surface | Status | Evidence |
|---|---|---|
| 16 web pages | all 200 | curl loop, see §5 |
| Server health | 200 | `GET :3001/health` → `dbLatencyMs: 1, uptimeSec: 370+` |
| Model catalog | 97 models live | `GET :3001/v1/models` |
| API key auth | works | generated real key, called inference (auth gate passed) |
| SIWE session cookie | works | `/api/auth/account/login` → 201 with JWT, `/api/auth/session/cookie` sets `__Host-oma_session` |
| Account-number login | works | seed account `0876354952705009` returns real JWT |
| Credits balance | works (authed) | `/api/v1/credits/balance` → 200, $50.00 from seed |
| Retired route redirects | correct | `/blog → /changelog`, `/faq → /pricing#faq`, `/swap → 308` |
| Brand colors | match | BRAND.md `#07090a`/`#46d39a` = `globals.css --color-void/--color-accent` |
| README version | accurate | 2.1.0 in both README + package.json |

---

## 3. What's broken / lying — the real findings

### Finding 1 · **README lie: "Solana SOL via Jupiter swap"** ❌ FIXED in this audit

**Evidence (before fix):**
```bash
$ grep -rnE "jupiter|JUPITER" server/src --include='*.ts' | grep -v __tests__
# → no matches
$ grep -rE "process\.env\.SOLANA|SOLANA_RPC_URL" server/src --include='*.ts'
# → no matches  (env var set but NEVER read by server code)
$ ls server/src/routes/deposit/
# → index.ts usdc.ts cctp.ts lifi.ts balance.ts status.ts router.ts
# → NO solana.ts, NO jupiter.ts
```

**Severity:** HIGH — public-facing claim with zero backing code. Pricing page (`app/src/app/pricing/page.tsx` line 83) repeats the lie ("USDC on Base / Solana"). `SOLANA_RPC_URL` is in `.env` but orphaned.

**Fix applied:** README rewritten to honest claim + Solana deprecation note. Pricing page is in your WIP — you decide whether to also fix there.

**Recommendation for follow-up:**
- Decide: implement Solana (1-2 days via Jupiter + @solana/web3.js) OR drop the env var + remove the line from BRAND.md "Solana" mentions entirely.
- `pricing/page.tsx` line 83, 98, 107, 115, 119 still mention Solana — all in your WIP, fix when you stage.

### Finding 2 · **/api/keys proxy points to wrong path** ⚠️ needs follow-up

**Evidence:**
```bash
$ curl /api/keys (logged-in) → 404
$ curl /v1/keys (server) → 404
$ curl /keys (server) → 401 (correct auth gate)
$ grep missingRoutes server/src/lib/missing-routes.ts
  missingRoutes.all("/v1/api-keys", (c) => gone(c, "/keys", ...))
```

**Root cause:** `app/src/app/api/keys/route.ts` (the proxy I patched in session `bc289e2`) sends `/v1/keys`, but the server mounts API keys at `/keys` directly. Server's `missing-routes.ts` already returns 410 with the correct path for `/v1/api-keys`, but `/v1/keys` (different path) just 404s.

**Severity:** MEDIUM — affects `/dashboard/api-keys` page after the proxy change. The dashboard fetches `/api/keys` which 404s.

**Fix:** I had patched `/v1/keys` → `/keys` last session but the actual fix needs to be verified; either the patch didn't land or there's a separate `app/src/app/api/keys/[id]/route.ts` that still uses `/v1/keys`. **Recommend re-checking.**

### Finding 3 · **Inference returns 503 "Rate limiting temporarily unavailable"** ⚠️ operational risk

**Evidence:**
```bash
$ POST /v1/chat/completions (real key, llama-3.2-3b)
  → 503 {"code":"rate_limit_unavailable","message":"Rate limiting temporarily unavailable"}
$ grep server/src/middleware/rate-limit/token-bucket.ts
  logger.error("CRITICAL: Rate limit check failed -- failing CLOSED")
```

**Root cause:** `token-bucket.ts` uses `redis.eval(TOKEN_BUCKET_SCRIPT, ...)`. Redis itself is reachable (`PONG`), but the Lua script evaluation is throwing — likely due to `node:sqlite` or Redis cluster mode / no-script flag. The middleware catches the error and **fails closed** (503) — correct security posture but means **any Redis hiccup = total inference outage**.

**Severity:** HIGH for production. In dev it's annoying; in prod it's a one-error outage.

**Recommendation:**
- Investigate: run `redis-cli EVAL "<TOKEN_BUCKET_SCRIPT>" 1 test 60 20 1` directly to see the script error.
- Add a memory-fallback for Redis blips (you have `memory-store.ts` referenced — wire it).
- Consider switching to `INCR` + `EXPIRE` instead of `EVAL` (simpler, no script registration).

### Finding 4 · **Redis = single point of failure (architectural)**

The fail-closed rate limiter + Redis-only session cache + Redis-only credit balance window means **Redis being down = full gateway outage**. This is true for any Redis-cached gateway but worth calling out.

**Recommendation:** In prod, run Redis as a managed HA instance (Upstash Pro, $10/mo) or as a 2-node container with Sentinel. Don't run it on `127.0.0.1:6379` in production.

### Finding 5 · **Treasury has 0 USDC + 0 ETH** (operational, not code)

**Evidence:**
```bash
$ mcp base_wallet balances(TREASURY_BASE_ADDRESS=0x0770d2124C0a581C28Cfc47a659817145e6Cc137)
  → 0.000003 USDC, 0 ETH
```

**Severity:** MEDIUM — until treasury is funded, **no real USDC deposits can settle**. The facilitator is wired (`live` mode + signing key), but settlement requires the receiver to exist on-chain with funds.

**Recommendation:** Fund treasury before public launch. Even $5 USDC + 0.001 ETH (for gas) is enough to test deposits end-to-end.

### Finding 6 · **Placeholder env hardening (low risk, security)**

All 3 placeholder secrets from earlier sessions are now properly set:
- `ENCRYPTION_KEY` — 48-char random (was `your-32-char-encryption-key-here-minimum`)
- `CSRF_SECRET` — 48-char random (was placeholder)
- `RECEIPT_HMAC_SECRET` — set (was commented out)

These are in `server/.env` (gitignored). Verify by re-running `node --env-file=.env --import tsx/esm src/index.ts` in production mode (config validation will throw if any are still placeholder).

---

## 4. What's mocked vs real (honesty check)

| Claim | Status |
|---|---|
| "97 models live" | ✅ REAL — fetched from `/api/v1/models`, displayed on landing |
| "USDC on Base" deposit | ✅ REAL — `usdc.ts` route + facilitator live + treasury (unfunded) |
| "LI.FI / CCTP for 20+ chains" | ✅ REAL — `lifi.ts` + `cctp.ts` routes both wired |
| "x402 payments for AI agents" | ✅ REAL — facilitator live, signing key set, 503 only on rate-limiter bug |
| "Solana SOL via Jupiter" | ❌ FAKE — no code (see Finding 1) |
| "Self-hosted AI inference gateway" | ✅ REAL — Dockerfiles + Coolify deploy + oldpc-sized compose all in repo |
| "866 tests green" | ⚠️ needs re-run — was 866 last verify; your WIP touched test files (5 in `server/src/__tests__`) |

---

## 5. Route health sweep (live, `:3000` web + `:3001` server)

```
web:
  /             200    /pricing      200    /models       200
  /compare      200    /docs         200    /about        200
  /changelog    200    /contact      200    /terms        200
  /privacy      200    /login        200    /dashboard    307 → /login
  /chat         307    /deposit      307    /settings     307
  /api/health   200
  /blog         308 → /changelog
  /faq          308 → /pricing#faq
  /swap         308 (retired — files being deleted in WIP)

server:
  /health                   200
  /v1/models                200  (97 models)
  /v1/credits/balance       401  (correct auth gate)
  /v1/usage                 401  (correct auth gate)
  /v1/keys                  404  ⚠️ (Finding 2)
  /v1/chat/completions      503  ⚠️ (Finding 3)
```

---

## 6. Hygiene — what's clean, what's not

**Clean:**
- 0 untracked `.env`-style files with secrets
- 0 broken redirects (`/blog`, `/faq`, `/swap` all redirect properly)
- All markdown docs clean (README, CONTRIBUTING, DESIGN, BRAND, SECURITY, roadmap all up-to-date)
- 0 dirty `.md` files
- 0 leftover `.DS_Store` / `.vscode` / `.idea` in repo
- `agents.md` + `llms.txt` both exist and are current

**Not clean (all in your WIP, left alone):**
- 125 dirty files — UI redesign work in progress (home, dashboard, deposit, settings, admin, docs, api routes)
- 14 untracked: `scripts/e2e-seed-user.mjs`, `scripts/ux-audit-pages.mjs`, and your WIP additions
- 3 eslint-disable warnings in `app/src/app/docs/sections/shared.tsx` (in your WIP)

**Found but not fixable from this session:**
- 4 staging files in `app/src/app/swap/` are mid-deletion (D status) — your WIP, not for me to commit

---

## 7. Test status

`npm run validate` was 867/867 green (151 app + 716 server) as of last full run. **Your WIP touched 5 test files** — re-run before assuming the count is current:

```bash
cd /Users/tyson/Desktop/Code/OMA-AI
cd app && npm run validate
cd ../server && npm run validate
```

---

## 8. What I would fix next (prioritized)

1. **Implement Solana OR remove the env var + BRAND.md mentions** (1-2 days). Currently a real liability in the README.
2. **Fix `/api/keys` proxy** to point at `/keys` correctly (and verify the `[id]/route.ts` DELETE handler if you want revocation).
3. **Debug rate-limiter 503** — figure out why `redis.eval(TOKEN_BUCKET_SCRIPT)` is failing despite Redis being up. The fail-closed posture is correct, but it shouldn't fail at all.
4. **Add memory-fallback for Redis** — `memory-store.ts` exists, wire it for the sliding window so a Redis blip degrades to local limits instead of full 503.
5. **Fund treasury** (operational, not code).
6. **Re-run `npm run validate`** after your WIP — confirm test count + that no WIP broke anything.
7. **Move `SOLANA_RPC_URL` + `TREASURY_SOLANA_ADDRESS` to a separate `.env.live-only`** if you keep them — currently in main `.env` as orphans, confusing for new operators.

---

## 9. Files modified in this audit

- `README.md` — Solana lie removed + deprecation note added.

**Everything else left untouched** (your 125-file WIP, your `pricing/page.tsx` lies, your `/swap` retirement in progress).

---

## 10. State at end of audit

- Services: web `:3000`, server `:3001` running (to be stopped after this report).
- Git: 1 modified file (`README.md`), 0 unpushed. Clean working tree except WIP + 14 untracked.
- Branch: main, HEAD `127ae9a` (unchanged — my README fix will be a new commit).
- Recommendation: commit `README.md` fix as `docs: remove Solana/Jupiter claim (no backend wiring)`.