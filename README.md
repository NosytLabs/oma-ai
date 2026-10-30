# OMA-AI

OMA-AI is an open-source AI gateway with a curated model catalog, prepaid API
billing and a browser chat workspace.

[Website](https://www.oma-ai.com) · [Customer docs](https://www.oma-ai.com/docs) ·
[Repository documentation](docs/README.md) · [Security policy](SECURITY.md)

## Product

- OpenAI chat completions and an Anthropic Messages adapter for text and
  function tools. Supported subsets are documented; full SDK or Claude Code
  feature parity is not promised.
- Scoped, expiring API keys; recorded usage, request IDs, charges and selected
  date-range exports in one account dashboard.
- Better Auth email magic-link and SIWE wallet login.
- USDC deposits on Base, authenticated x402 funding, and card checkout when
  configured. Inference spends prepaid credits.
- Free website chat for eligible OpenBroker/Gonka models, with daily quotas.
  SDK requests are paid. Conversations and drafts stay in the current browser.
- Bounded retries and configured fallbacks. Responses identify the actual
  served model; catalog availability is not a continuous provider health test.

The gateway stores billing and usage metadata, not prompt or completion
content. Upstream providers have their own retention and training policies.

OpenBroker/Gonka catalog prices are $0.02 per million input tokens and $0.02
per million output tokens. Venice catalog rates include a 50% markup.
[The live catalog](https://www.oma-ai.com/api/v1/models) is authoritative for
current prices, capabilities and enabled routes. Gonka costs depend on GNK
procurement and retries, so dollar profit is not assumed.

## Development

Use Node.js 24 and the pinned pnpm 9.15.9. The application uses Next.js 16,
React 19 and Tailwind 4; the API uses Hono, Drizzle/PostgreSQL, Better Auth,
viem and an Upstash HTTP Redis client.

```bash
pnpm install --frozen-lockfile
cp server/.env.example server/.env
cp app/.env.example app/.env.local
./scripts/dev/local-db-up.sh
pnpm --filter oma-server db:migrate
./scripts/dev/start-dev.sh
```

The database helper requires PostgreSQL command-line tools and an initialized
local data directory. It starts PostgreSQL with `pg_ctl` if needed, then creates
the `oma` development role and database. Set `PGDATA` if the data directory is
not at the helper's default path. The connecting PostgreSQL user must be able
to create roles and databases. Alternatively, configure an existing local
database in `server/.env`. The migration command reads `server/.env`; an
explicitly supplied `DATABASE_URL` takes precedence. The launcher also requires
`curl` and `lsof`.

Shared quotas require `UPSTASH_REDIS_REST_URL` and
`UPSTASH_REDIS_REST_TOKEN`. A plain Redis daemon or `redis://` URL cannot
serve the HTTP client. Without REST credentials, local quotas use bounded
memory fallback and `/ready` reports degraded Redis. Production requires
durable shared state.

Add valid inference credentials only when making real provider calls.
Unset provider credentials do not prevent public/account UI development.
Local mock funding does not execute mainnet transactions.

| Service | Local address |
| --- | --- |
| Website | http://localhost:3000 |
| API | http://localhost:3001 |
| Liveness / readiness | http://localhost:3001/health · http://localhost:3001/ready |

## Validation

```bash
pnpm validate
pnpm --filter oma-server test:auth:integration
```

The first command runs types, lint, unit/regression tests and production builds.
The second exercises real authentication, authorization, analytics and account
deletion against its own temporary migrated local database. It does not call
paid models. [Account tooling](server/scripts/README.md) documents guarded local
fixtures, cleanup and opt-in live inference tests.

Run both `pnpm audit --prod` and `pnpm audit` for dependency checks.
Compatibility patches and third-party notices are tracked in `patches/` and
`LICENSE-THIRD-PARTY.md`.

Keep regression tests focused on observable behavior. Reuse existing coverage
for filtering, availability and authentication instead of adding page-render
smoke tests or source-text checks for removed features. Preserve account,
payment and isolation checks. Generated logs and browser reports are ignored;
keep only maintained references in `docs/`.

## Repository

| Path | Purpose |
| --- | --- |
| `app/src/app/` | Pages and same-origin frontend handlers |
| `app/src/components/`, `app/src/lib/` | Shared UI and client utilities |
| `server/src/routes/` | Customer and operator API routes |
| `server/src/inference/` | Routing, providers and shared model catalog |
| `server/src/db/` | Ledger/schema and migrations |
| `server/scripts/` | Guarded account tests and API deployment |
| `scripts/` | Local development and browser audit helpers |
| `docs/` | Maintained operating references |
| `patches/` | Persistent dependency mitigations |

The JSON model catalog is shared by the website and API; parity tests check
rates, limits and capabilities. Server runtime overrides remain authoritative.
[Brand guidance](BRAND.md) covers the visual system.

## Production and customer surfaces

Vercel hosts the frontend; a Neon Function hosts the API and Neon Postgres
stores the ledger. Deploy both services when both change.
[Deployment](docs/DEPLOYMENT.md) contains exact targets, release procedures
and [verification checks](docs/DEPLOYMENT.md#release-verification).

The canonical host is `www.oma-ai.com`; the apex redirects to it. Customer
APIs are under `https://www.oma-ai.com/api`. There is no `api.oma-ai.com`.

| Surface | Purpose |
| --- | --- |
| `/models`, `/pricing` | Enabled models, capabilities and rates |
| `/chat` | Browser chat workspace |
| `/dashboard` | Overview, usage, keys and settings |
| `/settings` | Compatibility redirect to dashboard settings |
| `/deposit` | Prepaid account funding |
| `/docs`, `/getting-started` | Customer API setup and supported contracts |
| [`/api/v1/openapi.json`](https://www.oma-ai.com/api/v1/openapi.json) | Customer OpenAPI document |
| `/llms.txt`, `/agent-skill.md` | Public agent setup guides |

[Platform](docs/PLATFORM.md) explains authentication, funding and treasury
boundaries. [Chat UI](docs/chat-ui.md) explains browser storage.
[Settlement runbook](docs/settlement-runbook.md) covers payment recovery.
Private operator routes and deployment secrets belong in repository docs,
not customer guides.

MIT — see [LICENSE](LICENSE). Contributions should include relevant checks and
a clear description of the resulting behavior.
