# OMA site, authentication and API audit — 2026-10-07

## Scope and changes

Reviewed the public site in a real browser, captured desktop/mobile screenshots,
and exercised signup/login, wallet authentication, user/admin access, API keys,
chat, model routing, settings, API documentation and payment validation. Read
repository/deployment instructions and inspected the current Vercel, Neon and
GitHub state. Context7 and Firecrawl supported the documentation/site audit.

Changes address reproduced failures:

- Free website chat no longer throws `unusable` when middleware rereads a body.
- Model rate-limit rejections propagate instead of becoming 500 responses.
- Default rate-limit counters are scoped to the method and registered route,
  so chat cannot exhaust key-creation or admin budgets. Explicit shared prefixes
  keep their existing behavior. Route parameters do not create new counters.
- Wallet discovery deduplicates repeated EIP-6963 announcements and initializes
  already injected wallets, preventing recursive discovery and false absence.
- Development magic links match Better Auth's current hashed-token format.
- Admin settings read saved operator intent through an admin-only endpoint;
  saved maintenance text and payment toggles survive reload.
- OpenAI assistant tool calls, tool result IDs and `response_format` survive
  validation and forwarding to the provider.
- Malformed x402 authorization times and signatures reject before chain calls.
- Unexpected server exceptions return a generic error and correlation ID.
- Guest chat no longer fetches an authenticated balance after sending.
- Docs navigation/search, keyboard focus, mobile model selection and dashboard
  columns are aligned. The analytics banner reserves space above the composer.
- Admin usage/spend has a full-width row instead of squeezing five metrics
  inside a single third-width card; operator controls use two columns.
- API examples, streaming code, OpenAPI schemas and auth/deployment guidance
  are corrected. Duplicate examples, unused timers and dead helpers are removed.
- Neon code-only deploys preserve environment/triggers. Vercel uploads exclude
  local environment files and audit artifacts.

## Verification

| Check | Result |
| --- | --- |
| App typecheck, lint, unit tests and production build | Passed; 642 tests |
| Server typecheck, lint, unit tests and build | Passed; 490 tests, 6 opt-in database tests skipped in the default run |
| x402 plus explicitly enabled local Postgres payment tests | 125 passed, including the otherwise skipped database tests |
| Real HTTP + Postgres auth integration | 11 checks passed; temporary databases removed by the runner |
| Playwright browser suite | 95 passed |
| Local model gateway sweep | All 21 catalog routes returned 200 with the controlled HTTP provider fixture |
| Local API contract | Tool-result/structured-output requests and streaming returned 200; invalid messages 400; revoked key 401 |
| Production public pages | Home, docs, chat, models, pricing and login: 200 at 1440×1000 and 375×812, no horizontal overflow or console/page errors |
| Neon readiness | Postgres and Redis healthy; migration 0004 columns present |

Local browser tests used `oma-test-user@local.test` and
`oma-test-admin@local.test` in an isolated database. Both magic-link login and
a real locally signed SIWE message established sessions. User access to admin
was denied. Admin credit adjustment, suspend/restore and settings reload were
tested locally. Temporary API keys were revoked. No production accounts,
balances or payment settings were changed.

Screenshots are retained locally under `.screenshots/audit-2026-10-07/` and
are intentionally excluded from Git. Detailed command output and isolated test
fixtures are under `.tmp/browser-audit/`, also excluded from Git.

## Live model results and remaining limits

- GLM-5.3 Flash: production browser stream returned the requested sentence.
- MiniMax M2.7: production browser stream returned `OK` and completed.
- DeepSeek V4 Flash through OpenBroker: HTTP 200, but repetitive output and
  `finish_reason: length`, reproduced with a fresh arithmetic prompt. The UI
  flagged low quality/truncation. The route is now paused in the catalog and rejected before inference; it is excluded from automatic fallback.
- The local Venice credential was rejected with 401 for all 18 Venice models.
  Production paid-model inference is **not verified** by these checks. The
  configured/available flags are not inference health checks.
- Payment validation and ledger idempotency were exercised with local Postgres
  and controlled chain responses. No real card purchase or on-chain transfer
  was submitted. Real-money settlement remains unverified.

This audit covers the listed routes and failure modes. It is not a claim that
every possible account state, provider behavior or code path is defect-free.

## Releases

Neon `omaapi` deployment **64** includes the server fixes, preserving production
configuration and scheduled triggers. The frontend is deployed to the existing
Vercel project `oma` and canonical `https://www.oma-ai.com`; the final deployment
identifier is recorded in the task completion report.


## Expanded model, wallet and dependency pass

- One shared model catalog now supplies billing and UI fallback data. Gonka is exactly $0.02/M input and output; Venice is 50% markup over its refreshed published catalog, including long-context tiers.
- Paused the absent Venice Mistral entry and the degraded OpenBroker DeepSeek route. Model details show output limits and pause reasons; dashboard counts exclude paused entries. Added context/output validation and increased reasoning-model examples to 1,024 output tokens.
- MiniMax and GLM completed production coding checks with 1,024-token budgets. Both returned tool calls and accepted synthetic tool results. Some upstream output contained duplicate calls, inline reasoning or stray control text. No generated tools were executed.
- Browser and backend settlement use bounded Base public RPC failover. Mainnet Base and PublicNode returned chain 8453; Llama returned HTML and was removed. Connected QuickNode endpoints were suspended.
- Wallet setup handles missing Base network definitions with public RPC settings. Better Auth SIWE signatures, nonce replay, magic-link sessions and admin authorization passed real local HTTP checks. Optional ENS lookup timeouts are bounded.
- Estimated provider cost is independent of final customer overrides. Signed-in free/aborted usage records retain cost but no customer revenue. Admin gross margin uses revenue as denominator and is explicitly an estimate.
- Updated all direct dependencies to latest except TypeScript 6.0.3, retained for current ESLint parser compatibility. Migrated Polar's versioned SDK. pnpm overrides remove vulnerable transitive esbuild and KaTeX releases. One unpatched braces advisory remains in lint tooling.

Validation: frontend typecheck/lint/build and 647 tests; backend typecheck/lint/build and 500 tests (six database cases skipped in the ordinary suite, exercised in the separate database run); 95 browser-suite checks; 11 real auth integration flows; 125 payment checks with isolated Postgres. Browser login, chat, admin, model details and 375px screenshots were checked with the in-app browser; inspected console had no warnings/errors. Production paid Venice inference and a funded mainnet settlement remain unverified.

See [pricing, limits and treasury operations](../pricing-and-treasury.md) for current configuration, costs and external sources.
