# Venice AI Research Report — OMA-AI Catalog Audit

**Date:** 2026-07-01
**Researcher:** OMA-AI research subagent
**Source:** Venice API Docs (docs.venice.ai), Venice pricing page, model catalog, deprecations, rate-limits, changelog references
**Method:** Firecrawl MCP scrapes of public docs + targeted searches

---

## Executive Summary

OMA's `server/models.json` contains **88 text/inference models and 5 video models** (93 total). Venice currently publishes **~90 text models**. Catalog parity is high — 85 of OMA's text models still exist on Venice — but **3 stale OMA models are no longer listed on Venice** (`arcee-trinity-large-thinking`, `tencent-hy3-preview`, `minimax-m3` non-preview), **1 is officially deprecated and retiring 2026-07-23** (`claude-opus-4-7-fast`), and **5 brand-new models are missing from OMA** (`zai-org-glm-5-2`, `claude-sonnet-5`, `kimi-k2-7-code`, `e2ee-glm-5-2-p`, plus optional `nvidia-nemotron-3-ultra-550b-a55b`). Pricing is broadly accurate but **`zai-org-glm-4.6` is a material overcharge** (Venice dropped base from ~$0.85 to $0.43 input — OMA's effective markup is now ~98% instead of the catalog's 25%). New Venice capabilities worth exploiting: prompt-cache pricing, `claude-sonnet-5` (added 2026-06-28, 3 days ago), tier-based rate limits, `fallbacks` parameter, and the `default_*` model traits.

---

## 1. Current Venice Catalog (89+ text models, scraped 2026-07-01)

### 1.1 Family overview (text models on Venice, sorted by family)

| Family | Count | Notable recent additions |
|---|---|---|
| **GLM (Z.ai)** | 9 | `zai-org-glm-5-2` (2026-06-15, NEW), `z-ai-glm-5v-turbo` (2026-03-31) |
| **Venice Uncensored** | 2 | `venice-uncensored-1-2` (2026-03-31) |
| **Qwen (Alibaba)** | 12 | `qwen-3-7-plus` (2026-06-01, NEW), `qwen-3-7-max` (2026-05-21, NEW) |
| **Gemma (Google)** | 4 | `gemma-4-uncensored` (2026-04-12) |
| **Grok (xAI)** | 4 | `grok-build-0-1` (2026-05-20) |
| **Mistral** | 2 | `mistral-small-2603` (Mistral Small 4, 2026-03-15) |
| **Hermes (Nous)** | 1 | — |
| **Gemini (Google)** | 3 | `gemini-3-5-flash` (2026-05-21, NEW) |
| **Claude (Anthropic)** | 10 | `claude-fable-5` (2026-06-09, NEW), `claude-sonnet-5` (2026-06-28, NEW), `claude-opus-4-8` (2026-05-27, NEW) |
| **GPT (OpenAI)** | 10 | `openai-gpt-55`, `openai-gpt-55-pro` (2026-04-22/23) |
| **Kimi (Moonshot)** | 3 | `kimi-k2-7-code` (2026-06-12, NEW) |
| **Xiaomi MiMo** | 1 | `xiaomi-mimo-v2-5` (2026-06-10, NEW) |
| **DeepSeek** | 3 | `deepseek-v4-pro`/`-flash` (2026-04-23) |
| **Aion** | 1 | `aion-labs-aion-2-0` (2026-03-23) |
| **Llama (Meta)** | 2 | — |
| **MiniMax M-series** | 3 | `minimax-m3-preview` (2026-06-11, NEW) |
| **Mercury (Inception)** | 1 | `mercury-2` (2026-02-19) |
| **Nemotron (NVIDIA)** | 3 | `nvidia-nemotron-3-ultra-550b-a55b` (2026-06-03, NEW) |
| **OpenAI GPT OSS** | 1 | — |
| **E2EE/TEE private** | 15 | Several new E2EE entries in May/June 2026 |

### 1.2 Default model traits (aliases — stable indirection)

Venice exposes symbolic aliases that automatically route to the recommended model. OMA should consider exposing these:

