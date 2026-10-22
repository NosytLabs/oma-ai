# Gateway and account audit

Latest inspection: October 21, 2026 (America/Moncton). These are dated
observations. [Deployment](DEPLOYMENT.md), [Platform](PLATFORM.md), and
[account tooling](../server/scripts/README.md) own the maintained procedures.

## Production incident

The website and catalog respond, but the API readiness probe returns 503 with
an unavailable database. Neon database access returns HTTP 402: the account or
project quota has been exceeded. The project is on `free_v3`; its reported
consumption period ends November 1, 2026. Redis readiness succeeds. Public
payment settings fail closed, disabling new card and crypto funding.

Restoring service before the allowance resets requires the owner to resolve
billing/quota for the existing `oma-ai-prod` project. Redeployment does not
reset database quota. No customer records, balances, or payment settings were
changed during this inspection; database inspection itself was quota-blocked.

Both enabled Neon recovery schedules still ran every minute, despite the
15-minute schedules in `server/neon.ts`. They were updated and read back as
every 15 minutes on October 21. This reduces scheduled invocations from 2,880
to 192 per day, allowing idle gaps; it does not reset consumed allowance or
guarantee a particular compute bill. Recovery retries can now wait up to
15 minutes. Both jobs remain enabled.

## Changes prepared for release

- Sign-in checks gateway readiness rather than the website's liveness. A
  confirmed settings outage displays a site-wide service notice and status
  link. Status no longer advertises operational chat during a dependency
  outage. Neither a catalog flag nor readiness proves upstream inference.
- Completed the existing local usage-refund work in an isolated checkout.
  Approval restores exact prepaid credits, adjusts net usage, marks the charge
  and saves the operator audit in one transaction. Concurrent decisions and
  duplicate requests cannot credit the same charge twice. Intake enforces
  ownership, the 30-day window, and five pending requests per account.
- Refunds cover full paid usage charges; they return OMA credits, not card or
  USDC transfers. Fractional cents survive storage, approval and history.
  Invalid legacy charge links remain pending for review. Existing historical
  decisions are not automatically replayed or reconciled.
- Refund history is scoped to the account, demo actions cannot submit live
  refunds, and customer docs match the actual request/response contract.
  Cookie-authenticated submissions require a trusted Origin; API-key clients
  retain support for requests without browser headers.
- Refunded known-cost requests retain the provider charge as a loss in admin
  markup totals. Unknown Gonka costs remain explicitly unknown.
- Vite 8.2.4 addresses six dependency advisories. The production dependency
  audit reports zero known advisories. The manual CI workflow now supplies
  Postgres so real ledger tests and the HTTP/auth suite run when dispatched.

## Validation and release status

Types, lint, both production builds, all 926 frontend tests and all 689 API
tests passed on Node 24, with the real Postgres suites enabled. Production
dependency auditing reports zero advisories. The full development audit still
flags `braces` by package version; its tracked recursion-bound patch and
regression coverage remain in place. Release deployment receipts belong in
the release PR. The refund
suite first reproduced nine failures against main, then passed its 13 real
Postgres cases including concurrency, rollback, sub-cent accounting, legacy
links and net markup. All 31 real HTTP/auth checks passed, including account isolation, cookie
origin rejection and API-key refund intake without an Origin header, in a
temporary local database.
No test sends a paid provider request or executes a mainnet payment.

Apply migration `0006_refund_precision` through the existing migration
workflow before releasing the new backend. It changes only
`refund_requests.amount_cents` to match usage precision. The production quota
block currently prevents that migration and live account/billing verification.
A frontend release alone cannot activate the backend refund fixes.

## Commercial limits

Reliable account access and funding are release blockers while the database
is unavailable. After recovery, verify an authenticated API request and each
configured payment rail before promoting paid access. Keep the payment
recovery jobs and inspect their failures; reducing frequency is not disabling
reconciliation.

Venice catalog prices include a 50% markup, which is a 33.3% gross margin
before refunds, payment fees, hosting, support and taxes. Gonka dollar margin
requires a GNK cost basis and retry costs. Neither markup nor prepaid deposits
establishes net profit. The admin estimated margin remains incomplete when
provider costs are unknown.

Messages supports text and function tools rather than full Claude Code
feature parity. Earlier live MiniMax tests included timeouts and tool
continuation failures; live Venice credentials, WalletConnect pairing,
Polar purchases, x402 settlement and support delivery need fresh verification.
These were not exercised with real funds during this inspection.

## Documentation and retention

This report replaces repeated chronological audit narratives. Detailed
[October 15 evidence](https://github.com/NosytLabs/oma-ai/blob/17b752f645ce4022d9e4fbeef4b9d8eeea4065c8/docs/AUDIT.md)
remains in Git history. Generated logs, browser reports, screenshots and
private backups stay ignored; no generated logs are tracked. Keep security,
license, migration and deployment references.

The [approved October 10 database cleanup](audits/database-cleanup-2026-10-10.md)
remains authoritative for that earlier operation. This audit does not expand
its scope or authorize removing accounts or financial/anti-abuse records.
