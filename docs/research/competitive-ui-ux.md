# Competitive UI/UX Research — AI Inference Platforms

Researched 2026-07-30 via context.dev MCP and brave-search. Findings to inform OMA-AI design improvements.

## OpenRouter (openrouter.ai/models)

**Strengths:**
- **Multi-facet filtering**: Input Modalities, Context length, Prompt pricing, Output pricing, Series, Categories, Supported Parameters, Tool Calling, Zero Data Retention, In-Region Routing, Output pricing, Model age, Distillable, Providers, Model Authors, Artificial Analysis, Design Arena
- **List/Table view toggle** for compact vs detailed
- **Newest** + trending + rankings sorts
- **Compare** side-by-side view
- **Free models collection** promoted prominently
- **Live token stats** on each card ("48.3B tokens")
- **Discover page** with breakout models and behavioral trends

**Patterns OMA-AI should adopt:**
- Multi-facet filtering sidebar (modalities, context, pricing)
- List/Table toggle for models page
- "Free models" collection banner on `/models`
- Live token stats per model card

## Hugging Face (huggingface.co/inference/models)

**Strengths:**
- **Tasks** taxonomy: text-generation, image-classification, etc.
- **Inference Providers** abstraction (multiple backends per model)
- Strong **Docs** integration alongside models

## Replicate (replicate.com/explore)

**Strengths:**
- **Playground** for live testing models
- **Compare** feature in playground
- **Blog-driven discovery** with model prompt guides
- Clean **card grid** with model metadata at top of each card

**Patterns OMA-AI should adopt:**
- Per-model **prompt guide** for starters
- **Blog posts** for model launches

## Recommendations for OMA-AI Admin Dashboard

### Pricing Display
- Show pricing as "$X/M input, $Y/M output" (not per-token)
- Include **markup %** indicator (currently hidden)
- Add **comparison table** view (similar to OpenRouter)

### Usage Charts
- **Multi-time-range** selector (24h / 7d / 30d) — already in AdminDashboard
- Add **cost breakdown** by model (currently shows totals)
- Add **token throughput** chart (requests/sec, tokens/sec)
- Add **error rate** per model
- Add **latency** percentiles (p50, p95, p99)

### Models Catalog (`/models`)
- Add **"Free via OMA-AI"** collection filter
- Add **context length** slider filter
- Add **tool calling** filter
- Add **List/Table** view toggle
- Show **live usage stats** per model ("X requests today")

### Polar Integration (already done)
- OpenRouter has **subscriptions** + **credits** model. OMA-AI already supports both via Polar.

## Concrete Actions for OMA-AI

1. ✅ Free chat quota (20/day anon, 100/day authed) — DONE
2. ⏳ Add "Free via OMA-AI" badge on Gonka models — TODO
3. ⏳ Add context-length filter to `/models` page
4. ⏳ Add tool-calling filter to `/models` page
5. ⏳ Add cost-by-model breakdown to admin usage charts
6. ⏳ Add error rate + latency percentiles to admin dashboard
7. ⏳ Add List/Table toggle to `/models`
8. ⏳ Add per-model live usage stat ("X requests today")