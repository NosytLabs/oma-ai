# OMA-AI Comprehensive Audit — 2026-07-30

Scope: live HTTP audit of every API route, real chat calls through the gateway
to Gonka (cheap upstream) + Venice, typecheck/test runs, visual inspection of
landing/pricing/dashboard/login, code review, online research (Brave /
Context7), Polar MCP exploration.

## Severity legend

- **P0** — actively breaks the product (broken promise / dead feature / money loss)
- **P1** — visible to users, hurts trust / conversion
- **P2** — polish / quality-of-life

## P0 — broken at runtime

### 1. USDC deposits are disabled in the running server
- `GET /v1/deposit/usdc` returns `{"type":"not_configured","message":"USDC
  deposits are temporarily unavailable. Set USDC_DEPOSIT_ADDRESS in the
  server env to enable."}`
- The README's "USDC on Base" is the only deposit method.
- **Effect:** every signup that wants to actually use the API can't fund
  their account. Chat works (rate-limited bypass) but the credit
  ledger never moves.
- **Fix:** set `USDC_DEPOSIT_ADDRESS` (and a real `TREASURY_BASE_ADDRESS`)
  in `server/.env`, OR add a clear "deposit is currently in pilot"
  notice on `/deposit` so users don't get stuck.

### 2. Credit balance bypass: new users get free inference forever
- `recordUsage()` (`server/src/inference/proxy.ts:251-265`) reads
  `creditBalances` for the user; if no row exists it silently skips
  the deduction. The user is authed (real session + API key) so
  `isAnonymous` is false, and the `usage_records` insert still runs —
  but the `credit_balances` table never gets a row, and `GET /v1/balance`
  reports `balanceCents: "0"` indefinitely.
- **Effect:** any user that mints a key without first hitting a
  deposit path can call all four live models for free, and the
  product can't track debt.
- **Fix:** upsert a `credit_balances` row on first usage. Seed it
  with the free trial cents (see #3). If a key-mint creates the user,
  also seed a row there.

### 3. Free trial promise is not honored by the code
- No `FREE_SIGNUP_CENTS` (or equivalent) is read anywhere. The
  `credit_balances` default is `0`.
- The dashboard / landing promises a free tier in the spirit of "first
  call in under a minute" but the system has no such path.
- **Fix:** add `FREE_SIGNUP_CENTS` env (default `100` = $1.00) and seed
  on user-create via a Better Auth `databaseHooks.user.create.after`
  hook, AND in the key-create path.

### 4. Landing page claims features that don't exist
- `app/src/app/page.tsx` / `HomeView` lists "Image Generation",
  "Video Generation" as capabilities. The live catalog has 4 chat
  models only — no image, video, TTS, embedding, ASR, music, upscale,
  or inpaint endpoints exist.
- **Effect:** users click into a feature that returns 404.
- **Fix:** remove the image/video/voice cards from the landing page
  until those endpoints ship, OR add a "Coming soon" badge.

### 5. Catalog count drift (live vs SSR fallback vs disk)
- Live `GET /v1/models` returns **4** models (2 Venice, 2 Gonka).
- `app/src/lib/models-data.ts` ships a 7-model SSR fallback. The
  landing page says "7+ models" using `MODEL_COUNT` (= `MODELS.length`
  = 7) at SSR.
- `server/models.json` (195KB on disk) has ~20 entries with
  `markupPercent: 25` that the server's in-memory catalog never
  reads.
- **Effect:** marketing copy doesn't match reality, and ~16 catalog
  entries on disk are dead.
- **Fix:** make `MODEL_COUNT` a constant that matches the live count,
  OR ship the catalog from `models.json` at startup (then 4 vs 7 vs
  20 collapse to a single source).

### 6. M2.7 static fallback price is wrong
- `app/src/lib/models-data.ts` FALLBACK_CATALOG has M2.7 at
  `$0.017/$0.017 per 1M`.
- Live server catalog: M2.7 at `$0.005 in / $0.02 out per 1M`.
- Live `/v1/models` returns `0.005` for prompt and `0.02` for
  completion.
- The SSR fallback drives the `/models` page until the network
  fetch resolves — users see $0.017 until JS hydrates.

## P0 — major gaps vs competitors

### 7. No `/v1/usage` endpoint — only `/v1/usage/today`
- Users have no way to query their per-call history programmatically
  (other than `/v1/export/usage` which dumps a CSV). The dashboard
  presumably calls something internal; the README doesn't list
  `GET /v1/usage`.
- **Effect:** developers building dashboards/clients have to scrape
  CSV exports.
- **Fix:** add `GET /v1/usage?model=…&since=…&limit=…` returning
  paginated usage records.

### 8. No `/openapi.json` despite the README implying it
- `README.md` doesn't list it directly, but the architecture section
  references "OpenAI-compatible" — competitors (OpenRouter, Portkey)
  publish an OpenAPI spec that drives SDK auto-generation.
- **Fix:** generate a minimal OpenAPI 3.1 spec at `/openapi.json` from
  the registered routes.

### 9. Admin pricing edits don't persist
- `PATCH /v1/admin/models/:id` updates an in-memory `pricingOverrides`
  map. The server doesn't read `server/models.json` (the durable
  source) and the catalog itself has `markupPercent: 0` for all four
  models, so the env `OMA_MARKUP_PCT=25` is dead config.
