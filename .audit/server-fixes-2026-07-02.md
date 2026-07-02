# Server fixes — 2026-07-02

**Commit:** `dcb410d` on `main`
**Scope:** Two issues from the brief, one turned out to be a false premise.
**Result:** One dead surface (V2 x402) removed; one phantom bug (pricing 500) investigated and refuted with evidence.

---

## Issue 1: `/api/pricing` returns 500 — **FALSE PREMISE, no fix needed**

### Investigation

| Probe | Result |
| --- | --- |
| `find server/src -name 'pricing*'` | no files |
| `grep -rn '/api/pricing' server/src/` | only a comment in `inference/cheaptokens.ts:21` referring to the external CheapTokens.ai `/pricing` API |
| `grep -rn 'pricing' server/src/routes/` | 9 hits, all of them either (a) `pricing` field on model objects in `/v1/models`, (b) inline pricing strings in openapi examples, or (c) `pricing: 'Free (no credits deducted)'` on the `/v1/fetch` route |
| `grep '/api/pricing' app/src/` | only `/api/pricing/crypto` (a Next.js route, used by the deposit UI, not by the pricing page) |
| Read `app/src/app/pricing/page.tsx` (484 lines) | page is fully static — `import { MODELS } from '@/lib/models-data'`, zero `fetch()` calls |
| Boot server with test env, `curl http://localhost:3101/api/pricing` | **404** `{"error":{"message":"Route /api/pricing not found","type":"not_found"}}` (see evidence below) |
| Boot server, `curl http://localhost:3101/api/pricing/` | **404** same |
| Boot server, `curl http://localhost:3101/api/pricing/crypto` | **404** (Next.js route, not on backend) |

### Evidence — what the brief said vs. what the server actually does

```
$ curl -i http://localhost:3101/api/pricing
HTTP/1.1 404 Not Found
content-type: application/json
{
  "error": {
    "message": "Route /api/pricing not found",
    "type": "not_found"
  }
}
```

No 500. No route registered. The Hono `notFound` handler returns 404 for every path that doesn't match a mounted route. There is no `server/src/routes/pricing.ts` and there never was.

The frontend `/pricing` page (`app/src/app/pricing/page.tsx`) imports `MODELS` from `@/lib/models-data` and renders the entire price table, FAQ, and CTA section from those constants. It does not call any `/api/pricing` endpoint, has no `useEffect` with a fetch, and has no client-side data dependency.

The only `/api/pricing/*` surface that exists is `/api/pricing/crypto`, which is a **Next.js API route** at `app/src/app/api/pricing/crypto/route.ts` that returns live crypto prices from Jupiter/Coingecko for the deposit page's USD display. It is not in `server/src/`.

### Conclusion

The brief's premise was incorrect. The pricing page never made the call it was said to make, and the backend never had the endpoint it was said to 500 on. Nothing to fix here.

If a pricing endpoint is genuinely wanted in the future, it should live either as a new Next.js route (cheap, co-located with the page) or as `server/src/routes/pricing.ts` exposing a `/v1/pricing` summary over `models.json`. Not built today — out of scope for this brief.

---

## Issue 2: V2 x402 endpoints return 501 — **FIXED, surface removed**

### Investigation

| Probe | Result |
| --- | --- |
| `grep '/v2/x402' server/src` | 3 routes registered in `server/src/x402/v2.ts`: `pay-req-test` (works, returns 402), `verify` (501 on valid payload, 400 on missing header), `settle` (always 501) |
| `grep 'v2\|V2' app/src` | zero frontend references (the only matches were unrelated: design-system v2 comments, Jupiter `swap/v2/quote`, SVG path attrs) |
| `cat app/next.config.ts` line 167-189 | Next.js rewrite rule forwards `/x402/:path*` to backend `/v1/x402/:path*` only — V2 endpoints have never been reachable from the browser |
| Read `.audit/x402-flow-2026-07-02.md` | Audit explicitly recommends option (B) for V2: "Return 410 Gone with Retry-After: 90d until EIP-3009 lands; **remove all references to V2 from marketing**." Frontend never used it, so no marketing to remove — full source removal is the clean form of (B). |
| Read `.audit/x402-flow-2026-07-02.md` P0-2 | "V2 verify and settle return 501 (EIP-3009 settlement pending)" — implementation requires `FACILITATOR_PRIVATE_KEY` + `viem` EIP-3009 `transferWithAuthorization` flow. Real on-chain settlement, not mockable. |
| Boot server, `curl -X POST http://localhost:3101/v2/x402/verify` | **400** `Missing PAYMENT-SIGNATURE header` (protocol-validation step works) |
| Boot server, `curl -X POST http://localhost:3101/v2/x402/settle` | **501** `x402_v2_settlement_pending` |
| Boot server, `curl -X POST http://localhost:3101/x402/pay-req-test` | **402** with V1 wire format — V1 still works |