| Trait | Routes to | Notes |
|---|---|---|
| `default` | `zai-org-glm-4.7` | General default chat |
| `function_calling_default` | `zai-org-glm-4.7` | Same target |
| `default_vision` | `qwen3-vl-235b-a22b` | Vision input |
| `default_reasoning` | `qwen3-235b-a22b-thinking-2507` | Reasoning |
| `default_code` | `qwen3-coder-480b-a35b-instruct-turbo` | Code |
| `most_uncensored` | `venice-uncensored-1-2` | Uncensored |
| `most_intelligent` | `zai-org-glm-4.7` | Frontier |

---

## 2. OMA Catalog Status (match/mismatch)

### 2.1 MATCH — OMA models confirmed live on Venice (85 models)

All other OMA text model IDs are present in Venice's current `models/text` catalog. (Full list omitted for brevity; see `models.json`.)

### 2.2 STALE — OMA models NOT found on current Venice catalog (REMOVE)

| OMA `id` | OMA `displayName` | Venice status | Likely cause |
|---|---|---|---|
| `arcee-trinity-large-thinking` | Trinity Large Thinking | Not in current 89-model text list | Likely renamed/removed; was in OMA at $0.3125 / $1.125 |
| `tencent-hy3-preview` | Hy3 Preview | Not in current list | Likely promoted/removed; was in OMA at $0.063 / $0.21 |
| `minimax-m3` | MiniMax M3 | Not in current list — only `minimax-m3-preview` exists | Likely renamed; preview is the GA variant |

**Recommendation:** OMA should verify these three still work via a live `/api/v1/chat/completions` call. If they 404, remove from catalog. If they auto-route to a replacement, update `displayName` and `veniceId` accordingly.

### 2.3 DEPRECATED — retiring 2026-07-23 (schedule removal)

| OMA `id` | OMA `displayName` | Venice status | Notes |
|---|---|---|---|
| `claude-opus-4-7-fast` | Claude Opus 4.7 Fast | Marked **Deprecated** in Venice; removal **2026-07-23** | Venice auto-routes to a similar-class model at same/lower price after sunset; may return 410 Gone |

**Recommendation:** Remove or mark deprecated in OMA before 2026-07-23. Note: OMA's price ($36/$180 per 1M) matches Venice's pre-deprecation price.

### 2.4 MISSING — new Venice models not in OMA (ADD)

| Venice `id` | Display | Tier | Context | Input $/M | Output $/M | Added | Privacy |
|---|---|---|---|---|---|---|---|
| **`zai-org-glm-5-2`** | GLM 5.2 | L | 1.0M | $1.40 | $4.40 | 2026-06-15 | Private, Beta |
| **`claude-sonnet-5`** | Claude Sonnet 5 | L | 1.0M | $3.00 | $15.00 | **2026-06-28** (3 days old) | Anonymized, Beta |
| **`kimi-k2-7-code`** | Kimi K2.7 Code | L | 256K | $0.90 | $4.30 | 2026-06-12 | Private, Beta |
| **`e2ee-glm-5-2-p`** | GLM 5.2 (E2EE) | L | 524K | $1.75 | $5.75 | 2026-06-15 | E2EE+Private, Beta |
| `nvidia-nemotron-3-ultra-550b-a55b` | NVIDIA Nemotron 3 Ultra | L | 256K | $0.63 | $3.13 | 2026-06-03 | Private |

**Priority:** `claude-sonnet-5` (highest — newest, premium, 1M context, high-margin). All four Beta-tier models can be added at the catalog's standard `markupPercent: 25`.

### 2.5 Pricing discrepancies (Venice base ≠ OMA implied base)

OMA's `markupPercent: 25` implies `venicePrice = omaPrice / 1.25`. The following models show meaningful drift:

