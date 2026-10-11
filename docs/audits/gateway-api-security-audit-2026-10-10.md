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
- Spend-donut totals, tooltips and accessible descriptions preserve sub-cent
  charges instead of contradicting the detailed table with a rounded zero.
- Removed unused Surplus configuration/catalog routing metadata and a false
  privacy processor row. Historical provider records/migrations remain intact,
  and usage breakdowns retain those records in their totals. Dated audit docs
  moved to this directory; a docs index replaces the duplicate deploy status.

## Verification

- Frontend: 746 passing tests; lint, type checking and production build pass.
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
`.screenshots/account-audit-2026-10-10/api-key-scope-{desktop,mobile}-final.jpg`,
plus `usage-spend-precision-final.jpg` in the same screenshot directory.
Maintained behavior/configuration: [Platform](../PLATFORM.md),
[Deployment](../DEPLOYMENT.md), [Settlement runbook](../settlement-runbook.md).

## Release receipt

Verified on October 11 UTC (October 10 local):

| Service | Source commit | Production deployment | Result |
| --- | --- | --- | --- |
| Vercel frontend | `53f2d7c5adec7ad7f9193f31257aaaea44e06036` | `dpl_DJ6fr4mYvFyjX6Jtn2WyxboGtXYs` | READY; canonical `www.oma-ai.com` resolves to this deployment |
| Neon API | `d19d7af3ecd30722b22ae432772f4de6f97b252f` | `omaapi` deployment 77 | Current and active deployments completed; Node.js 24 |

The frontend follow-up only changes chart precision; API deployment 77 includes
all authentication, authorization, key controls, quota and inference fixes.
Both production services retain their existing environment configuration.

Post-deployment checks:

- Landing, pricing, models, docs, web health and x402 info: HTTP 200.
- Native API readiness: HTTP 200; Postgres and Redis checks both healthy.
- Anonymous keys, usage, account export and admin treasury: HTTP 401, with
  `no-store` responses.
- Forged scheduler headers sent through the website to internal deposit
  recovery and settlement retry routes: HTTP 404. An unauthenticated native
  recovery request with the forged header: HTTP 403.
- Invalid bearer credentials on website chat: HTTP 401; no anonymous fallback.
- Public `/.env`: HTTP 404.
- Live OpenAPI: session-cookie authentication for key creation/deletion,
  documented expiry/model restrictions, and inference 403/409/502 responses.

No successful scheduled invocation was observed in the sampled function logs.
The production probes do not establish every model's health, a funded
facilitator, or successful mainnet payment settlement. The limitations above
remain part of this release receipt.

## Wallet and dependency follow-up

The next pass used Context7's current x402, injected-wallet and Better Auth
documentation. No compatible application dependency upgrade remained. The only
newer reported versions were TypeScript 7 (outside the linter peer range) and
Node 26 typings (different from the deployed Node 24 runtime). A fresh production
dependency audit reported zero known vulnerabilities across 671 dependencies.
OMA's x402 adapter implements the v2 exact/Base USDC envelope; it is custom code,
not an outdated installed x402 npm package.

Additional fixes:

- Preserve a direct deposit's transaction before proof signing can fail.
  Preflight the account-bound challenge before broadcasting, refresh proof on
  registration retries, and never resend funds from the retry action.
- Keep recovery metadata in account-scoped session storage across same-tab
  reloads. Store no key, cookie or signed proof with it. Show the chain explorer
  link and avoid offering another transfer while registration is unresolved.
- Reject fractional-cent USD input before a transfer to avoid disagreement
  between the transferred amount and the direct-deposit cent ledger.
- Observe wallet account/disconnect events, check the sending account before
  signing/transferring, retain the selected provider on reconnect, and handle
  synchronous EIP-6963 announcements without recursive discovery.
- Consolidate deposit requests/types in the API client, replacing an unused
  proofless submit helper. Document the challenge and required ownership fields.
- Remove unused limiter instances that created background timers, unused
  imports/parameters, and a WalletConnect install link that implied an
  unimplemented connector. Correct the runbook's x402 recipient lookup.

Fresh verification: 757 frontend tests across 115 files; 553 API tests with six
explicit skips; all 20 real HTTP/Postgres signup/account/admin groups pass.
Frontend build/lint/type checking and API lint/type checking pass. Frontend
unused-local/parameter checking also passes. The optional stricter API scan
reports two pre-existing unused parameters; its required checks remain green.

A new temporary one-day model-scoped API key completed a real MiniMax request:
49 input/102 output tokens, 0.000302 cents charged, final answer OMA_API_OK,
matching persisted usage and balance deduction. The key then returned 401 after
revocation; its temporary session was removed. Only that primary model was
authenticated in this follow-up; prior Venice/tool-call limitations remain.

Read-only production checks found x402 v2/Base configuration and all three rail
flags enabled. The public x402 recipient held zero ETH and zero USDC. This does
not reveal the separate facilitator's gas balance. Neon deployment 77 remains
current/active and completed. No live payment was signed or broadcast.

WalletConnect mobile/QR sessions remain unimplemented. Browser checks use the
local fixture and a browser with no injected wallet; mocked wallet I/O exercises
broadcast, proof refusal, expiry, reload recovery and account isolation without
pretending a real on-chain payment passed.

This frontend follow-up's deployment receipt is recorded after publication.
