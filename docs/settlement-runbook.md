# OMA-AI Settlement Activation Runbook (Base/USDC/x402)

Status: **CONFIGURED, NOT LIVE** — treasury wallet created + wired, settlement still `mock`.

## Treasury wallet (dedicated, self-custodied, generated with viem)
- **Address:** `0x3144293aACC1c26Eb803591151D775ed89eefcfE` (Base mainnet, chain `8453`)
- Wired in `server/.env` (gitignored, never committed):
  - `TREASURY_BASE_ADDRESS=0x3144293aACC1c26Eb803591151D775ed89eefcfE`
  - `USDC_DEPOSIT_ADDRESS=0x3144293aACC1c26Eb803591151D775ed89eefcfE`
  - `FACILITATOR_PRIVATE_KEY=<0x…>` (derives the address above — verified cryptographically)
- Private key rests ONLY in `server/.env`. Copy it into Bitwarden as the source of truth.

## To go LIVE (2 steps, in order)
1. **Fund the wallet on Base:**
   - a small USDC seed (enough for the first deposits you expect) — **Base USDC**: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
   - **~$2 of ETH on Base** for settlement gas (~$0.0001/tx → more than enough).
   - Verify balances on basescan.org for `0x3144293aACC1c26Eb803591151D775ed89eefcfE`.
2. **Flip the mode** in `server/.env` (and the Neon Function's env for prod):
   - `FACILITATOR_MODE=mock` → `FACILITATOR_MODE=live`
   - Redeploy. The code now **reports real x402 readiness** and refuses `mock` in a production `NODE_ENV`.

## Do NOT change
- `X402_FACILITATOR_PROVIDER=coinbase-cdp` — the code **deliberately rejects `quicknode`** as an unsafe settlement delegate (QuickNode is not a hosted settlement service for this merchant).
- QuickNode IS already used correctly as the **Base RPC provider** (`QUICKNODE_RPC_URL` → `CHAIN_RPC_URL`, free tier, $0).

## Cost profile (lowest cost path)
- Self-hosted `coinbase-cdp` settlement (EIP-3009 broadcast via viem + QuickNode RPC) — **$0 facilitator fees**.
- Base settlement gas ≈ **$0.0001/tx**.
- QuickNode free tier = up to **10M credits/month, $0**.
- Vercel: 1 production deployment (Hobby minimum) after the 11→1 prune.

## Deploy note (Vercel prod-branch bug)
Project `productionBranch` is stuck on the retired `master` (API re-link 400s; needs manual dashboard re-link). Workaround that works:
`vercel deploy --prod --yes` from `app/` (the project rootDir). Push-to-main does NOT auto-deploy.

---

# Polar (card checkout) — verified state & constraints

Checked live against Polar MCP on 2026-09-24, org `16ba0e5c-ea67-47ab-a54b-10a62851d95a`.

## Products (all `one_time`, non-recurring, public)

| Plan | Product ID | Price | Credits |
|---|---|---|---|
| Hobby | `4c1e6343-0e85-411c-b5e1-16d03aaed33d` | $10 | 1,000 |
| Builder | `7dade4d9-78d7-4163-a530-b35d95f9b457` | $50 | 5,000 |
| Scale | `da4cb123-d1a1-48d6-b97c-9c6023f8a81f` | $250 | 25,000 |

1 credit = $0.01, matching `creditsPerCent: 1` in `server/src/routes/deposit/index.ts`.
Also in this org: 7 ARCHIVED legacy products (`proxyresell*`, `cheapai*`, `datavalid*`) from
earlier brands. Not wired to OMA. Leave archived.

## Do NOT attach a metered price

Polar docs: "Metered prices are only applicable to Subscription Products."
All three products are `type=one_time`, so a metered price cannot be attached. Polar's own
Credits guidance: "To avoid any overage charges, don't create any Metered price on your product."

Architecture: Polar collects payment and is merchant of record. **Our Postgres credit ledger
is the authoritative spendable balance.** Polar meters are reporting-only.

## Benefits are empty on all three products

`benefits: []` on Hobby/Builder/Scale. Polar grants no entitlement via a benefit today.
Our own `order.*` webhook path issues credits, so checkout still functions. If we later want
Polar to be the entitlement authority, Polar recommends a **Feature Flag benefit** for tier
gating (purpose-built, supports key-value metadata) rather than a custom benefit.
Unconfirmed: whether a Credits benefit behaves correctly on a one-time product — verify in
the Polar dashboard before relying on it.

## Cost Insights is available but NOT automatic

Requires per-request `_cost` annotation via the Event Ingestion API:
`metadata._cost = { amount, currency }`. Gotchas: `amount` is in **cents, not dollars**, and
**only USD is supported**. Sub-cent precision is retained, so token-level costs aren't rounded.
Polar lists "AI/LLM Applications" as a first-class use case.

## Rate limits

Production **500 req/min** per org/customer or OAuth2 client; sandbox 100 req/min. Exceeding
returns `429` with `Retry-After`. Batch ingestion is available (`inserted` / `duplicates` in
the response). **No documented separate per-batch event-count limit** — unconfirmed.

**Important:** Polar attributes events to billing periods by *when Polar received them*, not
the supplied `timestamp`. Late events land in the current cycle. Another reason not to treat
a Polar meter as a real-time balance.

## Still required to complete checkout

1. `POLAR_ACCESS_TOKEN` — org-scoped OAT. Server-side only. `vercel env add POLAR_ACCESS_TOKEN production`
2. `POLAR_WEBHOOK_SECRET` — Dashboard → Settings → Developers → Webhooks (shown once)

### Rotating the webhook secret is a one-way door

If the server verifies signatures against a single key, rotating it invalidates every
signature ever issued and historical payments silently stop reconciling. Add a `kid` keyring
and accept the previous key BEFORE rotating. The access token is safe to rotate freely.

## Deploy note (Vercel)

`productionBranch` is stuck on the retired `master`; push-to-main does NOT auto-deploy.
Use `vercel deploy --prod --yes` from the repo root. API runs on **Neon**, not Vercel —
a Vercel deploy ships the frontend only and will NOT pick up server-side changes.
