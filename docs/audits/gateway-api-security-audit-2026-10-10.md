# Gateway and account audit — October 10–11, 2026

Consolidated evidence for the account, API, website and infrastructure work.
Current behavior lives in [Platform](../PLATFORM.md),
[Deployment](../DEPLOYMENT.md) and [Chat UI](../chat-ui.md).

## Implemented safeguards and account improvements

- Better Auth sessions own browser account actions. API keys are scoped to
  catalog models and expire in 1–365 days. Postgres validates every key request;
  only concurrent lookups share results. Revoked/expired/deleted keys and
  suspended or absent accounts cannot authenticate through stale Redis data.
- Personal keys, sessions, usage, exports and deletion select the authenticated
  owner, never a supplied account ID. Profile writes cannot promote roles or
  change protected wallet fields. Account deletion invalidates sessions and keys.
- Website proxies strip visitor runtime/forwarding headers and block private
  paths. On Vercel, the authenticated proxy preserves only a single valid
  platform client IP. Native recovery scheduler proof is accepted only in Neon.
  Database/provider secrets and SQL error details are not returned to customers.
- Free website chat has a separate authenticated proxy route; copying its
  source headers cannot make SDK inference free. Old session-only SDK tabs
  receive a reload message instead of a surprise charge. Quota reads and
  enforcement share UTC counters: 20 guest-IP or 100 account attempts per day.
  Paid keys do not consume that allowance. Memory fallback is bounded and
  weaker than shared Redis.
- Both inference APIs enforce model/output limits and key scopes, including
  fallbacks. They share metering and streaming framing. Messages records the
  API-key ID, translates function tools/continuations and preserves explicit
  zero usage. Stream cancellation finalizes once, without customer deduction.
  Upstream credential failures are gateway errors, not customer login failures.
- Completed chat idempotency reuse returns 409 without another charge.
  The gateway does not fabricate response replay. Method/route-specific rate
  budgets prevent unrelated account actions from exhausting each other.
- The user dashboard unifies Overview, Usage, API Keys and Settings.
  Legacy settings bookmarks redirect to their section; demo actions are
  read-only. Settings does not poll analytics. Balances and synchronization
  failures remain explicit. Charts preserve sub-cent amounts and large token
  totals; request details include correlation IDs and requested/served models.
- The admin console provides range-based UTC charts, complete usage totals,
  searchable cursor-paginated logs, account controls and treasury configuration.
  Deductions lock/cap to the available balance and report the applied amount.
  Canceled, refunded and failed deductions are separated from customer charges.
- Support delivery reports actual webhook acknowledgement/failure and preserves
  messages for recovery. Public docs, OpenAPI and agent instructions omit
  private operator routes, document supported API subsets and discover the
  advertised x402 recipient. No fake purchase-expiry records are displayed.
- The shared layout keeps the sticky header visible during deep docs scrolling.
  Chat removes fabricated historical cost estimates and retains real token/
  latency values, account-separated browser history and draft controls.
- Code-only Neon releases preserve secrets and scheduled recovery jobs.
  Removed unused provider metadata, stale route diagnostics and duplicate docs
  while preserving migrations and historical financial/provider records.

## Cleanup and usage downloads — October 11

Usage export now uses the selected dashboard dates and summary snapshot end.
The API validates dates/format and returns at most 10,000 account-owned rows,
with an exact row count and explicit truncation flag. Empty CSV exports retain
headers; text is spreadsheet-safe, UTC timestamps and tiny charges retain
precision. Downloads include key/request IDs, requested/served models and
latency. Demo exports are disabled; duplicate clicks and account-switch races
cannot leak a pending report.

Four overlapping reports are consolidated here; their full originals remain
linked below. Removed 50 stale generated screenshots/scratch/provider files and
24 superseded local test/release logs. Current evidence, active server logs,
the persistent braces patch and private database backups remain. The consumed
local fixture-link file was also removed. No production log, financial record,
account or deployment is deleted in this cleanup.

Local setup references now describe the HTTP Redis requirement accurately.
A plain Redis daemon cannot serve this client. The database helper starts
Postgres without starting an unused Redis service. Sample environments do not
advertise a TCP Redis URL or duplicate optional blank settings.

Full validation passed: 799 frontend tests in 120 files and 605 API tests in
76 passing files, with six explicit API skips; types, lint and both production
builds passed. All 22 real HTTP/Postgres groups passed, including selected-range
exports, ownership isolation, precision and refunds. Production dependency
audit again found no known vulnerabilities. Local Markdown link checks and the
database-helper shell syntax check passed. An initial run exposed a download
metadata type error and a missing canonical OpenAPI link in the condensed
README; both were corrected. Under heavy machine load, the account harness
failed at startup before reaching flows; its bounded startup wait is now
60 seconds and the complete rerun passed. A later frontend run under machine
contention hit chat and worker startup deadlines; all 799 tests passed with
two workers, preserving the same assertions and test time limits.

A signed-in local user downloaded 28 CSV records, matching the 24-hour summary.
The file retained tiny charges, all 15 column headers and UTC timestamps.
At 1280px and 390px the page had one H1 and no horizontal overflow; mobile had
no duplicate IDs. Demo export remained disabled with a real session present.
Console capture returned no warnings/errors. Recent-activity usage links retain
demo mode; a regression reproduced the lost flag before the correction. The
final local browser click reached `tab=usage&demo=1`, retained the preview banner
and disabled export. A repeat fixture sign-in was blocked by the browser client;
this final navigation check was unauthenticated, distinct from the earlier
signed-in export and demo-isolation checks.
Credit amounts now say "credits" and use a coin icon, with the USD equivalent separately labeled; final frontend
lint/build and the mobile browser check passed after that cosmetic change.
Screenshots are under `.screenshots/cleanup-2026-10-11/`.

