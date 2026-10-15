# Gateway and account audit

Latest validation: October 15, 2026. These are dated observations, not a guarantee
that every provider or mainnet payment works. Maintained behavior is documented
in [Platform](PLATFORM.md), [Deployment](DEPLOYMENT.md),
[Chat UI](chat-ui.md) and the [account test guide](../server/scripts/README.md).

## Current verification

| Check | October 15 result |
| --- | --- |
| API | 658 tests in 79 files, including real Postgres credit/webhook tests |
| Frontend | 879 tests in 131 files; types, lint and production build passed |
| Real HTTP/auth | All 30 groups passed against an isolated migrated local database |
| Dependencies | Zero known production vulnerabilities across 890 dependencies |
| Runtime | Node 24 on both Vercel and Neon; compatible direct dependencies current |

The HTTP suite covers real Better Auth and signed SIWE login, origin checks,
OTP budgets, owner isolation, API-key scopes/expiry/revocation, deletion,
streaming, billing, concurrent requests and admin pagination through 1,001
fixture accounts. Provider responses in this suite are deterministic fixtures;
they do not prove real model quality. Local tests create and drop only their
own databases/schemas.

## Verified behavior

- Account data and caches are scoped to the authenticated user. Keys, sessions,
  deposits, usage and exports reject cross-account access. Deletion invalidates
  keys/sessions while retaining detached payment-security records.
- Public proxies block private job/website paths, strip forged runtime headers
  and keep database/provider secrets out of responses. Anonymous key and admin
  treasury requests return 401 and `no-store` in production.
- Sponsored website chat uses its own endpoint and UTC quotas. API-key calls
  always use prepaid credits. Both inference formats share authorization,
  output/context limits, usage billing and durable request claims.
- Polar uses the versioned SDK to verify the original body, including legacy
  and Standard Webhooks keys and multiple signatures. Event claiming and credit
  changes share one transaction. Eight concurrent paid/refund deliveries change
  the balance once; failed grants roll back and remain retryable. Tests use real
  signatures and Postgres, replacing mock-only money assertions.
- User overview, usage, keys and settings share one dashboard. Complete
  aggregates retain fractional cents; rolling charts exclude future requests
  and use elapsed time across clock changes. Stale refreshes cannot replace
  newer data, and request/summary failures remain visible.
- The read-only tour uses current model IDs, consistent accounting and bounded
  timestamps. Empty/retired catalogs produce empty sample history safely.
- Admin has cursor-paginated accounts and requests, usage/revenue charts,
  account controls and treasury diagnostics. Balance deductions lock/cap to the
  available balance. Notifications retain account-specific read state.
- Mobile chat drawers appear above navigation, fit above cookie controls and
  keep close buttons reachable. Parameters contain keyboard focus, close on
  Escape and return focus to their opener. Input effects respect reduced motion.
- Public docs/OpenAPI/agent guides omit private operator routes and distinguish
  free website chat, billed SDK requests and authenticated x402 funding.

## Release and live checks

[PR #39](https://github.com/NosytLabs/oma-ai/pull/39) updates the supported web,
auth and wallet dependencies. [PR #40](https://github.com/NosytLabs/oma-ai/pull/40)
fixes dashboard refresh/usage states. [PR #41](https://github.com/NosytLabs/oma-ai/pull/41)
fixes Polar delivery and mobile chat. Exact release checks belong in each PR.

PR #41 merged as `d49e4aa331b9c64098a79ec8b05b5bd4411849b2`. Vercel deployment
`dpl_3sFV71H4cpyFSUdwTjz5F8149TjC` was READY at that revision; Neon `omaapi`
deployment 90 completed on Node 24. Code-only deployment retained the same
40 environment names and both enabled recovery schedules; secret values were
not compared. Native readiness reported healthy Postgres/Redis. Unsigned native
Polar callbacks returned 401. A website alternate-callback 404 was reproduced
and traced to the proxy stripping `/api`; its regression checks preserve both
callback paths, the original body and signature headers.

The fresh MiniMax test returned the expected `OMA_API_OK` through Messages
(200; 49 input/77 output tokens; 33.9s). Chat Completions timed out upstream at
180s (408). Usage matched the balance deduction. Its temporary local API key
was revoked (401 afterward) and the session removed. Earlier tool tests obtained
initial function calls but failed strict continuation-quality assertions;
these assertions were not weakened. Current local evidence is retained in
`.artifacts/provider-audit/payment-chat-live-api-2026-10-15.json`.

## Open limitations

- The MiniMax timeout and earlier unwanted reasoning/continuation output remain
  provider issues. Gonka DeepSeek/GLM routes remain paused. Catalog enablement
  does not prove every model serves a good result.
- The local Venice key returns 401. Failed requests are not charged; production
  Venice inference remains unverified.
- Live WalletConnect QR pairing needs a valid public Reown project ID. Missing
  or placeholder IDs hide that connector; injected-wallet and local SIWE tests
  pass. No mainnet purchase or treasury transfer was signed.
- x402 v2 is OMA's authenticated USDC funding contract: verification broadcasts,
  settlement credits the SIWE-bound payer once. Generic facilitator and
  pay-per-inference compatibility are not claimed. Live gas/reconciliation and
  paid Polar checkout remain unverified.
- Balances remain aggregate. Per-grant refund/allocation policy requires a
  ledger migration. Gonka dollar profit needs GNK cost basis and retry costs;
  retail remains $0.02/M input and output. Venice catalog rates include 50%
  markup, not a claim about settled provider invoices.
- Messages supports text/function tools, not full Claude Code feature parity.
  Memory quota fallback is weaker than shared durable counters. Support form
  delivery needs a verified webhook; no Vercel log drain is configured.
- TypeScript 6 and Node 24 typings stay within the supported toolchain. The
  development-only braces advisory has a persistent recursion-bound patch and
  regression coverage; an upstream fixed release is not claimed. Deprecated
  transitive packages remain under their parent contracts.

## Cleanup boundaries and history

Obsolete Docker/Coolify/oldpc scaffolding, duplicated environment templates,
unused credit-batch UI wrappers, stale generated files and superseded audit
notes were removed. Repository logs, screenshots and private backups are not
tracked. Maintained runbooks, security/license notices, migrations and generated
agent instructions remain. Merged PRs are closed and branches removed; PR
history is retained. Deployment cleanup preserves the live version and rollback
candidates.

Production database cleanup was limited to the separately approved six expired
sessions and 14 verification records before `2026-10-10T22:40:00Z`. Both test
identities and the operator key were preserved. The
[exact cleanup receipt](audits/database-cleanup-2026-10-10.md) remains authoritative;
this audit does not authorize removing users or financial/anti-abuse records.

[Earlier reports and release receipts](https://github.com/NosytLabs/oma-ai/blob/d49e4aa331b9c64098a79ec8b05b5bd4411849b2/docs/AUDIT.md)
remain in Git history instead of being duplicated in the working documentation.
