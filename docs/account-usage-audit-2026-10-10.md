# Account, usage and treasury audit — October 10, 2026

This follow-up covers the user dashboard, settings, local test tooling, database cleanup, treasury visibility and the chat defects encountered in real authenticated use. It builds on [the platform audit](audit-2026-10-10.md).

## Changes

- Customer statistics now come from a full-range `/v1/usage/summary` aggregate rather than a capped download of request history. The 24-hour card uses a rolling 24 hours independently of the selected chart range. Charts include empty time buckets and the account's browser timezone; all-time charts group by month.
- Request history loads on demand and preserves PostgreSQL microseconds in its cursor. Tokens can exceed a 32-bit sum without overflow. Filters and page totals cover the complete matching range. Requested/served models, refunds, cancellations, free website calls and small charges are distinguishable.
- Refunded usage contributes zero net spend. Credit activity records the original debit and separate refund, including a recent refund of an older request. Export includes `billed_cents` and `refunded_at`. Legacy credit batches no longer inflate the customer balance. Private dashboard/balance caches include account identity.
- Settings includes an explicit session refresh and derives query errors from current results. Clearing history invalidates the new aggregate cache. Account deletion, old-session rejection, session revocation, wallet sign-in and signup-grant replay protection are exercised against the real local API and database.
- Admin payments adds an on-demand, read-only check for Base USDC and ETH balances, with separate recipient, direct-deposit and facilitator roles. Checks enforce admin access, have a timeout and reuse RPC reads for shared addresses. Mock mode reports that balances were not checked. The facilitator's private key is never returned.
- Streaming inference now requests final upstream usage totals. The server accepts valid zero counts, handles a final SSE line without a newline and estimates complete content/reasoning/tool fragments when usage is absent. Chat displays output tokens separately from input tokens.
- Removed two obsolete diagnostic scripts that duplicated old analytics SQL and 12 generated browser-report files. Backfill defaults to a dry run. Local fixture/cleanup tools reject remote databases, remote app origins and production/staging/preview. Cleanup makes an owner-only full database backup first.

## Real model checks

GLM's direct upstream and authenticated browser responses repeated the answer until truncation. GLM is temporarily paused alongside the previously paused Gonka DeepSeek route. The picker excludes unavailable routes from selection and counts, preserves pause flags when falling back to static data, and links to model status. MiniMax M2.7 is the new default. FAQ, getting-started and API documentation no longer promise three active free routes.

MiniMax answered the browser prompt “What is 2 + 2?” with `4` in approximately 3.7 seconds. A streaming API check emitted a valid `add` tool call with arguments `{a:2,b:2}` and final upstream counts. Its continuation produced malformed native tool markup; a second continuation check with the tool definitions retained also failed the strict answer check. **Tool-result continuation remains an upstream quality issue, not a passed coding workflow.** The MiniMax model description now discloses this limitation. `test-live-model-tools.mjs --run` retains the strict check for later provider retesting; it is deliberately opt-in and currently fails on that known continuation defect.

The ignored local OpenBroker URL had pointed at another project's proxy on port 4097, which rewrote model parameters and authorization. Local OMA now calls the official API directly. The other project's process and files were preserved. Local payments were switched to mock mode before the account/payment checks.

[OpenBroker's FAQ](https://openbroker.gonka.gg/docs/faq) explains that host selection can take minutes and that capacity rejections need backoff. Its public status is not a model-output quality guarantee. Our gateway retains its bounded 240-second overall request budget. Gonka resale remains $0.02 per million input/output tokens. Actual USD procurement cost remains unknown until GNK expenditure and conversion are reconciled; unknown cost is not reported as profit.

## Payments and treasury

| Flow | Destination and credit trigger |
|---|---|
| Card packs | Polar checkout; a verified signed webhook adds credits |
| Direct USDC | The configured Base deposit address; a confirmed transfer and unique deposit record add credits |
| x402 | The configured Base treasury recipient; wallet authorization is broadcast by the facilitator, then confirmed and credited once to the bound payer |

The x402 recipient and direct-deposit address may differ. The facilitator pays Base transaction gas from its own ETH wallet; the recipient does not need ETH to receive USDC. Customer credit balances are accounting records, separate from treasury funds and provider procurement balances.

A read-only Base RPC snapshot found 0 USDC and 0 ETH at the public production x402 recipient `0x3144293aacc1c26eb803591151d775ed89eefcfe`. That does not establish the facilitator's gas balance. No mainnet payment, purchase, wallet transfer or production account deletion was executed. Production facilitator readiness still requires an authenticated balance check and a separately authorized settlement test.

## Cleanup receipt

[The database receipt](database-cleanup-2026-10-10.md) records the approved production transaction: 6 expired sessions and 14 expired verification records removed at a fixed cutoff. Both production test accounts and the active `operator-debug` key remain, as the user requested. No financial, anti-abuse or audit records were removed.

Local cleanup removed nine historical test accounts and 27 expired sessions after saving `.artifacts/database-backups/local-1791672109352.dump`. Current user/admin fixtures and the founder account remain. The generated backup and screenshots stay outside Git.

## Verification

- Frontend: 714 tests passed; production build generated 79 routes; lint passed.
- Backend: 517 tests passed, 6 skipped; type checking and lint passed. The skipped tests are reported as skipped, not executed checks.
- Real HTTP/PostgreSQL integration: all 13 groups passed, including more than 2,000 history records, microsecond pagination, four billion input tokens, sub-cent spend, refunds, permissions and account deletion.
- Browser: authenticated MiniMax chat, live dashboard/usage, desktop/mobile layout and session refresh. The user export downloaded eight records with `billed_cents` and `refunded_at`. At 390px, the usage page's document width was also 390px. The final user dashboard/usage checks produced no captured warnings or errors after 23:15 UTC. Treasury was checked in local mock mode; mainnet settlement was not tested.
- Screenshots are under `.screenshots/account-audit-2026-10-10/`. An intermediate missing-chunk error while replacing the local production build disappeared after restarting the server and reloading; it is not counted as a clean console capture.

## Release verification

Application commit `b0fdcf3f0e83a24de40e915b08a3937563f3413f` is pushed on `codex/repo-vercel-audit` and reviewed in [PR #30](https://github.com/NosytLabs/oma-ai/pull/30), which remains open. Vercel production deployment `dpl_4Z5GJmT6QBboQ42AWDKCBTLbahPH` reached READY at `oma-2svrx46pa-nosyt.vercel.app`; Neon function `omaapi` has completed and active deployment 73, Node.js 24 and 2048 MiB memory.

Production checks at approximately 23:17 UTC returned 200 for the frontend health endpoint, model catalog, chat, MiniMax model page and docs. Neon `/ready` returned 200 with database and Redis ready. Both native Neon and same-origin frontend usage-summary/treasury endpoints returned 401 without credentials, as required. An initial native usage-summary probe returned 404 during deployment propagation; subsequent plain and range-query checks returned 401 and the published OpenAPI document included the route. The live pricing screenshot shows the current $0.02 rate, 18 enabled models and aligned summary cards.

These checks do not establish authenticated production analytics or mainnet settlement. Authenticated user/admin verification used local accounts and the real local database. The MiniMax continuation defect and unverified production facilitator readiness remain explicit limitations.