| OMA `id` | OMA input/output ($/M) | Implied Venice base | Venice actual base | Drift |
|---|---|---|---|---|
| **`zai-org-glm-4.6`** | 0.85 / 2.75 | $0.68 / $2.20 | **$0.43 / $1.75** | Venice cut price ~36% on input, ~20% on output; OMA's effective markup is now **~98%** instead of 25% |
| `kimi-k2-6` | 0.85 / 4.655 | $0.68 / $3.72 | $0.75 / $3.50 | Within 10% — likely fine |
| `deepseek-v4-pro` | 1.73 / 3.796 | $1.38 / $3.04 | $1.65 / $3.30 | Venice base is slightly higher than OMA's implied — OMA may be undercharging |
| `mistral-small-2603` | 0.1875 / 0.75 | $0.15 / $0.60 | $0.19 / $0.75 | Close |
| `kimi-k2-5` | 0.56 / 3.50 | $0.45 / $2.80 | $0.56 / $3.50 | Match on output, OMA slightly higher on input (fine) |

**Action:** Audit `zai-org-glm-4.6` immediately — Venice price appears to have dropped. Either pass the savings through (reduce OMA price) or accept the higher margin (keep price). Most other discrepancies are within acceptable tolerance.

### 2.6 Cache pricing (new Venice capability — OMA does not expose)

Many Venice models now publish **prompt-cache pricing** (per 1M cached tokens), e.g.:

| Model | Cache read $/M |
|---|---|
| `zai-org-glm-5-1` | $0.33 |
| `zai-org-glm-5` | $0.20 |
| `z-ai-glm-5-turbo` | $0.24 |
| `z-ai-glm-5v-turbo` | $0.30 |
| `zai-org-glm-4.6` | $0.08 |
| `zai-org-glm-4.7` | $0.11 |
| `qwen-3-7-max` | $0.27 (read) / $3.35 (write) |
| `qwen-3-7-plus` | $0.05 / $0.63 |
| `grok-4-3` | $0.23 |
| `claude-opus-4-7` | $0.60 / $7.50 |
| `openai-gpt-55` | $0.63 |

**Recommendation:** OMA's catalog schema has no `cacheReadPricePer1M` / `cacheWritePricePer1M` fields. Adding them would let OMA pass through Venice's discount and improve margin on long-context cached traffic.

---

## 3. Recommended ADDITIONS to OMA catalog

| # | Venice `id` | Suggested OMA category | Display name | Input $/M (Venice) | Output $/M (Venice) | Suggested OMA price (×1.25) | Markup | Context |
|---|---|---|---|---|---|---|---|---|
| 1 | `claude-sonnet-5` | premium | Claude Sonnet 5 | $3.00 | $15.00 | $3.75 / $18.75 | 25% | 1.0M |
| 2 | `zai-org-glm-5-2` | mid | GLM 5.2 | $1.40 | $4.40 | $1.75 / $5.50 | 25% | 1.0M |
| 3 | `e2ee-glm-5-2-p` | mid (E2EE) | GLM 5.2 (E2EE) | $1.75 | $5.75 | $2.19 / $7.19 | 25% | 524K |
| 4 | `kimi-k2-7-code` | mid | Kimi K2.7 Code | $0.90 | $4.30 | $1.13 / $5.38 | 25% | 256K |
| 5 | `nvidia-nemotron-3-ultra-550b-a55b` | mid | NVIDIA Nemotron 3 Ultra | $0.63 | $3.13 | $0.79 / $3.91 | 25% | 256K |

All five are flagged **Beta** by Venice but are shipping in production on Venice's API. Risk is low.

---

## 4. Recommended REMOVALS

| # | OMA `id` | Action | Reason |
|---|---|---|---|
| 1 | `claude-opus-4-7-fast` | Remove before 2026-07-23 | Venice marks Deprecated; auto-sunset 22 days from report date |
| 2 | `arcee-trinity-large-thinking` | Remove or verify | Not in current Venice text catalog |
| 3 | `tencent-hy3-preview` | Remove or verify | Not in current Venice text catalog |
| 4 | `minimax-m3` (non-preview) | Replace with `minimax-m3-preview` if same model | Venice lists only the preview variant |

**Verification step before removal:** Live-call each `/api/v1/chat/completions` with the model. If Venice returns 410 Gone or 404, removal is safe. If it auto-routes, update `veniceId` to the routed target.

---

## 5. Pricing gap analysis — where OMA could increase markup

OMA's standard `markupPercent: 25` is uniform. Venice's effective discount-to-retail varies by model. Two strategies:

