# Site Page Audit — 2026-06-14

**Audit window:** 2026-06-14 12:51–13:01 ADT
**Tested against:** local dev (`http://localhost:3000` Next.js app, `http://localhost:3001` *was supposed to be* Hono API)
**Method:** HTTP probe via `curl`, HTML text extraction via Python `html.parser`, cross-referenced against repo source.

> ⚠️ **Note on tooling:** The user request specified `mcp_chrome-devtools_*` tools, but those tools are not available in this environment. Audit performed via HTTP fetch + DOM text extraction instead, which catches everything except JS *runtime* errors in the browser. Where I could not observe runtime console, I read the source.

---

## TL;DR

| Severity | Issue | Count |
|---|---|---|
| 🔴 **CRITICAL** | API server (port 3001) is **NOT running** — second Next.js instance is on that port instead | 1 |
| 🔴 **CRITICAL** | All 5 auth-walled pages return HTTP 500 (`Cannot find the middleware module`) | 5 |
| 🔴 **CRITICAL** | UI catalog advertises **28 fictional models** not present in server routing catalog | 28 |
| 🔴 **CRITICAL** | "50+ models" claim on 9 pages (real: 19 in server, 33 in UI but only 4 overlap) | 9 |
| 🟠 **HIGH** | Internally inconsistent model counts (`50+` / `32+` / `30+` / `28+` / `18`) on different pages | 5 |
| 🟠 **HIGH** | `https://api.oma-ai.com` returns 404 (production API not deployed) | 1 |
| 🟡 **MED** | Footer "last deploy" hardcoded to current date string | 1 |
| 🟢 **OK** | 16 / 21 pages return HTTP 200 | — |
| 🟢 **OK** | All 3 next/font woff2 files load (Syne, Inter, JetBrains Mono) | — |
| 🟢 **OK** | No "lorem ipsum" / "coming soon" / fake quote testimonial content found | — |

---

## 1 · Infrastructure Findings

### 1.1 🔴 Wrong process on port 3001

```text
$ lsof -nP -i :3000 -i :3001
node    31539 ... TCP *:3000 (LISTEN)    → next-server (v15.5.18)
node    95749 ... TCP *:3001 (LISTEN)    → next-server (v15.5.18)
```

Both ports run **Next.js**. The Hono API server (`server/src/index.ts`) is not running anywhere. Consequence: every page that touches the API (status indicator, dashboard, deposit balance, etc.) cannot resolve, and `http://localhost:3001/health` returns the Next.js 404 page, not the actual `{ status: "ok" }` health probe defined at `server/src/routes/health.ts:13`.

Likely cause: `npm run dev` was started twice in `app/` (or `start-dev.sh` started two app instances), and the actual `server/` was never started.

**Effect on audit:** All "Connecting…" status badges in the navbar/footer are stuck (expected behaviour when API is down — see `app/src/components/api-status.tsx:7`). This is *correct* component behaviour, not a UI bug.

### 1.2 🔴 Middleware compilation broken → 500 on every protected page

Every page in `PROTECTED_PATHS` (`app/src/middleware.ts:5`) returns HTTP 500 with:

```text
Error: Cannot find the middleware module
  at DevServer.runMiddleware (next-server.js:1239:23)
```

The middleware source compiles cleanly (`app/src/middleware.ts` is 56 lines, syntactically valid), and the manifest files exist:

```
.next/server/middleware-build-manifest.js
.next/server/middleware-manifest.json
.next/server/middleware-react-loadable-manifest.js
```

— but the actual compiled `.next/server/middleware.js` is missing. This is a Next.js dev-server compile artefact problem; clearing `.next/` and restarting should fix it. **The pages do NOT redirect to /login as the user expected — they 500 outright.**

### 1.3 🟠 Production API endpoint is 404

```text
$ curl -I https://api.oma-ai.com
HTTP/2 404
```

The docs / pricing / playground code all reference `https://api.oma-ai.com/v1` as the base URL (`app/src/app/docs/page.tsx`, the homepage curl snippet, etc.). The host responds but the `/v1` API isn't deployed. The marketing site is shipping a base URL that doesn't work.

