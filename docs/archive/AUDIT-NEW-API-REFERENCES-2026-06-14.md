# Audit: OMA-AI vs. one-api / new-api — UI/UX & Code Pattern Reference

**Date:** 2026-06-14
**Auditor:** opencode Commander (read-only)
**Scope:** Identify useful UI/UX, admin, user-dashboard, pricing, and routing-transparency patterns from `songquanpeng/one-api`, `Calcium-Ion/new-api`, and `QuantumNous/new-api` that OMA-AI might adopt. Cite file paths. No code changes.

---

## 0. Existing OMA-AI references to these projects

Found via `rg "one-api|new-api|songquanpeng|Calcium-Ion|QuantumNous"`:

| File | Line | Note |
|------|------|------|
| `server/src/inference/affinity.ts` | 4-5 | "Cherry-picked from new-api/controller/channel_affinity_cache.go" — OMA's provider affinity already borrows from new-api |
| `server/src/inference/vendor-meta.ts` | 5 | "Inspired by new-api's `controller/vendor_meta.go`" |
| `server/src/db/migrations/0024_provider_affinity.sql` | 2 | "Cherry-picked from new-api/controller/channel_affinity_cache.go pattern" |
| `server/src/db/migrations/0025_audit_action_provider_test.sql` | 2 | Cherry-picked from new-api's channel-test pattern |
| `server/src/routes/admin/provider-test.ts` | 4 | "Operator-only 'channel test' — analogous to new-api's controller/channel-test.go" |
| `server/src/routes/admin/provider-usage.ts` | 5 | new-api's `controller/channel-billing.go` (14KB) per-channel reference |
| `.opencode/unit-tests/2026-06-14T08-00Z-v6-audit-summary.md` | 45-46 | Lists **OIDC auth** and **Audio API** as "Concept from new-api, not implemented yet" |

**Conclusion:** OMA-AI has already cherry-picked new-api's *backend* patterns (affinity, channel-test, billing). It has **not** cherry-picked the *frontend* admin patterns. That's the gap this audit addresses.

---

## 1. Project comparison snapshot

| Project | Lang | License | Stars (approx, 2026) | Positioning |
|---------|------|---------|----------------------|-------------|
| `songquanpeng/one-api` | Go + React | MIT | ~17k | Minimalist LLM gateway, original |
| `Calcium-Ion/new-api` | Go + React | AGPLv3 | ~7k | Heavily-extended fork, Discord/Telegram/OIDC, multi-modal |
| `QuantumNous/new-api` | Go + React | AGPLv3 | ~3k | "Horizon" perf fork of Calcium-Ion |
| **OMA-AI** | Hono + Next.js | (proprietary) | n/a | **Crypto-native wallet-first wallet-funded inference gateway** |

Key new-api UX features (from `docs.newapi.pro` + README):
- **Channel (provider) list with weights, response time, balance** — admin sees every upstream channel's cost/balance in real time
- **Per-token model restrictions** — admin can set "this token can only call these N models"
- **Token grouping + group-specific markups** — different user tiers pay different multipliers
- **User invitation rewards** — inviter gets bonus credits when invitee signs up
- **Redemption codes (兑换码)** — batch-generated, exportable, single-use credit vouchers
- **Announcement banner** — operator pushes site-wide notice (HTML/Markdown)
- **Channel test endpoint** — admin can ping a channel with a test prompt
- **Login options**: email, GitHub OAuth, Feishu, WeChat, OIDC, LinuxDO, Discord, Telegram
- **Custom branding**: site name, logo, footer, about-page HTML via env vars
- **Cache-hit billing ratio** (0-1 per channel) — prompt-cache hits billed at fractional rate

---

## 2. WORTH ADOPTING (3-5 items, high value)

