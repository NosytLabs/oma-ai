# OMA AI Gateway

**Website:** https://oma-ai.com  
**Version:** 2.1.0  
**Status:** Local dev (pre-launch)  
**Brand:** Open Model Access · void `#07090a` · accent `#46d39a` · see `BRAND.md`

Self-hosted AI inference gateway: OpenAI-compatible API, multi-model chat playground, card + USDC credits, and x402 pay-per-request for agents.

**Slogan:** *One gateway. Every model. No lock-in.*  
**Purpose:** Curated multi-provider inference gateway (not a 100+ model marketplace). OpenAI + Anthropic-compatible API, free guest chat on Gonka models, paid Venice catalog, card/USDC/x402 billing.

---

## Repository layout

```
app/                 Next.js 15 frontend (marketing, chat, dashboard, docs UI)
server/              Hono API (inference proxy, auth, billing, x402)
scripts/
  dev/               start-dev, local-db, chrome debug
  ops/               deploy, start-prod, launch validate, wallets, seed
  audit/             axe / visual / UX capture tools
deploy/              Coolify / compose snippets
docker-compose*.yml  Local / prod compose
BRAND.md             Design tokens, voice, logo rules
SECURITY.md          Security policy
```

Public product surfaces (app routes):

| Path | Purpose |
|------|---------|
| `/` | Landing — product value prop, CTAs |
| `/models` | Curated model catalog + pricing |
| `/chat` | Playground (chat / image / video) |
| `/pricing` · `/deposit` | Pricing and credit funding |
| `/docs` · `/getting-started` | API docs and quickstart |
| `/docs#integrations` | OpenCode · Claude Code · Cursor / Continue |
| `/dashboard` · `/settings` | Account, keys, usage |
| `/capabilities` · `/compare` · `/faq` · `/glossary` | Product education |
| `/about` · `/contact` · `/privacy` · `/terms` | Trust + legal |

Agent-facing public files: `app/public/llms.txt`, `app/public/agent-skill.md`.  
Machine-readable API: `GET https://api.oma-ai.com/openapi.json` (also `/v1/openapi.json`).

---

## Features

### Payments
- **Card credits (Polar)** — Visa / Mastercard / Apple Pay tiers
- **USDC on Base** — direct 1:1 USD deposits
- **x402** — agent-native USDC pay-per-request (EIP-3009)

### Developer
- OpenAI-compatible API (`/v1/chat/completions`, images, video)
- Anthropic-compatible messages (`/v1/messages`, Bearer or `x-api-key`)
- **22 curated chat models** (20 Venice + 2 Gonka free-tier budget) — not an unbounded marketplace
- Free guest chat: `minimax-m2.7` · `kimi-k2.6` (Gonka)
- API keys, rate limits, circuit-breaker failover
- SIWE wallet auth + magic-link email

---

## Quick start

1. Copy env: `cp .env.example .env` (and `server/.env.example` → `server/.env` as needed)
2. Start local DB (optional): `./scripts/dev/local-db-up.sh`
3. Start stack: `./scripts/dev/start-dev.sh`
4. Validate: `npm run validate` (typecheck + lint + Vitest for app and server)

---

## Testing & QA

- **Unit / integration:** Vitest in `app/` and `server/`
- **CI gate:** `npm run validate`
- **Manual audits:** see `scripts/README.md` (`axe-audit`, `visual-audit`, `validate-launch`)
- Add a matching test when you ship a new endpoint or critical UI flow

---

## Brand & docs

- **BRAND.md** — tokens, logo paths, voice (use / avoid)
- **app/public/logos/** — live site assets; **brand-kit/** press sources; **providers/** model tiles
- **SECURITY.md** · **LICENSE** · **LICENSE-THIRD-PARTY.md**
- Agent setup: `app/public/agent-skill.md` · integrations UI at `/docs#integrations`

API surface for agents/LLMs: `app/public/llms.txt` and OpenAPI (`server/src/routes/openapi.ts`).

---

## Contributing

- Animation primitives: `app/src/lib/animation`
- Model catalog (app SSR): `app/src/lib/models-data.ts`
- Model catalog (server runtime): `server/src/inference/models.ts` (keep counts in sync; regenerate `server/models.json` snapshot when the catalog changes)
- Run `npm run validate` before opening a PR