`https://oma-ai.com` returns `307` (redirect) — probably to `www.` — that's fine.

---

## 2 · Per-Page Report

Status codes captured by `curl -sS -o /dev/null -w "%{http_code}"`. Body inspected via Python text extraction.

| Path | HTTP | Loads | Issues |
|---|---|---|---|
| `/` | 200 | ✅ | False model claims (see §3.1), Connecting status |
| `/about` | 200 | ✅ | "Models 50+" claim false |
| `/pricing` | 200 | ✅ | 10 fictional model IDs in table (see §3.2) |
| `/models` | 200 | ✅ | "32+ models" claim — 26 model refs, ~22 fictional |
| `/docs` | 200 | ✅ | "Access 30+ models" claim false |
| `/faq` | 200 | ✅ | "50+ models across Venice and AntSeed" false |
| `/compare` | 200 | ✅ | Footer "50+ models" |
| `/use-cases` | 200 | ✅ | Footer "50+ models" |
| `/private-ai-api` | 200 | ✅ | Content looks real (Venice backend, no PII) |
| `/crypto-payments` | 200 | ✅ | "100+ tokens" — plausible (HoudiniSwap claims 100+ coins) |
| `/login` | 200 | ✅ | Looks fine, wallet + account-number sign-in |
| `/image-generation` | 200 | ✅ | "Powered by Venice AI", 4 image models listed |
| `/video-generation` | 200 | ✅ | 5 video models listed, 3 of which are **fictional** (see §3.3) |
| `/swap` | 200 | ✅ | Houdini-powered, looks fine |
| `/privacy` | 200 | ✅ | References fictional `claude-sonnet-4-6` as example |
| `/terms` | 200 | ✅ | Mentions OMA token (see §3.5) |
| `/dashboard` | **500** | ❌ | Middleware module missing |
| `/playground` | **500** | ❌ | Middleware module missing |
| `/settings` | **500** | ❌ | Middleware module missing |
| `/deposit` | **500** | ❌ | Middleware module missing |
| `/admin` | **500** | ❌ | Middleware module missing |
| `localhost:3001/health` | **404** | ❌ | Wrong process on port (Next.js, not Hono) |

---

## 3 · Content Audit (factual accuracy vs code)

### 3.1 🔴 Landing page (`/`) — fictional model showcase

The homepage "Inventory" section displays 6 "featured" models with provider + context window. Cross-checked against `server/src/inference/models.ts`:

| Displayed | Real in catalog? |
|---|---|
| `llama-3.3-70b` (Venice, 128k) | ✅ |
| `qwen3-coder-480b` (AntSeed, 128k) | ❌ |
| `claude-sonnet-4-6` (Venice, 200k) | ❌ — catalog has `claude-sonnet-4` (no `-6`) |
| `deepseek-v4-pro` (AntSeed, 128k) | ❌ — catalog has `deepseek-v3` |
| `gpt-4o` (Venice, 128k) | ❌ — catalog has `gpt-4o-mini` only |
| `gemma-3-27b` (Venice, 128k) | ❌ |

**5 of 6 "featured" models do not exist in the routing catalog.** The header curl snippet also uses the fictional `"model": "claude-sonnet-4-6"`.

Same page: status panel claims `Models 6 of 50+ shown` and `Providers 3 / 3`. Real model count is 19. Provider count is 10 in code (`venice, antseed, litellm, openrouter, together, deepinfra, surplus, morpheus, claude, gemini`), but operationally maybe only 3 are wired — the "3/3" is plausible but `50+` is not.

### 3.2 🔴 Pricing page — split-brain model catalog

```
Header:  "Pay per token across 28+ models"
Table title: "18 models"
```

Two different numbers on one page. The pricing table actually lists 18 rows. Cross-referenced against server catalog:

