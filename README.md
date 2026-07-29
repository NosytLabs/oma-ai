# OMA AI Gateway

**Website:** https://oma-ai.com  
**Version:** 2.1.0  
**Status:** Local dev (pre-launch)  
**Brand:** Open Model Access · void `#07090a` · accent `#46d39a` · see `BRAND.md`

Self-hosted AI inference gateway. Better Auth sign-in (magic link,
anonymous guest, SIWE wallet) → API-key + USDC-on-Base deposits →
OpenAI-compatible `/v1/*` gateway → multi-provider routing → x402
per-request receipts for agents.

> **In this rebuild:** `/blog` and `/faq` permanently redirect
> (`/blog` → `/changelog`, `/faq` → `/pricing#faq`). `/swap` retired —
> fund via USDC deposit on Base (`/deposit`). The SIWE / wagmi /
> wallet-adapter stack is gone; sign-in is Better Auth + optional
> wallet via the `siwe` plugin. Homepage, footer, sitemap,
> `llms.txt` / `agents.md` aligned to brand voice (see `BRAND.md`).

---

## Features

### Payment Methods
- **USDC on Base** — direct deposit, settlement via a future on-chain watcher.
- **x402 Payments** — per-request USDC receipts on Base for AI agents
  (Coinbase CDP facilitator, mounted at `/x402/*`).

> **Deposit methods:** USDC on Base is the only supported path
> during the rebuild. CCTP / LI.FI / cross-chain parked.

### Developer Features
- **OpenAI-Compatible API** — drop-in replacement, change base URL
  (`POST https://api.oma-ai.com/v1/chat/completions`).
- **Streaming Support** — Server-Sent Events, OpenAI-shaped chunks.
- **Rate Limiting** — per-key and per-model limits.
- **API Key Management** — Mint via `POST /v1/keys` (dashboard UI at
  `/dashboard?tab=api-keys`). Key is shown **once** at mint.

---

## Quick Start

### 1. Clone & Setup

```bash
git clone https://github.com/NosytLabs/oma-ai
cd oma-ai

cp server/.env.example server/.env
cp app/.env.example app/.env.local
```

### 2. Configure

Edit `server/.env`:
```env
DATABASE_URL=postgresql://user:pass@host/database
JWT_SECRET=your-40-char-secret-key-here
RESEND_API_KEY=re_...                  # optional; magic-link fallback logs to console
VENICE_API_KEY=sk-...                  # required for chat
USDC_DEPOSIT_ADDRESS=0xYourTreasury..  # required for /deposit
BETTER_AUTH_SECRET=32+ chars
BETTER_AUTH_URL=http://localhost:3001
```

Edit `app/.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
BETTER_AUTH_URL=http://localhost:3001
BETTER_AUTH_SECRET=...
```

### 3. Run

```bash
# From oma root
./scripts/start-dev.sh

# Or manually:
cd app && pnpm run dev        # Frontend :3000
cd server && pnpm run dev     # Backend (Hono API) :3001
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Users                                │
│       (magic link / anonymous / SIWE wallet)                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                Next.js Frontend (:3000)                       │
│    Landing │ Dashboard │ Pricing │ Chat │ Docs │ Deposit   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                Hono.js API (:3001)                            │
│                                                              │
│   /api/auth/*        Better Auth (magic link, anon, SIWE)   │
│   /v1/chat/...       OpenAI-compatible streaming            │
│   /v1/keys           API key CRUD                            │
│   /v1/deposit/usdc    USDC deposit instructions + submit     │
│   /v1/models         Model catalog                            │
│   /v1/balance        Credit balance                           │
│   /x402/*            Per-request USDC receipts (agents)     │
│   /health            Liveness probe                           │
└─────────────────────────────────────────────────────────────┘
          │              │              │              │
           ▼              ▼              ▼              ▼
      ┌─────────┐   ┌──────────┐   ┌──────────┐   ┌─────────┐
      │Postgres │   │  Venice  │   │  Base    │   │ x402    │
      │(Drizzle │   │   AI     │   │  mainnet │   │facilit. │
      │+ users) │   │          │   │          │   │ (CDP)   │
      └─────────┘   └──────────┘   └──────────┘   └─────────┘
```

---

## API Endpoints (live)

### Authentication (Better Auth)
| Method | Endpoint | Description |
|--------|----------|-------------|
| ALL | `/api/auth/*` | Better Auth handler (sign-in, magic-link callback, session) |
| GET | `/user` | Current user (requires session cookie) |

### Inference (OpenAI-Compatible)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/v1/chat/completions` | Chat completion (streaming + non-streaming) |
| GET | `/v1/models` | Model catalog |

