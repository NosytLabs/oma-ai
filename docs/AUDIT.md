# Gateway and account audit

Latest inspection: October 23, 2026 (America/Moncton). These are dated
observations. [Deployment](DEPLOYMENT.md), [Platform](PLATFORM.md), and
[deployment verification](deployment-health.md) own maintained procedures.

## Production incident and release state

The website and catalog respond; 18 of 20 catalog entries are enabled.
Native API readiness returns 503: Postgres is unavailable and Redis is healthy.
A direct database probe returns HTTP 402, quota exceeded. The existing
`oma-ai-prod` project remains on `free_v3`; its reported consumption period
ends November 1, 2026 at 00:00 UTC (October 31 at 21:00 Atlantic).
Public settings fail closed, disabling new card and crypto funding.

The owner must resolve the existing project's billing/quota or wait for its
allowance reset. Redeployment cannot reset quota. Database inspection,
migration and live account/billing verification remain blocked. No customer
records, balances or payment settings were changed during this inspection.

[PR #45](https://github.com/NosytLabs/oma-ai/pull/45) merged the readiness UI,
account isolation and atomic usage-refund fixes. Its frontend was released;
its backend is still pending. The active Neon Function is deployment 91 from
October 15. Before releasing current backend code, apply migration
`0006_refund_precision` through the existing workflow. The frontend requires
`creditRefundsAvailable: true` before offering credit-refund intake; legacy or
unavailable backends leave it disabled. Historical granted decisions are not
automatically replayed or reconciled.

Both enabled recovery jobs remain on the 15-minute schedules corrected on
October 21. This is 192 scheduled invocations per day instead of 2,880;
it is not a measured compute saving or a quota reset. Retries can wait up to
15 minutes. Keep both jobs enabled for payment reconciliation.

## October 23 hardening

- Operational probes bypass the global maintenance-settings query. Liveness
  no longer wakes Postgres; database health and readiness perform their own
  dependency checks and remain available during maintenance.
- Account-readiness polling now records failed/successful checks so its
  existing exponential backoff and recovery reset actually run.
- Database query-error logging omits SQL, bound values, driver clients and
  nested database messages/stacks. Bounded SQLSTATE/HTTP diagnostics and
  correlation IDs remain. This extends the pool-error protection in
  [PR #46](https://github.com/NosytLabs/oma-ai/pull/46).
- Homepage payment copy qualifies card availability. Deployment docs reflect
  the current manual-only Actions workflows and distinguish web/API liveness
  from dependency readiness.

## Validation and dependency limits

Release-specific check results belong in the release PR. Regression cases
first reproduced leaking query values, maintenance-blocked liveness and the
inactive retry backoff before the fixes. Integration checks use a temporary
local Postgres database and local provider fixtures; they do not execute
mainnet payments or paid provider requests.

October 23 local checks passed: 936 frontend tests, 698 API tests with the
real Postgres ledger suites enabled, all 31 real HTTP/auth groups, types,
lint, both production builds and the frozen-lockfile install contract.

The October 23 production dependency audit reports two high-severity version
findings for transitive Zod 3.22.4 and 3.25.76 under the wallet SDK. The
[advisory](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) was updated on
October 23. Direct application/server Zod is already 4.6.7. The latest
WalletConnect Ethereum provider still uses Reown packages requiring Zod 3;
latest Reown wallet and Coinbase SDK packages also retain that major.
A blanket override to Zod 4 could break wallet validation. These findings
remain open; the audit has not been suppressed. Upstream's
[v3 issue](https://github.com/colinhacks/zod/issues/6653) tracks the unpatched
bounded-collection behavior. Server requests retain the existing 2 MiB body
limit, which does not establish safety for every third-party wallet path.
The tracked `braces` recursion patch and its regression coverage remain;
full development audits can still flag its original package version.

## Commercial release criteria

Reliable accounts and funding are launch blockers during the database outage.
After quota recovery, apply pending migrations, release the backend, require
healthy native readiness and readable settings, and verify authenticated API
usage and each enabled payment rail. Inspect pending deposits and settlement
retries before asking anyone to pay again.

Venice catalog prices include a 50% markup (33.3% gross margin before
refunds, payment fees, hosting, support and taxes). Gonka dollar margin still
requires a GNK cost basis and retry costs. Prepaid deposits are not proof of
net profit. Measure collected usage revenue against provider costs, refunds,
fees and operating expenses before claiming profitability or scaling paid
acquisition. Live inference, WalletConnect pairing, Polar purchases, x402
settlement and support delivery need fresh verification after recovery.

## Documentation and retention

This compact report supersedes repeated chronological narratives. Detailed
[October 21 evidence](https://github.com/NosytLabs/oma-ai/blob/6dbfa9a11afd2f17454f9935657795133911bcd9/docs/AUDIT.md)
remains in Git history. Generated logs, screenshots and private backups stay
ignored; no generated logs are tracked. Keep security, licenses, migrations,
deployment references and the approved
[October 10 database-cleanup receipt](audits/database-cleanup-2026-10-10.md).
This audit does not authorize removing accounts or financial/anti-abuse
records.