| ID in pricing table | In server catalog? |
|---|---|
| `claude-sonnet-4` | ✅ |
| `claude-opus-4` | ✅ |
| `openai/gpt-4o-mini` | ⚠️ catalog has `gpt-4o-mini` (no `openai/` prefix) |
| `gemini-2.5-pro` | ✅ |
| `gemini-2.5-flash` | ✅ |
| `mistral-small-3.2-24b-instruct` | ❌ |
| `claude-3-5-haiku-latest` | ✅ |
| `deepseek-r1` | ❌ |
| `deepseek-v3` | ✅ |
| `qwen3-coder-32b` | ❌ |
| `venice-uncensored` | ❌ |
| `llama-3.3-70b` | ✅ |
| `qwen3-8b` | ❌ |
| `meta-llama-3.1-8b-together` | ❌ — catalog has `llama-3.3-70b-together` only |
| `google-gemma-3-27b-it` | ❌ |
| `google-gemma-4-31b-it` | ❌ |
| `zai-org-glm-5-1` | ❌ |
| `minimax-m27` (display: "MiniMax M2.7") | ❌ — this is the dev's own private model name leaking into the public UI |

**10 of 18 rows are fictional.** Users who copy these IDs into curl will get 404s from the real router.

### 3.3 🔴 Video generation — fictional models

`app/src/app/video-generation/page.tsx` defines 5 model options. Server catalog has 2:

| Displayed | Real? |
|---|---|
| `seedance-2-0-text-to-video` ($0.90) | ✅ |
| `seedance-2-0-image-to-video` ($1.20) | ❌ |
| `kling-v3-pro-text-to-video` ($0.92) | ✅ |
| `kling-v3-pro-image-to-video` ($1.40) | ❌ |
| `grok-imagine-text-to-video` ($0.85) | ❌ |

`/video-generation` page header literally says **"Powered by Seedance 2.0, Kling V3 Pro, and Grok Imagine"** — Grok Imagine routing isn't implemented.

### 3.4 🔴 Two model catalogs in the repo

There are **two separate catalogs**:

1. **Server routing catalog** — `server/src/inference/models.ts` — **19 entries** — what the router can actually serve.
2. **UI display catalog** — `app/src/lib/models-data.ts` (`+ app/src/app/pricing/page.tsx`, `+ app/src/app/docs/page.tsx`) — **33 entries** — what the marketing pages show.

Only **~4 model IDs** appear in both (`llama-3.3-70b`, `llama-3.2-3b`, `gpt-4o-mini`, `gemini-2.5-flash`). Every other UI-catalog ID is a model that the router does not know about. Examples (UI but not server):

```
claude-haiku-4-5, claude-opus-4-7, claude-sonnet-4-6,
deepseek-r1, deepseek-r1-distill, deepseek-r1-premium,
deepseek-v4-flash, deepseek-v4-pro,
gemini-3.5-flash, gemma-3-27b, gemma-4-31b, glm-5.1,
gpt-4o, gpt-5.5, gpt-oss-120b, grok-41-fast, kimi-k2-6,
llama-3.1-8b, minimax-m2.7, mistral-large, mistral-small-3.2, o3,
qwen2.5-72b, qwen3-235b, qwen3-8b, qwen3-coder-30b, qwen3-coder-480b,
venice-uncensored
```

This is the root cause of the "50+ models" / "32+" / "28+" / "18 models" inconsistency across pages — each page reads a different subset of the UI catalog.

### 3.5 🟡 OMA token references — token doesn't exist on-chain

- `/terms` § 05: *"OMA token deposits include a 5% bonus subject to circuit-breaker conditions."*
- `/crypto-payments`: lists `OMA` as a supported deposit token alongside ETH, USDC, etc.
- `server/src/credits/price-guard.ts` has the bonus logic: dampens to 2% on >20% drop, 0% on >35% drop.

**No OMA token contract address** found in `server/` or `contracts/`. The bonus path is implemented but there's no deployed token. This is product-not-launched, not an outright lie, but it is misleading on a public-facing terms doc.

### 3.6 🟢 Things that are fine