### API Keys
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/v1/keys` | Mint a new API key (key shown once) |
| GET | `/v1/keys` | List active keys |
| DELETE | `/v1/keys/:id` | Revoke a key |
| POST | `/v1/keys/install` | Install a key as HttpOnly cookie (for browser-direct SSE chat) |

### Payments
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/v1/balance` | Current credit balance |
| GET | `/v1/deposit/usdc` | USDC deposit instructions (address, network, memo) |
| POST | `/v1/deposit/usdc` | Submit a txHash for verification (returns `pending`; watcher credits on confirm) |
| GET | `/v1/deposit/status` | User's deposit history |

### x402 (Agent Payments)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/x402/verify` | Verify a payment receipt |
| POST | `/x402/settle` | Settle a payment |

---

## Available Models

Live catalog at `GET /v1/models` (OpenAI-compatible). Each entry
carries `pricing.prompt` / `pricing.completion` (per-token USD
strings), `context_length`, and `supported_parameters`. The
`app/src/lib/models-data.ts` module ships a small hand-picked
fallback for SSR metadata so layout descriptions and `MODEL_COUNT`
work without an async fetch.

### Wired Providers

- **Venice AI** (`https://api.venice.ai/api/v1`) — privacy-first
  OpenAI-compatible. Set `VENICE_API_KEY`.
- **Gonka / OpenBroker** (`https://api.openbroker.gonka.gg/v1`) —
  decentralized provable-inference broker. Set `GONKA_API_KEY`
  (sign up at https://openbroker.gonka.gg/register).

The chat route (`server/src/routes/chat/index.ts`) dispatches by the
model's `provider` field and transparently swaps base URLs,
upstream model IDs, and per-provider request envelopes.

### Model Tiers (representative)
| Tier | Examples | Provider | Price range (input / 1M tokens) |
|------|----------|----------|-----------------------------------|
| **Premium** | `claude-sonnet-4-5` | Venice | ~$3.13 |
| **Budget** | `llama-3.3-70b` | Venice | ~$0.45 |
| **Cheap (Gonka)** | `kimi-k2.6` | OpenBroker | ~$0.15 |
| **Cheap (Gonka)** | `minimax-m2.7` | OpenBroker | ~$0.30 |

See `GET /v1/models` for the live, complete catalog.

### Drop-in OpenAI SDK usage

```python
from openai import OpenAI

client = OpenAI(
    api_key="oma_sk_...",          # mint one at POST /v1/keys
    base_url="https://api.oma-ai.com/v1",
)
resp = client.chat.completions.create(
    model="kimi-k2.6",
    messages=[{"role": "user", "content": "hi"}],
)
print(resp.choices[0].message.content)
```

Works identically in **Claude Code**, **OpenCode**, **Cursor**,
**Cline**, **Aider**, and any other OpenAI-compatible client —
just point the base URL at OMA and paste your `oma_sk_*` key.

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Frontend | Next.js 15, React 19 | Landing, dashboard, pages |
| Auth (FE) | Better Auth client | Sign-in / sign-up flows |
| Backend | Hono.js, Node.js 22 | API server |
| Backend Auth | Better Auth (Drizzle) | magic-link + anonymous + SIWE |
| Database | PostgreSQL (Drizzle ORM) | Users, credits, deposits |
| Cache | Redis | Rate limiting, sessions |
| Blockchain | Base (EVM) | USDC deposits, x402 settlement |

---

## Cost to Run (local dev)

| Service | Free Tier | Production |
|---------|-----------|------------|
| PostgreSQL (self-hosted via `docker-compose.prod.yml`, or Neon serverless) | Self-host $0 / Neon 0.5GB | ~$0–10/mo |
| Redis | Local / self-host | ~$0 (bundled) |
| Coolify hosting | Self-hosted | ~$5-20/mo |
| Venice API | Pay-per-token | Usage-based |
| Domain | $12/yr | ~$1/mo |

**Total: $15-40/mo** for self-hosted

---

## Documentation

This README is the primary documentation. For env vars and config,
see `server/.env.example` and `app/.env.example`.

---

*Pay-as-you-go inference. Pay with crypto. Better Auth signed-in.*

---

## Disclaimer

This software is provided **"AS IS"** and **"AS AVAILABLE"**, without
warranty of any kind, express or implied, including but not limited
to the warranties of merchantability, fitness for a particular
purpose, and noninfringement.

In no event shall the authors, contributors, or copyright holders be
liable for any claim, damages, or other liability — whether in an
action of contract, tort, or otherwise — arising from, out of, or in
connection with the software or the use or other dealings in the
software.

OMA AI is a self-hosted gateway. Operators are solely responsible
for their deployment environment, key management, regulatory
compliance in their jurisdiction, and any costs incurred from
third-party AI providers. Nothing in this repository constitutes
financial, legal, or professional advice.

See [LICENSE](./LICENSE) for the full MIT license text.