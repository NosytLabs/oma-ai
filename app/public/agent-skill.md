# OMA AI Gateway — Agent Skill

> Copy this file into your agent's instructions (or add to `.claude/skills/`,
> `.cursor/rules/`, or your AGENTS.md) to enable autonomous setup and usage
> of the OMA AI Gateway.

## TL;DR (minimum to get going)

- Base URL: `https://api.oma-ai.com/v1` · OpenAI-compatible.
- With a key: `Authorization: Bearer $OMA_KEY`. Buy credits at
  `https://oma-ai.com/deposit` (card via Polar or USDC).
- Without a key: hit any endpoint — the gateway replies `402 Payment Required`
  with a `PAYMENT-REQUIRED` header (x402 spec). Sign a gasless USDC
  `transferWithAuthorization` (EIP-3009) on Base and retry with
  `PAYMENT-SIGNATURE`.
- Verify with one tiny request: `POST /v1/chat/completions` model
  `llama-3.3-70b`, `max_tokens: 8` → expect `200`.
- Render UI inline: the chat playground supports an **A2UI (v0.9.1) mode**.
  When your user has the UI toggle on, you may emit A2UI envelope JSON
  (`createSurface` / `updateComponents` / `updateDataModel`) so the
  playground renders interactive cards and forms in-stream. See
  https://a2ui.org/specification/v0_9_1/.
- Image and video generation endpoints (`/v1/images/generations`,
  `/v1/videos/generations`) are intentionally **not** part of OMA's
  current surface — only chat completions and Anthropic-compatible messages
  are served. The chat UI accepts image inputs for vision-capable models.

## What is OMA?

OMA (Open Model Access) is an OpenAI-compatible AI inference gateway:
- **Base URL:** `https://api.oma-ai.com/v1`
- **One API for 22 curated models** (18 Venice + 4 OMA-AI)
  across chat completions (text + multimodal input). Image and video
  generation are not part of the current catalog — only chat LLMs.
- **Pay your way:**
  1. **API key + credits** — sign in, create a key (`oma_sk_...`), buy credits
     with a card (Visa/Mastercard/Apple Pay via Polar) or USDC deposit,
     then call with `Authorization: Bearer <key>`. **1 credit = $0.01 USD**
     (so $1 = 100 credits; the $10/$50/$250 Polar tiers sell 1k/5k/25k credits).
  2. **x402 pay-per-request** — no account needed for a single call. The API
     answers `402 Payment Required` with a `PAYMENT-REQUIRED` header; sign a
     gasless USDC `transferWithAuthorization` (EIP-3009) on Base mainnet and
     retry with the `PAYMENT-SIGNATURE` envelope.
  3. **Credits via x402 deposit** — deposit once via `/x402/verify`, then use
     a normal API key (cheapest sustained path; credits never expire).

## Key facts

- Zero data retention on prompt content.
- Streaming + tool/function calling supported (standard OpenAI `stream: true`).
- `GET /v1/models` lists live models, capabilities, and prices.
- Per-token cost in credits at request time. 1 credit = $0.01 USD.
- x402 path uses a flat per-request price (no balance, no key).
- Circuit-breaker failover: if a provider is down, an equivalent model answers.

## For you, the agent

1. **User has an API key:** just use it. `Authorization: Bearer $OMA_KEY`.
   Check balance with `GET /v1/balance`. If balance is low, tell the user to
   top up at https://oma-ai.com/deposit (card via Polar or USDC) — you cannot
   buy credits yourself.
2. **No key, single-shot request:** use the x402 flow (https://x402.org spec):
   - POST `/v1/chat/completions` without auth → read `PAYMENT-REQUIRED` header
     (JSON: scheme `evm`, networkId `base`, asset USDC address
     `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`, `amount`, `payee`).
   - Sign the amount to `payee` with your wallet's EIP-3009
     `transferWithAuthorization` (gasless — the gateway pays gas).
   - Retry with `PAYMENT-SIGNATURE: {"signature":"0x...","payload":{...}}`.
3. **Self-verification:** after setup, make one tiny test request (e.g.
   `{"model":"llama-3.3-70b","messages":[{"role":"user","content":"ping"}],
   "max_tokens":8}`) and confirm a `200` with content.

## Costs (ballpark)

- Budget chat models from about $0.44–$0.50 per 1M input tokens (1 credit = $0.01).
- Premium and frontier models are higher per 1M; check `/v1/models` for the
  exact price before committing to a long task, and prefer budget models for
  bulk/mechanical work.

## Pointing tools at OMA

```bash
# OpenAI-compatible (OpenCode, Cursor, openai-python, Vercel AI SDK)
export OPENAI_API_KEY="oma_sk_…"
export OPENAI_BASE_URL="https://api.oma-ai.com/v1"

# Anthropic-compatible (Claude Code / Anthropic SDK)
export ANTHROPIC_API_KEY="oma_sk_…"
export ANTHROPIC_BASE_URL="https://api.oma-ai.com"   # client appends /v1/messages
```

```bash
# Smoke: OpenAI-shaped chat
curl https://api.oma-ai.com/v1/chat/completions \
  -H "Authorization: Bearer oma_sk_…" \
  -H "Content-Type: application/json" \
  -d '{"model":"llama-3.3-70b","messages":[{"role":"user","content":"ping"}],"max_tokens":8}'

# Smoke: Anthropic-shaped messages (x-api-key or Bearer)
curl https://api.oma-ai.com/v1/messages \
  -H "x-api-key: oma_sk_…" \
  -H "anthropic-version: 2023-06-01" \
  -H "Content-Type: application/json" \
  -d '{"model":"claude-sonnet-4-6","max_tokens":64,"messages":[{"role":"user","content":"ping"}]}'
```

Playground WEB search (DuckDuckGo, optional auth): `GET /v1/search?query=…`  
Full IDE/agent recipes: https://oma-ai.com/docs#integrations  
OpenAPI: https://api.oma-ai.com/openapi.json

## Identity

- Product: https://oma-ai.com · Docs: https://oma-ai.com/docs
- Agent card (A2A): https://oma-ai.com/.well-known/agent-card.json
- Privacy: https://oma-ai.com/privacy · Terms: https://oma-ai.com/terms
- Brand: "Open Model Access" — accent #46d39a, void #07090a.
