# Gateway API, authentication and provider audit — 2026-10-10

Scope: real local account and provider calls, two-account authorization tests,
browser key management, API documentation, deployment boundaries and cleanup.
Local time was October 10; some provider receipts are dated October 11 UTC.

## Fixes

- API-key validity now comes from Postgres on every request. Only concurrent
  in-flight lookups share a result. Stale positive Redis entries cannot keep
  revoked, expired or deleted keys valid. Previously, expiry could survive as
  a string in cached records and the cache lifetime refreshed on every hit.
- Missing accounts block authentication. Failure to check suspension/account
  status blocks protected requests with a safe 503. Invalid explicit keys
  cannot fall through to anonymous free chat. Optional authentication reuses
  the bearer validator, including IP restrictions and suspension checks.
- Both website proxies remove client `x-neon-*` headers. The general proxy
  refuses internal recovery/settlement paths, including encoded variants.
  Native scheduler authorization requires the Neon runtime and excludes the
  website proxy hop. Auth transport failures no longer expose diagnostics.
- Session-only key creation accepts a 1–365 day expiry and a catalog model
  allowlist. Both inference APIs enforce the allowlist on primary and fallback
  models. Oversized output limits fail before upstream work; unsuitable
  smaller-output fallbacks are skipped.
- Upstream credential failures return gateway 502 errors instead of customer
  401 errors. Other models using that same rejected provider credential are
  skipped within the request. Cross-provider fallback remains possible when
  the key scope permits it.
- The model limiter now returns its inner middleware response. Default rate
  budgets are separated by HTTP method and registered route pattern; dynamic
  IDs share a route budget. Key creation cannot exhaust account deletion's
  budget. Explicit shared prefixes retain their intended behavior.
- A Redis command failure now preserves a bounded free-chat daily quota.
  Paid key requests do not consume the free quota. Daily rejections include
  Retry-After; degraded memory limits remain weaker than shared durable Redis.
- Completed OpenAI idempotency-key reuse returns explicit 409 already_processed
  without another charge/call. It no longer invents a successful empty answer.
  Full response replay and simultaneous upstream-call deduplication are not
  implemented; clients must retain their original completion.
- Key UI adds expiry, last use and model restrictions; its one-time secret
  dialog isolates each new key, auto-hides, traps focus and supports Escape.
  Duplicate creation prompts disappear while the form is open. All four
  dashboard tabs remain visible on narrow screens.
- Removed unused Surplus configuration/catalog routing metadata and a false
  privacy processor row. Historical provider records/migrations remain intact,
  and usage breakdowns retain those records in their totals. Dated audit docs
  moved to this directory; a docs index replaces the duplicate deploy status.

## Verification

- Frontend: 744 passing tests; lint, type checking and production build pass.
- API: 553 passing tests, six explicitly skipped; lint, type checking and
  production build pass.
- Real HTTP/Postgres: 20 passing groups against a migrated disposable database.
  Two accounts cannot read each other's keys, sessions, usage or exports,
  install/revoke another key, revoke another session, or self-promote to admin.
  Profile writes reject protected role/wallet fields. Account deletion ignores
  caller-supplied user IDs and invalidates the deleted account's active keys.
  Cross-site mutations and forged local scheduler headers are rejected.
  SQL-like filters remain literal parameters; invalid UUID filters fail.
  Signup, returning login, session replay/revocation, real SIWE signatures,
  admin financial controls and safe database-error responses also pass.
- Browser: authenticated local fixture; key form controls, default expiry,
  cancellation and desktop/390px/320px layouts verified. No page overflow,
  duplicate IDs or captured console warnings/errors. Credentials were created
  and revoked through the opt-in HTTP probe, not left behind by the form.
- Static build: 141 browser JavaScript files checked against nine configured
  local server values. No real secret matched. One match was the tracked local
  mock private-key placeholder, also a public Noble curve constant; no server
  environment value was injected to produce it. Local `.env` URLs return 404;
  private usage/export/treasury endpoints return 401 without credentials.
- Production dependency audit: zero known vulnerabilities. Compatible
  dependencies were already updated in the preceding release, including
  Better Auth 1.7.7, Next 16.4.0 and viem 2.57.4. TypeScript stays at 6.0.3
  because the current linter peer range excludes 7; Node typings remain on 24
  to match Vercel and Neon. The patched dev-only braces advisory remains
  visible in the full audit; the production dependency tree is clean.

## Real provider results and remaining limits

The opt-in live probe signs in through the real magic-link verifier, creates
a one-day model-scoped key, calls the gateway, reconciles persisted usage with
the balance deduction, revokes the key, checks 401 and removes its session.
It stores no raw key or cookie in its report. Actual inference charges remain
in the ledger; test cleanup does not falsify financial history.

- MiniMax M2.7 primary route: HTTP 200, actual-model header matched, final
  answer OMA_API_OK, finish reason stop. Latest call used 49 input/139 output
  tokens, charged 0.000376 cents, and reconciled exactly within numeric
  tolerance. It took about 72 seconds. Inline reasoning was preserved in the
  raw receipt; only the probe's final-answer assessment excludes a complete
  leading think block.
- Venice Gemma primary route: HTTP 502 after the configured local Venice
  credential received upstream 401. No usage charge. Direct credential
  verification also failed. Public model metadata alone does not establish
  credential validity. A valid provider credential/credit allocation is still
  required; production Venice inference was not authenticated in this run.
- The initial catalog probe attempted 18 enabled models. Three successes were
  MiniMax fallbacks, not proof of those requested primary models. The limiter
  failures found during that probe are fixed; blanket model-health claims
  would still be inaccurate.
- OpenBroker MiniMax tool round trip: first streamed tool call correctly
  requested add(2,2). The continuation included malformed upstream tool markup
  despite mentioning 4. This provider/coding behavior remains unresolved;
  the gateway does not strip evidence to fabricate a passing tool result.
- Venice's 17 catalog metadata matches were checked for price, context,
  output and capabilities. OpenBroker's three active IDs matched OMA routes.
  Public Base/PublicNode RPC chain reads succeeded; LlamaRPC returned a
  non-JSON response, so the example fallback now uses mainnet.base.org.
  Multiple endpoints improve resilience without guaranteeing availability.
- No mainnet transfer was performed. The previously read treasury had zero
  USDC/ETH; facilitator gas funding and successful live payment-to-credit
  reconciliation are not established by readiness or configured wallet names.

Evidence artifacts (ignored, local): `.artifacts/provider-audit/` and
`.screenshots/account-audit-2026-10-10/api-key-scope-{desktop,mobile}-final.jpg`.
Maintained behavior/configuration: [Platform](../PLATFORM.md),
[Deployment](../DEPLOYMENT.md), [Settlement runbook](../settlement-runbook.md).

## Release receipt

Release identifiers and production probes are recorded after deployment.