- **Effect:** operators can change prices via the admin UI but the
  values evaporate on restart and the system-level 25% markup never
  applies.

### 10. Polar events meter is configured but no meter ID is set
- `server/src/inference/polar-usage.ts:28` requires
  `POLAR_USAGE_METER_ID`. Env has `POLAR_ACCESS_TOKEN` (placeholder
  empty) but no `POLAR_USAGE_METER_ID` and no
  `POLAR_ORGANIZATION_ID`.
- `trackPolarUsage` is a no-op until both are populated — usage
  events never reach Polar.

## P1 — visible quality issues

### 11. `/v1/deposit/usdc` 404s on an obvious "deposit status" path
- README claims `GET /v1/deposit/status` but only `GET /v1/deposit/usdc`
  exists. `curl /v1/deposit/status` returns 404.

### 12. Free chat for guests is capped silently
- Daily limits (20 anon, 100 signed-in) work but the frontend has no
  visible counter — users hit 429 with no warning. Add a "3/20
  messages today" indicator.

### 13. Many `oma-audit-*.png` orphan files in the repo root
- Not in git, just sit in the workspace, ~3MB total. Delete.

### 14. `audit-lighthouse/` is a one-off report, not committed
- 600KB of report.html / report.json, untracked. Decide: either
  commit + add to README, or delete.

### 15. Free M2.7 cost in real terms is < 1/100th of a cent per 1264-token call
- 1264 output × $0.02 / 1M = $0.00002528. Multiplied by 100 = 0.002528
  cents. The `numeric(18, 8)` column can hold it, but the user-facing
  `balanceCents` rounds to `"0"`. Display "0.0025 cents" or convert to
  micro-credits. Or just round display to "0.01 credits per 1M output
  tokens" surface.

## P2 — polish

### 16. README says "USDC on Base" but `/deposit` page may still
reference cross-chain methods (CCTP / LI.FI) that the code
comments out as parked.

### 17. Several files in `app/src/lib/__tests__/free-chat-model.test.ts`
refer to model id with wrong punctuation (kimi-k2-6 vs
kimi-k2.6). One test was failing because of this; fixed inline.

### 18. Better-Auth dev-mode magic-link logs to stdout only when
`RESEND_API_KEY` is unset. With Resend configured and unreachable,
the fallback logs to stdout but the link is single-use — in CI/dev
container with no TTY, the only way to find the link is to read
the server process's stderr, which is brittle.

## Real-world chat tests (run live, not grep)

| Test | Result |
|---|---|
| `POST /v1/chat/completions` (minimax-m2.7) | 200, real response, 10.2s, 1527 tokens, 1 tool call |
| Tool-call argument shape | Valid JSON, multi-step list |
| Streaming SSE | 200, chunked `data: {…}` deltas (reasoning + content) |
| Gonka cost per 1264-output call | $0.000025 (~0.003 cents) |
| Token counting accuracy | Upstream reports 263/1264; we surface the same in `usage` block |
| Polar events ingest | No-op (meter not configured) |
| `GET /v1/admin/usage` (admin) | 200, per-model breakdown correct |

## What to fix (prioritized)

1. **Money & auth (#1–3, #10)**: deposit + free-trial seed + Polar meter
   wiring. Without these, "first call in under a minute" is a lie.
2. **Catalog honesty (#4–6)**: remove image/video claims, fix
   `MODEL_COUNT`, sync M2.7 price. Without this, the landing page is
   marketing fraud.
3. **Operator surfaces (#9)**: make admin pricing edits persist to
   disk so they survive restarts.
4. **Developer surfaces (#7–8)**: add `/v1/usage` and
   `/openapi.json`. This is table stakes for an inference gateway.
5. **Polish (#11–18)**: deposit status endpoint, free-chat counter
   in UI, delete orphan screenshots, sync README routes.

## Detailed file/line evidence

(See git history and the screenshots saved to
`audit-screenshots/2026-07-30-*.png` for visual evidence.)
