# Internal Sourcing (operator-only)

**Status: live as of 2026-06-12 refactor.**

This document is **operator-internal**. It is not surfaced to users in any
form. Users see one provider: **Venice**. The fact that OMA sources
Venice credits from upstream discount markets is an implementation
detail of the OMA business, not a product feature.

## User-facing model

- The user deposits USDC on Base (or via Houdini / CCTP / LiFi).
- The user gets OMA credits at a flat 1:1 USD value.
- The user creates an API key.
- Every inference call hits `https://api.venice.ai/api/v1`.
- The user sees model names (`claude-opus-4-7`, `gpt-5.5`, etc.) and
  per-1M-token prices. Nothing else.

## How OMA buys Venice credits

The OMA server uses two upstream markets to buy **discounted Venice
inference credits** that it then resells to users at a flat markup.
Both markets sell *real, working Venice API keys* — not model
substitutes.

| Upstream | URL | What it sells | Discount curve |
|---|---|---|---|
| CheapTokens | `https://cheaptokens.ai` | Pre-funded Venice keys, daily credit limit, expires at midnight UTC | 40% early in the day → 90% near midnight UTC |
| Surplus Intelligence | `https://www.surplusintelligence.ai` | Order-book resells of surplus Venice capacity, paid per-request via x402 | Variable; OMA only buys at `>= 30%` off retail |

The OMA server's `inference/cheaptokens.ts` module runs a background
loop that:
1. Polls `https://cheaptokens.ai/api/pricing` every 15 minutes.
2. If the discount is at or above `CT_MIN_DISCOUNT` (default 40%) and
   supply is available, buys a key for `$0.50` worth of credits.
3. Maintains a 3-key pool (round-robin) so per-key RPS limits on
   Venice don't get hit by a single key.
4. Invalidates any key that 401s (revoked or expired) and triggers
   an immediate refresh.

`inference/venice.ts` reads `getActiveVeniceKey()` on every request and
uses it transparently. If no CheapTokens key is currently leased, it
falls back to `config.VENICE_API_KEY` (a direct Venice BYOK key). The
user cannot tell which path served the call.

## Surplus as a backup procurement path

`inference/surplus.ts` remains in the codebase but is **not a
user-facing route**. Its historical purpose was x402 pay-per-request
to Surplus's order book; this was always an internal fallback when
CheapTokens was sold out or below the discount floor.

Going forward, Surplus is only used **manually** by the operator
(offline purchase of a discounted Venice key via Surplus's UI) to
top up the OMA treasury in extreme cases. It is not in the request
hot path.

## Pricing to the user

`server/src/db/seed.ts` and `server/src/routes/config.ts` define a
single markup field:

```ts
{
  providers: {
    venice: { markupPercent: 25 }  // flat 25% over Venice retail
  }
}
```

This is what the user pays. The OMA cost basis (Venice retail vs
CheapTokens at 40-90% off) is **operator-margin information**, never
surfaced to the user. Revenue reports join `usage_records.cost_cents`
(the amount OMA paid Venice) against `usage_records.total_cents` (the
amount the user paid) to compute the spread.

## What is *not* changed

- Model display tiers (`budget | mid | premium | frontier`) in
  `app/src/lib/models-data.ts` are a UX badge for the model catalog,
  not a billing tier. They are kept.
- `Surplus_` and `CheapTokens_` env vars remain in the code (and
  `server/.env.example`) because the modules are still loaded. They
  are simply not surfaced in the pricing table.
