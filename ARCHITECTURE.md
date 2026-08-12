# Architecture Guidelines & System Design

Unified Monorepo Architecture for **OMA AI** (Open Model Access API Gateway + Next.js Web Application).

---

## 1. Directory Structure

```text
OMA-AI/
├── package.json               # Monorepo root package definitions and validation scripts
├── pnpm-workspace.yaml        # Workspace configuration routing to app/ and server/
├── pnpm-lock.yaml             # Single, unified lockfile for the entire monorepo
├── docker-compose.yml         # Dev environment container mapping (Postgres, Redis, app, server)
├── docker-compose.prod.yml    # Production container mapping (resource bounds, CF Tunnel ready)
├── app/                       # Next.js 15 Web Application (Frontend)
│   ├── Dockerfile             # Multi-stage production container build (standalone tracing-safe)
│   ├── package.json           # App-specific runtime/dev dependencies
│   ├── next.config.ts         # standalone build, outputFileTracingRoot config, CSP, rewrites
│   └── src/                   # Source directory (App Router layout, components, context state)
└── server/                    # Hono REST API Server (Backend)
    ├── Dockerfile             # Production container build with workspace package filters
    ├── package.json           # Server-specific Hono/Drizzle runtime packages
    └── src/                   # Source directory (auth, database, payment rails, inference proxy)
```

---

## 2. Authentication Flow

OMA AI utilizes a cohesive, split cookie/bearer authentication framework powered by **Better Auth**:

- **Web App Auth:** Cookies are handled by Better Auth client/server middleware, sharing sessions across development ports via cross-subdomain configurations or standard cookie flags.
- **API Access:** Clients can generate programmatic `oma_sk_...` keys from the dashboard, which translate HttpOnly headers/tokens to the Hono backend gateway under bearer tokens (`Authorization: Bearer <token>`).
- **SIWE Integration:** Standard EIP-4361 wallet sign-in dynamically maps addresses to users, fetching ENS records and linking multiple login identities under a single profile where emails align.

---

## 3. Payments & Treasury Infrastructure

```text
                  ┌──────────────────────┐
                  │    User Deposits     │
                  └──────────┬───────────┘
                             │
            ┌────────────────┴────────────────┐
            ▼                                 ▼
   ┌─────────────────┐               ┌─────────────────┐
   │  USDC on Base   │               │  USDC on Base   │
   │  (Direct EOA)   │               │  (Direct EOA)   │
   └────────┬────────┘               └────────┬────────┘
            │                                 │
            ▼                                 ▼
   ┌─────────────────┐               ┌─────────────────┐
   │ Deposit Recovery│               │ Deposit Recovery│
   │  Watcher Daemon │               │  Watcher Daemon │
   └────────┬────────┘               └────────┬────────┘
            │                                 │
            └───────────────┬─────────────────┘
                            │
                            ▼
               ┌───────────────────────────┐
               │    Credit User Account    │
               │ (update credit_balances)  │
               └───────────────────────────┘
```

The gateway exposes three independent, auditable payment rails:

1. **USDC Direct Deposits (Base):** Users connect their wallet in the app and send USDC directly to the OMA treasury on Base mainnet (with min/max limits checked). The authenticated submit records `txHash + fromAddress`; an asynchronous block-indexing daemon (`deposit-recovery.ts`) monitors Transfer logs to the treasury, verifies the on-chain sender matches the recorded wallet, and credits the balance. No memo or calldata payloads are used.
2. **x402 Micropayments (Gasless):** Supports HTTP 402 Pay-Per-Request headers. When an agent calls an endpoint, OMA AI checks for EIP-3009 signed authorizations. Valid requests are either processed in gasless mode via the QuickNode Hosted Facilitator, or simulated locally for preview setups.

---

## 4. Build, Validation, & Deployment

### Package Verification

Workspace health is verified at the root level using:

```bash
pnpm run validate
```

This runs TypeScript compiler checks, ESLint linting, and Vitest test suites concurrently across the workspace packages.

### Production Docker Builds

Docker images are built from the root workspace directory to allow resolution of the shared pnpm lockfile:

```bash
# Build app container from workspace root
docker build -t oma-app -f app/Dockerfile .

# Build server container from workspace root
docker build -t oma-server -f server/Dockerfile .
```

The application uses Next.js standalone output to minimize image sizes, copy static bundles cleanly, and run directly via Node.js.