### 5.1 Pass-through (maintain 25% over Venice) — recommended default

Already done for most models; no change needed. Re-check after every Venice price update.

### 5.2 Increase markup on premium uncensored/private models

Markets tolerate higher markup on differentiated offerings. Candidates for **markup 40-50%** (vs current 25%):

- `venice-uncensored-1-2` — privacy + uncensored differentiator
- `venice-uncensored-role-play` — niche roleplay premium
- `gemma-4-uncensored` — uncensored variant
- `claude-fable-5` — premium tier, low elasticity
- `claude-opus-4-7` and `claude-opus-4-8` — frontier, low elasticity
- `claude-opus-4-7-fast` — DEPRECATING, skip
- All `e2ee-*` models — privacy premium is the value prop
- `mercury-2` — speed differentiator (1000+ tok/s)

**Risk:** raising markup on widely-available models (e.g., GLM-5.1, Qwen-3.7-Max) invites customer churn to direct Venice.

### 5.3 Decrease markup where Venice is already aggressive

If OMA is overcharging relative to the 25% standard:

- **`zai-org-glm-4.6`** — currently at 98% effective markup. Drop input from $0.85 to ~$0.54 (25% over Venice's $0.43) to stay competitive. Output $2.19 (25% over $1.75). This is also a customer-friendly move and reduces churn risk.

### 5.4 Add markup on cache reads

Cache reads at $0.05-0.30/M are a Venice discount OMA currently captures in full. Either:
- Pass through 100% of the cache discount (no markup) as a customer perk, or
- Mark up 25% (still a huge discount vs. full input price)

---

## 6. Rate limit info (Venice defaults)

### 6.1 Per-tier defaults (text models)

| Tier | Requests/min | Tokens/min | Examples |
|---|---|---|---|
| **XS** | 500 | 1,000,000 | `llama-3.2-3b`, `qwen3-4b` |
| **S** | 75 | 750,000 | `mistral-small-3-2-24b-instruct`, `venice-uncensored-*` |
| **M** | 50 | 750,000 | `zai-org-glm-5`, `qwen3-next-80b`, `google-gemma-3-27b-it`, `llama-3.3-70b` |
| **L** | 20 | 500,000 | All frontier/premium models (most of OMA's catalog) |

### 6.2 Other modalities

| Type | Requests/min |
|---|---|
| Image | 20 |
| Audio | 60 |
| Embedding | 500 |
| Video (queue) | 40 |
| Video (retrieve) | 120 |

### 6.3 Partner tier (negotiated)

XS: 500 RPM / 2M TPM | S: 150 / 1.5M | M: 100 / 1.5M | L: 60 / 1M

### 6.4 Headers exposed on every response

```
x-ratelimit-limit-requests
x-ratelimit-remaining-requests
x-ratelimit-reset-requests      ← Unix timestamp; use on 429
x-ratelimit-limit-tokens
x-ratelimit-remaining-tokens
x-ratelimit-reset-tokens        ← seconds until reset
```

### 6.5 Abuse protection

>20 failed requests in 30s triggers a 30s lockout. Retry with exponential backoff.

**Implication for OMA:** Most OMA-routed models sit in tier **L (20 RPM / 500K TPM)**. If OMA aggregates multiple end-users behind one Venice key, it will hit tier-L ceilings fast. Recommend:
- Partner-tier negotiation with Venice if OMA volume grows
- Client-side rate limiting to stay under 20 RPM on frontier models
- Front-tier routing: send cheap/short requests to XS/S models, reserve L for heavy tasks

---

## 7. Breaking / notable API changes

### 7.1 Breaking changes vs. OMA's current implementation (verify OMA proxy)

| Change | Direction | OMA impact |
|---|---|---|
| `max_tokens` is **deprecated** in favor of `max_completion_tokens` | Soft (still accepted) | Confirm OMA passes both or maps correctly |
| New `prompt_cache_retention` enum: `default` \| `extended` \| `24h` | Additive | Optional; OMA could surface as a flag |
| New `reasoning` object: `{ effort, summary }` takes precedence over legacy `reasoning_effort` | Additive | Pass-through if OMA wants to expose reasoning controls |
| New `text.verbosity` object alongside legacy `verbosity` | Additive | Pass-through |
| New `fallbacks` parameter (Anthropic beta; only forwarded for Claude Fable 5) | Additive | Optional |
| New `venice_parameters.enable_x_search` (xAI native search) | Additive | Optional |
| `store` accepted but ignored by Venice | No-op | Safe to pass |
| `user` field discarded | No-op | Safe to pass |
| 402 Payment Required returned for x402 wallet users with insufficient balance | New error | Handle 402 → top-up flow if OMA proxies x402 |
| 410 Gone returned for removed models | New error | OMA should map 410 → user-friendly "model retired" message |

### 7.2 Notable additions OMA should consider exposing

- **`prompt_cache_key`** + **`prompt_cache_retention`** — large cost/latency win for repeated prefixes
- **`venice_parameters.character_slug`** — Venice's character personas (chat products only)
- **`venice_parameters.strip_thinking_response`** / **`disable_thinking`** — strip or disable reasoning blocks
- **`include_search_results_in_stream`** / **`return_search_results_as_documents`** — control web-search output
- **`response_format.json_schema`** — JSON-schema-validated structured outputs

### 7.3 Files OMA might want to read

The Venice docs publish an `llms-full.txt` (~entire docs in one file), `agents.md`, `claude.md`, and a `skill.md` installable via `npx skills add docs.venice.ai`. Useful for code-gen against Venice.

---

## 8. Source URLs

- `https://docs.venice.ai` — landing
- `https://docs.venice.ai/models/text` — full text model catalog (89 entries)
- `https://docs.venice.ai/models/overview` — image/video/audio/embedding overview
- `https://docs.venice.ai/api-reference/endpoint/models/list` — `/api/v1/models` reference
- `https://docs.venice.ai/api-reference/endpoint/chat/completions` — chat completions reference (full parameter schema)
- `https://docs.venice.ai/api-reference/rate-limiting` — rate limit tiers and headers
- `https://docs.venice.ai/overview/deprecations` — deprecation tracker and lifecycle policy
- `https://venice.ai/pricing` — consumer pricing tiers (Free/Pro $18/Plus $68/Max $200)
- `https://docs.venice.ai/llms.txt` — docs index for LLM ingestion
- `https://docs.venice.ai/llms-full.txt` — entire docs dump
- `https://featurebase.venice.ai/changelog` — official changelog (referenced but not scraped in this pass)

---

## 9. Summary table

| Category | Count | Action |
|---|---|---|
| OMA text models verified live on Venice | 85 | Keep |
| OMA models NOT on Venice (stale) | 3 | Verify then remove: `arcee-trinity-large-thinking`, `tencent-hy3-preview`, `minimax-m3` |
| OMA models Deprecated on Venice | 1 | Remove before 2026-07-23: `claude-opus-4-7-fast` |
| New Venice models missing from OMA | 5 | Add with 25% markup: `claude-sonnet-5`, `zai-org-glm-5-2`, `kimi-k2-7-code`, `e2ee-glm-5-2-p`, `nvidia-nemotron-3-ultra-550b-a55b` |
| Pricing drift > 10% | 1 | Reduce `zai-org-glm-4.6` price to 25% over Venice base |
| Pricing drift < 10% | 4 | Tolerable; verify next refresh |
| New Venice capability not exposed by OMA | 2 | Add cache pricing fields; surface `prompt_cache_retention` |
| OMA standard markup | 25% uniform | Consider 40-50% on uncensored/E2EE/frontier |

**Highest-leverage moves (in order):**

1. Add `claude-sonnet-5` (newest frontier, premium margin)
2. Add `zai-org-glm-5-2` and `e2ee-glm-5-2-p` (1M context, GLM flagship)
3. Remove `claude-opus-4-7-fast` before 2026-07-23
4. Fix `zai-org-glm-4-6` price drift
5. Add `kimi-k2-7-code` for the agentic-coding niche
6. Verify/remove the 3 stale models via live API call

---

*Report generated 2026-07-01. Next refresh recommended: monthly, or immediately after any Venice changelog entry at https://featurebase.venice.ai/changelog.*