- `/privacy` and `/terms`: both real, internally consistent, well-written. Dated `2026-01-01`, current.
- `/faq`: 18 Q&A items, all answers are plausible and reference real product behaviour (the only false claim is "50+ models").
- `/about`: well-written, mentions "Hosts 0 (we forward)" — consistent with the gateway architecture in `server/src/inference/router.ts`.
- `/compare`: structured comparison vs Venice / CheapTokens / OpenRouter, no fake quotes.
- `/private-ai-api`: explains Venice backend, no-account model, no PII — matches code.
- `/login`: real sign-in surface (wallet or Mullvad-style account number).
- `/image-generation` + `/swap`: minimal UI shells, no false claims.
- **No fake testimonials.** Checked all pages for `said`, `claims`, `believe`, `testimonial`, `quote` patterns and quoted attributed strings — zero hits. No "TechCrunch said…" or "John from Acme said…" content.
- **No lorem ipsum.** Only `placeholder` matches were HTML `placeholder=""` form attrs.
- **No "Coming Soon" / TODO** strings in rendered pages.

---

## 4 · JS / runtime concerns (inferred from source)

I could not observe browser-runtime console errors directly. From source inspection:

- `app/src/components/wallet-provider.tsx` imports `SiweMessage` from `siwe@3`, which transitively `require("ethers")` at module load. `app/package.json` has `ethers@^6.13.4` — see `AGENTS.md` warning. **Looks correct.**
- All 16 working pages share the same layout, so a single layout-level runtime error would crater all of them; the fact they render means client-side hydration is OK on the public surface.
- `/dashboard` etc. would normally trigger client-side runtime if reached, but the middleware blocks them at the server with 500 — we never see them paint.
- Fonts: Next/font Google fonts (Syne / Inter / JetBrains_Mono) all load (3 woff2 files HTTP 200, 34–48 KB each). HTML root carries `class="__variable_744198 __variable_f367f3 __variable_3c557b"` — the three font CSS variables are wired. **No fallback-to-Arial.**

---

## 5 · Misc

- Footer says `last deploy 2026-06-14` — that is today's date, so probably reads `process.env.NEXT_PUBLIC_BUILD_DATE` or similar. Harmless but should be wired to actual deploy SHA.
- Status `mock · dev` is correct for `FACILITATOR_MODE=mock`. Not misleading.
- `Version 0.4.2` on landing — no `package.json` version corroboration done; treat as cosmetic.

---

## 6 · Recommended fixes (priority order)

1. **Start the actual API server.** `cd server && npm run dev`. Then `lsof -i :3001` should show `tsx` / `node` running `server/src/index.ts`, not next-server. The "Connecting…" badges will turn green.
2. **Clear `app/.next/` and restart `app` dev server** to fix the middleware-module 500. After that, `/dashboard`, `/playground`, `/settings`, `/deposit`, `/admin` should either render or redirect to `/?next=…&auth=required`.
3. **Reconcile the two model catalogs.** Either:
   - Drop UI-only fictional IDs from `app/src/lib/models-data.ts`, `app/src/app/pricing/page.tsx`, `app/src/app/docs/page.tsx`, `app/src/app/video-generation/page.tsx`, `app/src/app/image-generation/page.tsx` and the landing-page inventory, **OR**
   - Add the missing entries to `server/src/inference/models.ts` with real `veniceId` / `antseedId` / pricing.
4. **Replace "50+ / 32+ / 30+ / 28+ models" copy with the real count** — or compute it dynamically from `GET /v1/models` (which is what `/v1/models` is for).
5. **Remove the `minimax-m2.7` / "MiniMax M2.7" entry** from `models-data.ts`, `pricing/page.tsx`, `docs/page.tsx`, and the `OPENSOURCE_PREFIXES` array in `server/src/inference/provider-selector.ts` — this is the audit model leaking into production copy.
6. **Either remove OMA token references** from `/terms`, `/crypto-payments`, `server/src/credits/price-guard.ts` or document that the token is not yet deployed.
7. **Deploy `api.oma-ai.com/v1`** or change the marketing copy + curl snippets to a different documented base URL.

---

*Audit run by `tokenrouter/MiniMax-M3` (yes, the irony of this model being the one that flagged the `MiniMax M2.7` leak is not lost).*