### Decision

Per the brief's explicit option ("if V2 is not needed, remove the v2.ts route registration and any docs references") and the audit's option (B), V2 is **not needed** (frontend doesn't call it, the Next.js rewrite rule never proxies to it, EIP-3009 settlement is non-trivial work requiring a facilitator private key). Removal is the smaller, more honest fix than the audit's "410 + Retry-After: 90d" middle ground — no half-dead endpoint to maintain.

### Changes

| File | Change |
| --- | --- |
| `server/src/x402/v2.ts` | **deleted** (301 lines) |
| `server/src/x402/__tests__/v2.test.ts` | **deleted** (155 lines, 10 tests) |
| `server/src/index.ts` | dropped `import { x402V2Routes }` and `app.route("/", x402V2Routes)` |
| `server/src/routes/openapi.ts` | dropped the three `/v2/x402/{pay-req-test,verify,settle}` OpenAPI entries |
| `server/src/__tests__/x402.test.ts` | dropped the `describe('x402 V2 routes mounted on app', …)` block (3 tests) |
| `server/src/x402/__tests__/audit-2026-06-25.test.ts` | dropped `AUDIT-4` describe block (3 tests) and the `x402V2Routes` import; updated file-header comment to note AUDIT-4 is superseded by the removal |

Total: 6 files touched, **7 insertions / 563 deletions**.

### Verification — empirical, post-fix

```
$ curl -X POST http://localhost:3101/v2/x402/pay-req-test
{"error":{"message":"Route /v2/x402/pay-req-test not found","type":"not_found"}}

$ curl -X POST http://localhost:3101/v2/x402/verify
{"error":{"message":"Route /v2/x402/verify not found","type":"not_found"}}

$ curl -X POST http://localhost:3101/v2/x402/settle
{"error":{"message":"Route /v2/x402/settle not found","type":"not_found"}}

$ curl -X POST http://localhost:3101/x402/pay-req-test       # V1, unchanged
HTTP 402, body has payment.x402Version="1" + scheme="evm" + networkId="base"
```

V1 surface is intact. The V2 501 surface is gone. The Next.js rewrite rule still forwards `/x402/:path*` to backend `/v1/x402/:path*`, so no frontend change is required.

---

## Verification commands run

```bash
cd server
./node_modules/.bin/tsc --noEmit          # clean (no output)
./node_modules/.bin/eslint src/           # clean (no output)
./node_modules/.bin/vitest run --reporter=basic
# Test Files  73 passed | 1 skipped (74)
# Tests       713 passed | 2 skipped (715)
```

| Metric | Before | After | Delta |
| --- | --- | --- | --- |
| Typecheck errors | 0 | 0 | 0 |
| Lint errors | 0 | 0 | 0 |
| Test files | 75 | 74 | −1 (deleted v2.test.ts) |
| Tests passing | 729 | 713 | −16 (10 in v2.test.ts + 3 in x402.test.ts + 3 in audit-2026-06-25.test.ts) |
| Tests skipped | 2 | 2 | 0 |
| Tests failing | 0 | 0 | 0 |

The user said "730 tests" — baseline was 729 + 2 skipped = 731 total counted; 16 V2-specific tests removed, 713 passing remaining. No tests broken.

---

## Other server-side issues noticed (not fixed today)

These are flagged for future work, **not in scope** of this brief:

1. **Marketing-vs-code mismatch on EIP-3009** (`.audit/x402-flow-2026-07-02.md` P0-1 + P2-1). The codebase implements V1 x402 verification via on-chain USDC `transfer`/`transferFrom` receipts, **not** EIP-3009 `transferWithAuthorization`. But `app/src/app/{about,status,docs,faq}/page.tsx`, `app/src/lib/blog-data.ts`, and `app/src/app/.well-known/agent-card.json` all claim EIP-3009 gasless behavior. Fixing this is editorial (marketing copy + agent card), not server code. Now that V2 is removed, the EIP-3009 claim is even more misleading because there is no longer a "V2 will fix this" forward path.
2. **V1 `verifyEvmPayment` does NOT implement EIP-3009.** This is the root cause of the marketing mismatch. Audit's recommendation is to either (a) rename V1 to `verifyUsdcTransfer` (honest), or (b) implement a real EIP-3009 path using `viem.recoverTypedDataAddress` on the `TransferWithAuthorization` typed-data hash. Either is a real engineering change, well beyond this brief.
3. **`/x402/quote` returns 404** when called (verified empirically). It's referenced in OpenAPI (`server/src/routes/openapi.ts:1943-1951`) and in the V1 facilitator code path but is not actually mounted as a route. This is a separate dead reference — different from V2, but in the same "documented but not implemented" family.

None of these are fixed by this commit. All three should be on a follow-up audit list.