# OMA AI Gateway

[![Website](https://img.shields.io/badge/website-oma--ai.com-07090a?style=flat&labelColor=0d1110&color=46d39a)](https://oma-ai.com)
[![Version](https://img.shields.io/badge/version-2.1.0-07090a?style=flat&labelColor=0d1110&color=46d39a)](#)
[![Status](https://img.shields.io/badge/status-local_dev_(pre--launch)-07090a?style=flat&labelColor=0d1110&color=46d39a)](#)

Self-hosted AI inference gateway featuring an OpenAI-compatible API, multi-model chat playground, credit system supporting cards and USDC, and `x402` pay-per-request billing for autonomous agents.

> **One gateway. Every model. No lock-in.**
>
> OMA AI acts as a curated, privacy-first multi-provider inference gateway (not an unbounded 100+ model marketplace). It offers OpenAI and Anthropic-compatible APIs, a free guest chat experience powered by OMA-AI models, paid access to the Venice catalog, and integrated card/USDC/x402 payment systems.

---

## Repository Layout

```text
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

### Public Product Surfaces (App Routes)

| Path | Purpose |
| :--- | :--- |
| `/` | Landing page — product value proposition, primary CTAs |
| `/models` | Curated model catalog and pricing details |
| `/chat` | Interactive playground (chat, image, and video generation) |
| `/pricing` · `/deposit` | Pricing model and credit funding interface |
| `/docs` · `/getting-started` | API documentation and developer quickstart |
| `/docs#integrations` | Integration guides for OpenCode, Claude Code, Cursor, and Continue |
| `/dashboard` · `/settings` | User account overview, API key management, and usage analytics |
| `/capabilities` · `/compare` · `/faq` · `/glossary` | Educational product guides |
| `/about` · `/contact` · `/privacy` · `/terms` | Trust, contact, and legal documentation |

- **Agent-facing public files:** `app/public/llms.txt`, `app/public/agent-skill.md`
- **Machine-readable API:** `GET https://api.oma-ai.com/openapi.json` (also available at `/v1/openapi.json`)

---

## Features

### Payments & Billing
- **Card Credits (Polar):** Purchase credit tiers via Visa, Mastercard, or Apple Pay.
- **USDC on Base:** Fund accounts with direct 1:1 USD deposits.
- **x402 Micropayments:** Agent-native pay-per-request billing using EIP-3009.

### Developer API & Proxy
- **OpenAI-Compatible API:** Support for `/v1/chat/completions`, image generation, and video generation.
- **Anthropic-Compatible Messages:** Support for `/v1/messages` using `Bearer` or `x-api-key` headers.
- **Curated Model Registry:** Access to 22 hand-picked chat models (20 Venice models + 2 OMA-AI free-tier budget models).
- **Free Guest Chat:** Budget-friendly access to `minimax-m2.7` and `kimi-k2.6` models via OMA-AI.
- **Robust Infrastructure:** Built-in API keys, granular rate limiting, and circuit-breaker failover mechanisms.
- **Identity & Auth:** SIWE (Sign-In with Ethereum) wallet authentication alongside magic-link email sign-ins.

---

## Quick Start

1. **Configure Environment:** Copy the template environment files:
   ```bash
   cp .env.example .env
   # Set up the server environment if needed
   cp server/.env.example server/.env
   ```
2. **Start Local Database:** Initialize and run the local Postgres/Redis database:
   ```bash
   ./scripts/dev/local-db-up.sh
   ```
3. **Launch the Development Stack:** Run the full application and server stack:
   ```bash
   ./scripts/dev/start-dev.sh
   ```
4. **Run Validation:** Run the validation suite to verify code health:
   ```bash
   npm run validate
   ```
   *(This executes TypeScript checks, ESLint linting, and Vitest test suites across `app/` and `server/`)*

---

## Testing & QA

- **Unit & Integration Testing:** Managed via Vitest inside `app/` and `server/`.
- **Continuous Integration Gate:** Checked automatically via `npm run validate`.
- **Manual Audits:** Leverage dedicated scripts documented in [scripts/README.md](scripts/README.md) (e.g., `axe-audit`, `visual-audit`, `validate-launch`).
- **Shipping Policy:** Always write a corresponding test when adding a new endpoint or shipping a critical UI flow.

---

## Brand & Documentation

- **[BRAND.md](BRAND.md):** Defines design tokens, logo assets, visual identity, and brand voice guidelines.
- **Asset Directories:**
  - `app/public/logos/` contains live application logos.
  - `brand-kit/` houses high-quality press assets.
  - `providers/` provides model provider tile graphics.
- **Legal & Compliance:** [SECURITY.md](SECURITY.md), `LICENSE`, and [LICENSE-THIRD-PARTY.md](LICENSE-THIRD-PARTY.md).
- **Agent Integration:** `app/public/agent-skill.md` and integration guides at `/docs#integrations`.
- **Machine API Contract:** `app/public/llms.txt` and OpenAPI schema defined in `server/src/routes/openapi.ts`.

---

## Contributing

- **Animations:** Custom visual primitives reside in `app/src/lib/animation`.
- **Catalog Synchronization:**
  - Frontend static catalog data is defined in `app/src/lib/models-data.ts`.
  - Backend runtime catalog is defined in `server/src/inference/models.ts`.
  - Ensure catalog configurations are kept in sync, and regenerate the `server/models.json` snapshot whenever the catalog changes.
- **Pull Request Checklist:** Always run `npm run validate` locally and fix any errors before submitting a pull request.