### A. **Redemption codes / prepaid vouchers** — high value
- **What new-api/one-api do:** Admin page "兑换码" lets operator batch-generate codes (`OMA-XXXX-XXXX-XXXX`), export CSV, set face value, expiry, max-uses. Users redeem at `/redem` and credits appear.
- **OMA-AI today:** Only direct USDC deposit (`server/src/credits/deposit.ts` + `app/src/app/deposit/page.tsx`). No voucher mechanic.
- **Why it fits:** OMA is positioned as x402 + crypto-native. Gift cards and pre-paid vouchers are the single most common onboarding flow for crypto gateways (think: "buy a $10 OMA credit card with USDC, give it to a friend who isn't on Base yet"). A $25 redemption code is a simpler purchase than "set up a wallet, bridge USDC, sign a tx."
- **Value:** Enables (a) marketing promos (contest prizes), (b) enterprise procurement (single-invoice vouchers for 50 seats), (c) gift-onboarding without forcing recipient to be wallet-ready.
- **Minimum change:** ~1 new table (`redemption_codes`), 2 admin routes (`POST /v1/admin/codes/batch`, `GET /v1/admin/codes`), 1 public route (`POST /v1/credits/redeem`), 1 new page `/redeem?code=...`. ~300 LOC server, ~200 LOC admin UI. Schema pattern: `codes.code_hash`, `codes.value_cents`, `codes.max_uses`, `codes.expires_at`, `redemptions.user_id`, `redemptions.code_id`, `redemptions.credited_at`.
- **Complexity:** low. 1 day.
- **Skip if:** not relevant (operator doesn't run promos / B2B).

### B. **Per-token model allowlist** — high value
- **What new-api/one-api do:** Token-edit modal has a multi-select "allowed models" list. Token with no list = can call any model. Token with list = can only call those.
- **OMA-AI today:** Tokens are unlimited in scope (`server/src/routes/api-keys.ts`, no per-key model restrictions). Any valid key can call any model. A compromised key has full access.
- **Why it fits:** OMA's tokens live forever (no expiry on key itself), and a leaked key = a wallet-funded cost vector. Per-key model allowlist is a 5-minute blast-radius reduction that's also a compliance requirement for many B2B users ("the dev team can only use Claude Haiku, not Opus").
- **Value:** Security + compliance. Two birds, one field.
- **Minimum change:** `api_keys.allowed_models TEXT[] NULL` (Drizzle migration), `createApiKey` accepts optional `allowedModels`, `chat/completions` middleware does `if (allowedModels && !allowedModels.includes(req.body.model)) throw 403`. Admin dashboard: column on `/admin` Keys tab, edit modal. User dashboard: dropdown on "Create key" form. ~150 LOC total.
- **Complexity:** low. 4-6 hours.

### C. **User invitation / referral system** — high value
- **What one-api does:** Each user has a unique `invite_code`. New user signs up with `?invite=XYZ` and both inviter + invitee get a credit bonus (operator-configurable). Admin sees total invites per user.
- **OMA-AI today:** No invite flow. Auth is SIWE-only (`app/src/components/wallet-provider.tsx`); no concept of "who referred you."
- **Why it fits:** Wallet-first auth means new users can self-sign-up with no friction — but a referral bonus converts a one-time signup into a growth loop. 25% bonus on first $10 deposit is a 2.50 CAC that's likely well below the LTV of an active inference user.
- **Value:** Growth. Wallet platforms (Phantom, Rainbow, MetaMask) have all proven invite loops work.
- **Minimum change:** `users.invited_by_user_id`, `users.invite_code`, `credit_ledger` rows for both sides on first deposit, `/login?invite=XYZ` query-string capture in `wallet-provider.tsx` (line 165-199 SIWE flow). Admin column in `admin/users/[id]/page.tsx`. ~200 LOC.
- **Complexity:** low-medium. 1-2 days (needs careful "self-referral is not allowed" guard).

### D. **Provider-channel weighted-random admin UI** — medium value
- **What new-api does:** Admin "Channels" page lists every provider (one row per upstream API key) with: name, base URL, model list, **weight slider** (1-100), status (enabled/disabled), test-button. Channel test = `POST /v1/channel/test/:id` sends a test prompt and shows latency/error.
- **OMA-AI today:** Server has `inference/affinity.ts` + `db/migrations/0024_provider_affinity.sql` (server-side weighted routing, cherry-picked from new-api per code comment). **No admin UI to manage weights** — operator must edit DB.
- **Why it fits:** The backend is already there. The admin can't see or tune it. The current 25% markup is global; per-provider markups (e.g., weight Venice=70, OpenRouter=30) is the kind of thing operators do weekly.
- **Value:** Operational visibility + the missing frontend for an already-implemented backend.
- **Minimum change:** New admin page `/admin/channels` (or tab on existing `/admin`). List view + edit modal + "Test" button. Reuse `server/src/routes/admin/provider-test.ts` (already exists per file listing). ~400 LOC admin UI.
- **Complexity:** medium. 2-3 days.

### E. **Cache-hit billing ratio** — low-medium value (defer to v6)
- **What new-api does:** `Channel → Edit → Extra Settings → Prompt Cache Ratio = 0.5` means cache hits bill at 50% of normal. Admin sets per-channel.
- **OMA-AI today:** OMA does not differentiate cache-hit vs cache-miss in `usage_records` (`server/src/db/schema.ts` `usage_records.costCents` is flat). Anthropic, OpenAI, DeepSeek all return `cache_read_input_tokens` separately.
- **Why it fits:** Cache hits are 80-90% cheaper upstream. If OMA doesn't bill them differently, either OMA overcharges (margin) or undercharges (loss). This is real money at scale.
- **Value:** Margin accuracy. Critical once OMA is at $Xk MRR.
- **Minimum change:** Add `usage_records.cache_read_tokens INT` + `usage_records.cache_write_tokens INT`, parse provider responses in `call-provider.ts`, add admin default ratio to `fees` page, surface "saved X% via cache" on user dashboard. ~250 LOC.
- **Complexity:** medium. 2 days (must verify each adapter reports cache fields).

---

## 3. SKIP FOR NOW (low value or too much work for OMA's positioning)

| Pattern | Why skip |
|---------|----------|
| Email + password login | OMA is wallet-first; adding email auth contradicts the SIWE-only brand. |
| GitHub / Discord / Telegram / LinuxDO OAuth | OMA-AI is crypto-native. Wallet = identity. Adding OAuth for "social login" is a different product. |
| OIDC unified auth | Listed in v6-audit-summary as "concept from new-api, not implemented yet." Real OIDC integration = 2-3 weeks of work + IdP setup. Defer until a specific B2B customer requires it. |
| Multi-language (zh-CN, ja, fr) | OMA's audience is English + crypto-native. i18n infra is YAGNI. Add `next-intl` if a customer asks. |
| Midjourney / Suno / Realtime / Rerank / Audio / Video proxy | OMA is focused on chat inference. Adding modality support is a separate product line, not a UX gap. |
| Multi-machine deployment (master/slave + SYNC_FREQUENCY) | Single-instance is fine until ≥ $5k/mo infra spend. The `SESSION_SECRET` env-var story is documented but not built. |
| Custom branding (HTML/Markdown about page) | OMA-AI is a single product, not a white-label. |
| Suno, Midjourney-Proxy credit accounting | Different domain, no OMA-AI equivalent. |
| 兑换码-style "Channel Group" / "User Group" multipliers | OMA's pricing is global markup (10% per `llms.txt:91`). Per-group multipliers are a billing-system rewrite. |
| `ENABLE_METRIC` (auto-disable channel by success rate) | OMA has `circuit-breaker.ts` server-side (`server/src/inference/circuit-breaker.ts`). UI is overkill for an automatic system. |

---

## 4. ALREADY DONE WELL (what OMA-AI has that new-api/one-api lack)

| OMA-AI feature | Where | new-api equivalent |
|----------------|-------|---------------------|
| **Crypto-native deposit (USDC, HoudiniSwap, x402)** | `app/src/app/deposit/page.tsx`, `server/src/credits/deposit-router.ts`, `server/src/x402/crosschain.ts` | new-api has Stripe + EPay only. No native crypto, no gasless x402. |
| **Wallet-first SIWE auth (no email/password)** | `app/src/components/wallet-provider.tsx` lines 165-199 | new-api is email + GitHub OAuth + 5 other SSO. |
| **x402 pay-per-request (gasless)** | `server/src/x402/facilitator.ts` 818-line file, EIP-3009 atomic units | No equivalent. new-api is pre-paid credit only. |
| **Discount-floor transparency (structured 422 on Surplus failure)** | `app/src/app/compare/surplus-min-discount-routing/page.tsx:55`, `server/src/inference/surplus.ts` | new-api has no such concept — just routes to cheapest channel. |
| **Per-model capability badges (reasoning, coding, multimodal, uncensored)** | `app/src/lib/prices.ts` Capability type, `app/src/app/models/page.tsx:46-68` | new-api `/models` is a flat list. No capability chips. |
| **Inline cost estimate on playground input** | `app/src/app/playground/page.tsx:534` CostEstimate component, `app/src/components/playground/MessageInput.tsx` | new-api playground shows token count but not USD cost as you type. |
| **Live provider health card on user dashboard** | `app/src/components/dashboard/ProviderHealthCard.tsx` (DB + Redis + Venice) | new-api status page is operator-only, not on user dashboard. |
| **Strict cost/markup separation in DB** | `app/src/app/llms.txt/route.ts:91`, `usage_records.upstream_cost_cents` (per code comment) | new-api doesn't separate upstream cost from retail price in usage logs. |
| **Per-token rate limit UI on user dashboard** | `app/src/app/dashboard/api-keys/page.tsx` (per the audit context, 544 lines) | new-api has system-wide rate limits only. |
| **OpenAI + Claude + Gemini adapter parity** (v5 mission) | `server/src/inference/call-provider.ts:62-65` | new-api does OpenAI⇄Claude format conversion, but Gemini is text-only and function-calling "not supported yet" per their own README. |
| **Open-source data-compatibility with one-api** (QuantumNous boasts this) | OMA-AI is a fresh DB; not relevant | new-api explicitly claims one-api DB compatibility (preserves user migration path). |
| **Aggressive accessibility** (WCAG AA dark contrast 7/7 pairs, 6.97:1 worst) | per v6-audit-summary | new-api's UI is documented as "some interfaces are yet to be updated" — a11y is a known gap. |
| **Real lottie animations in UI** | `app/public/lottie-x402-flow.json`, `app/src/components/LottiePlayer.tsx` | new-api has no animation assets. |

---

## 5. PRIORITY RECOMMENDATION

If only one is shipped, ship **B (per-token model allowlist)** — it's the smallest change with the largest blast-radius-reduction impact. 4-6 hours of work for genuine security improvement.

If a full sprint, sequence is: **B → A → D → C → E**.

Skip E (cache billing) until OMA has >$1k/mo in Anthropic/OpenAI/DeepSeek traffic, since the implementation is non-trivial and the absolute savings are small at low volume.

---

## 6. GAPS NOT WORTH FIXING NOW (but worth flagging)

- **Announcement banner** (new-api has it). OMA has `app/src/components/AuthNotice.tsx` but it's about auth flow, not operator-driven announcements. Not worth building until a real use case appears (e.g., scheduled maintenance).
- **Cache hit statistics** (new-api has it on admin dashboard). E above is the prerequisite. Defer together.
- **Channel test button** is already server-side (`server/src/routes/admin/provider-test.ts`) — just needs the admin UI button. Trivial follow-up to D.

---

*End of report. Total estimated work to ship items A-D: ~5-7 days for one engineer. E is +2 days and should be its own session.*