Production release verification for this cleanup is pending.

## Previous verified release

| Service | Source | Deployment | Observed state |
| --- | --- | --- | --- |
| Vercel website | `adf20340a7a4093274f4f0bee84409e337324670` | `dpl_BQwXhoT1o3kRGruF4PNwp8Gj4Zbw` | READY; canonical host matched |
| Neon API | `29430af31ddb14c54c7f3410f106dabab6cd8dbf` | `omaapi` 80 | Current/active, completed; Node 24, 2048 MiB |

That release passed 791 frontend and 591 API tests (six explicit API skips),
types, lint and production builds. The 21 real HTTP/Postgres groups passed
twice against separate migrated temporary databases. Production dependency
audit: zero known vulnerabilities across 671 runtime dependencies.
Neon retained all 40 environment variables and both every-minute jobs,
`oma-deposit-recovery` and `oma-settlement-dlq`.
Native and same-origin readiness reported healthy Postgres and Redis.

Actual MiniMax calls through a temporary scoped key succeeded in OpenAI and
Anthropic formats with `OMA_API_OK`, 49 input/197 output tokens each and a
combined 0.000984-cent deduction, matching persisted key attribution. The key
was revoked (401) and temporary sessions removed; actual charges were retained.

A production guest request returned `OMA_QUOTA_OK` in 34.0 seconds, 140 total/
90 output tokens. Allowance changed from 20 to 19 and stayed at 19 after reload
and forged forwarding headers. This verified the platform-IP quota correction.
Copied website headers on SDK requests returned 401; private paths returned
404 and cross-origin website chat returned 403. No payment was signed.

Browser checks covered local user/admin account actions, profile save/restore,
session revocation, account JSON export, deletion confirmation/cancel, key
controls, demo isolation, and desktop/390px/320px layouts. Current evidence is
under `.screenshots/account-audit-2026-10-10/`. The final chat capture has one
H1, no overflow or captured console warnings/errors. A sitemap audit checked
all 65 public URLs for status, canonical/title/description/H1/structured data;
later manual metadata checks covered 14 primary pages. This does not claim a
manual content review of every generated model/glossary page.

## Dependencies and remaining limits

Compatible versions include Next 16.4.0, Better Auth 1.7.7 and viem 2.57.4.
TypeScript 6.0.3 stays inside typescript-eslint 8.71.1's supported peer range
(`>=4.8.4 <6.1.0`); TypeScript 7 is held. Node 24 typings match both runtimes.
The full development audit still reports
[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) for
braces 3.0.3. A persistent pnpm patch bounds parser/AST recursion, with regression
coverage; it mitigates the issue without claiming an upstream version fix.
Deprecated transitive tooling remains under its parent dependency contracts.

- MiniMax's initial structured function call succeeds, but strict tool-result
  continuation still returns unwanted markup/unrelated text. The expected
  exact answer remains `4`; assertions are not weakened. Gonka DeepSeek/GLM
  remain paused. Enabled catalog entries are not proof every primary model works.
- Venice metadata pricing/limits were compared, but the local inference
  credential failed upstream authentication. Authenticated production Venice
  inference remains unverified.
- Injected EIP-1193/EIP-6963 wallets and real local SIWE signatures are covered;
  WalletConnect QR/mobile sessions are not implemented.
- x402 v2 uses OMA's custom funding contract: verification broadcasts, and
  settlement credits the SIWE-bound payer once. It is not a generic Coinbase
  facilitator or pay-per-inference route. Mainnet transfer, facilitator gas and
  successful live payment reconciliation remain unverified.
- Credit balances remain aggregate. Per-grant allocation/refund policy and a
  ledger migration are needed; no fabricated expiry dates or financial cleanup.
- Support needs a configured, verified webhook. Idempotency does not replay
  responses or prevent simultaneous upstream calls before usage is recorded.
- Messages supports text/function tools, not images/documents, extended
  thinking, caching or beta features. Full Claude Code parity is not claimed.
- Local readiness remains degraded without HTTP Redis credentials; production
  shared Redis was healthy in the recorded probes.

The production cleanup authorization was limited to expired authentication
records. [Its receipt](database-cleanup-2026-10-10.md) records six sessions and
14 verification records removed with a fixed cutoff; both test identities and
the existing operator key remain.

## Historical evidence

Full reports are preserved at the pre-consolidation commit, avoiding multiple
working copies with conflicting test counts and deployment receipts:

- [Gateway API, provider and release history](https://github.com/NosytLabs/oma-ai/blob/3b4774e409d923c3689c0d6a60e6108e954bdf73/docs/audits/gateway-api-security-audit-2026-10-10.md)
- [Account/dependency follow-up](https://github.com/NosytLabs/oma-ai/blob/3b4774e409d923c3689c0d6a60e6108e954bdf73/docs/audits/account-platform-followup-2026-10-10.md)
- [Usage/treasury audit](https://github.com/NosytLabs/oma-ai/blob/3b4774e409d923c3689c0d6a60e6108e954bdf73/docs/audits/account-usage-audit-2026-10-10.md)
- [Original platform audit](https://github.com/NosytLabs/oma-ai/blob/3b4774e409d923c3689c0d6a60e6108e954bdf73/docs/audits/audit-2026-10-10.md)

PR #30 remains open. Subsequent receipt commits may change documentation only.
