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
- Account-scoped inference claims prevent simultaneous calls across both API
  formats and different keys owned by the same account. Completed reuse returns
  409 without another call or charge; failed/canceled attempts can retry.
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

## Wallet pairing, durable retries and rate limits — October 11

WalletConnect Ethereum Provider 2.26.0 now loads only when selected. Its
EIP-1193 adapter deduplicates pairing, forwards account changes and never
automatically retries signatures or transfers. QR/mobile pairing is exposed
only with a valid public Reown project ID. Deposit offers an explicit wallet
selector and requires the original sending wallet before registering a saved
transfer again. Missing local and production project IDs still prevent live
QR validation; the adapter tests do not substitute for a real mobile wallet.

Both inference formats now share atomic account-scoped Postgres claims.
Simultaneous requests through different keys or workers cannot call the
provider twice with the same idempotency key. Claims remain held while streaming
and after a committed charge, including an ambiguous delivery failure. Failed
unbilled attempts can retry; stale pending claims can recover after five minutes.
Only hashes and request IDs are retained, without prompts or response replay.
Migration `0005_inference_request_claims.sql` was applied additively to production
and verified against its journal hash and account/uniqueness constraints.

Real Postgres payment tests exposed recovery failures caused by eight-decimal
database amounts being compared with six-decimal USDC units. Recovery now
normalizes trailing zeroes without rounding. Deleted-account and legacy
reconciliation conflicts return safe, non-retryable 409 errors; SQL and internal
exception text stay in operator logs. Concurrent settlement retries credit once.
No mainnet transfer or facilitator gas transaction was performed.

The degraded token limiter now counts requested tokens. Its emergency five-
request-per-minute allowance is shared by the authenticated account, so rotating
API keys does not refresh it. Docs distinguish requests, tokens, bursts and
upstream capacity errors. Provider errors inside successful HTTP JSON or SSE
responses are recorded as failed and remain uncharged. Homepage/status labels
describe the enabled catalog instead of implying tested provider health, and
the footer describes actual funding/free-chat behavior with larger mobile links.

Validation passed 639 API tests in 78 files, including previously skipped real
Postgres payment checks, and 25 real HTTP/authentication groups. These cover
scoped/revoked keys, signup, SIWE, account deletion, ownership isolation,
concurrent inference admission, metering and account-wide emergency limits.
Frontend validation passed 832 tests in 123 files with two workers. Types, lint,
production builds and frozen-lockfile installation passed. The production
dependency audit found no known vulnerabilities across 888 dependencies; the
development-only braces advisory below remains. All 10 maintained Markdown
files passed local link validation (32 links).

Fresh actual MiniMax calls used a one-day scoped key. Messages returned 200,
`OMA_API_OK`, 49 input/193 output tokens and a 0.000484-cent charge matching
persisted usage and balance deduction. OpenAI chat timed out after 180 seconds
and was not charged: one of two live checks passed. The key was revoked (401)
and temporary session removed; actual financial records remain. A direct
OpenBroker tool check produced a valid `add` call, but its continuation repeated
the result with unwanted reasoning/text and failed the strict expected answer.
This reproduces the upstream limitation outside OMA's proxy. Venice's current
local credential still returns 401. Gonka DeepSeek/GLM remain paused.

Fresh browser checks covered signed-in local user Overview/Usage/Settings,
deposit guidance, admin usage/treasury, pricing and docs at 1280px and 390px.
The checked views had one H1, no horizontal overflow and no captured console
warnings/errors. These checks use local test accounts; they do not imply a
successful mainnet purchase or working Venice/mobile pairing credentials.

## Wallet, RPC and API-key follow-up — October 11

Context7 references for Better Auth, viem and x402 were compared with the
installed implementation. Runtime packages are current. Next 16.4.0,
Better Auth 1.7.7 and viem 2.57.4 need no new version bump in this follow-up;
Node 24 typings and TypeScript 6 remain intentional compatibility choices.
Production dependency audit found zero known vulnerabilities across 671
runtime dependencies. The existing development-only braces limitation below
still applies.

API key creation now accepts and displays `ipAllowlist`, previously available
only inside the server helper. Up to 20 IPv4/IPv6 addresses or CIDR ranges are
validated, trimmed and deduplicated; invalid masks and zone identifiers return
400 before a credential is created. Key listings return restrictions without
the raw secret. IPv6 matching now compares address bits and correctly expands
embedded IPv4 tails; malformed persisted ranges are skipped instead of throwing.
The old automatic API-key cookie installation was removed from dashboard
creation because website chat authenticates with the account session.

Wallet transfers reject zero, negative, non-finite and over-precision amounts
before opening a wallet prompt. They use exact six-decimal units and recheck
the selected account/provider after a chain-switch prompt. The transport
explicitly disables retries; installed viem already disables automatic retries
inside `sendTransaction`, so this is an explicit policy plus real amount/account
guards, not a claim that viem previously duplicated transfers.

The website Base RPC proxy falls back from a configured service to public Base
and PublicNode endpoints for read failures. Any broadcast or mixed batch gets
one attempt. Requests are capped at 16 KiB and replies at 1 MiB while streaming;
empty batches, wrong JSON-RPC versions and HTTP subscription methods are denied.
Transient upstream errors may fail over, contract reverts are preserved, and
upstream credentials stay out of client errors. Support uses the same bounded
reader with a 64 KiB request cap. Both website route limiters now share the
Vercel platform-IP trust policy; arbitrary forwarding headers or an unverified
custom-proxy setting cannot refresh a visitor's budget. These local guards
remain per-instance, not globally durable limits.

Public authentication/OpenAPI docs describe IP restrictions. Funding docs
explain the customer wallet, treasury recipient and facilitator gas role,
and at that release identified WalletConnect QR/mobile support as missing. Existing
maintained references were updated rather than creating another audit file;
all nine maintained Markdown files passed local link validation.

Validation: 824 frontend tests in 122 files and 619 API tests in 76 passing
files, with six explicit API skips. Types, lint and both production builds
passed. The 23 real HTTP/Postgres groups include IP-restricted keys, forged
forwarding headers, two-account isolation, expired/revoked credentials,
signup/sign-out/deletion and real local SIWE signatures. Regression tests
failed before the wallet/RPC/IP corrections and passed afterward.

Actual model calls used a one-day scoped key and real local account. MiniMax
passed OpenAI and Messages formats with `OMA_API_OK`, 49 input/208 output
tokens each, and a combined 0.001028-cent charge matching the persisted usage
and balance deduction. The key was revoked (401) and test session removed.
Venice Gemma failed both formats with an upstream authentication error; a
present local credential is not proof it is valid, and production Venice
inference remains unverified. MiniMax emitted a valid `add` function call
with `{a:2,b:2}`; continuation repeated `4` until the 512-token limit and
failed the strict result assertion. Neither provider issue is hidden by
weaker assertions or fabricated success.

The rebuilt signed-in key form passed 1280px and 390px browser checks: one H1,
no horizontal overflow and no captured console warnings/errors. The local
user's session list revoked four old fixture sessions while preserving this
device. That user received Access denied at `/admin`; a fresh local admin
fixture opened the real console and its usage/treasury controls. The revenue
chart still rounded sub-cent tick values to `$0`; it now shares the dashboard's
small-value currency formatter and has room for those labels. Final desktop and
390px screenshots show `$0.000015`–`$0.00006` ticks, no horizontal overflow and
no captured console warnings/errors. Current captures
are under `.screenshots/platform-audit-2026-10-11/`. The consumed local
fixture-link file was removed.

The final SDK review reproduced an `IndentationError` in the Python streaming
example, a dictionary-only method on typed model objects, an unused Go streaming
import, and the Vercel SDK's default Responses endpoint. Python examples now
parse, Go examples compile, and the Vercel example explicitly uses `oma.chat()`
with an output cap. Python streaming handles empty choice chunks, cURL disables
output buffering, and Go prints actual content deltas and reports stream errors.
Install instructions
match the Go standard-library examples; public copy names the supported API
instead of claiming full OpenAI compatibility. The current
[AI SDK provider documentation](https://github.com/vercel/ai/blob/main/content/providers/01-ai-sdk-providers/03-openai.mdx)
was checked through Context7. API keys stay server-side in the SDK guidance.
The compiled Go model-discovery example also returned all 20 catalog IDs from
the actual public endpoint. Frontend lint and the final production build passed.
The sweep found the same indentation defect in the separate Streaming and
Error Codes sections. All seven public Python examples now parse. Manual 429
retries honor numeric `Retry-After`, turn off the SDK's own retry loop and raise
the final failure; the
[Python SDK reference](https://github.com/openai/openai-python/blob/main/README.md)
confirmed the retry settings through Context7. Removed the unreferenced
operator webhook component and an unsupported millisecond-latency promise.

### Verified follow-up release

| Service | Source | Deployment | Observed state |
| --- | --- | --- | --- |
| Vercel website | `b484b1d171227abc46fb9060e901f6e475cebcee` | `dpl_ByA3axydFUbUDWPFiB4M2mwKqyzp` | READY; `www.oma-ai.com` matched |
| Neon API | `576f47b3200a50792b9e2f359629598e03960128` | `omaapi` 82 | Current/active, completed; Node 24, 2048 MiB |

The website-only chart/docs follow-up did not redeploy the API. Neon exposes the
same 40 environment variable names; this check does not inspect secret values.
Both existing every-minute recovery jobs remain enabled with their original
trigger IDs, routes and schedules. Native and same-origin readiness returned
200 with healthy Postgres/Redis. Production Base and Base Sepolia read-only RPC
checks returned `0x2105` and `0x14a34` respectively; no payment was signed.

Anonymous keys, usage export and admin settings returned 401; private recovery
paths and `/.env` returned 404. Public OpenAPI 3.1 includes IP restrictions and
no admin, internal or website-chat paths. After refreshing the existing live
docs tab, the new SDK factory and retry settings were visible. The docs had a
correct canonical, one H1, no page overflow at 1280px and no captured console
warnings/errors. Local final docs also passed 390px layout checks. The desktop
production SDK capture and both admin chart captures are in
`.screenshots/platform-audit-2026-10-11/`.

The [lockfile workflow](https://github.com/NosytLabs/oma-ai/actions/runs/38139464601)
passed the final website source. A superseded in-progress docs deployment was
canceled after the additional Python defects were found; it was never used as
the final release. The interrupted chart build and subsequent final docs builds
were rerun successfully. Receipt-only commits may follow this source.

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
Credit amounts now say "credits" and use a coin icon, with the USD equivalent
separately labeled; final frontend
lint/build and the mobile browser check passed after that cosmetic change.
Screenshots are under `.screenshots/cleanup-2026-10-11/`.

## Cleanup release verification

| Service | Source | Deployment | Observed state |
| --- | --- | --- | --- |
| Vercel website | `57dee4a6688bb1ca3e357391c5aaab39d23661fa` | `dpl_9VRLXdP1Xxj4YbYJkMJ1W65RnAai` | READY; canonical `www.oma-ai.com` matched |
| Neon API | `cc3d2a088c9a5b6229caeeec82787dee83f1d8a8` | `omaapi` 81 | Current/active, completed; Node 24, 2048 MiB |

All 40 API environment values match the pre-release snapshot. Both enabled
every-minute recovery jobs retained their configuration. The navigation-only
website follow-up did not redeploy the API.
Native and same-origin `/ready` returned 200 with healthy Postgres and Redis.
`/api/v1/export/usage` returned 401 without a session; `/.env` returned 404.
`/api/openapi.json` returned OpenAPI 3.1 with no admin, internal or website-chat
paths. The [release-source lockfile check](https://github.com/NosytLabs/oma-ai/actions/runs/38110908054)
passed.

The live preview's recent-activity link reached
`/dashboard?tab=usage&demo=1`, with Usage selected, the preview banner present
and export disabled. The 1280px check had one H1, no horizontal overflow and
no captured console warnings/errors. A temporary developer viewport resolved
the browser's zero-size automation surface; it was cleared after saving
`.screenshots/cleanup-2026-10-11/production-demo-usage.jpg`.

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
- Injected EIP-1193/EIP-6963 wallets and real local SIWE signatures are covered.
  WalletConnect is now implemented and tested locally at the adapter boundary,
  but live QR/mobile pairing needs a valid public Reown project ID and remains
  unverified. Missing/placeholder IDs do not expose a broken connector.
- x402 v2 uses OMA's custom funding contract: verification broadcasts, and
  settlement credits the SIWE-bound payer once. It is not a generic Coinbase
  facilitator or pay-per-inference route. Mainnet transfer, facilitator gas and
  successful live payment reconciliation remain unverified.
- Credit balances remain aggregate. Per-grant allocation/refund policy and a
  ledger migration are needed; no fabricated expiry dates or financial cleanup.
- Support needs a configured, verified webhook. Idempotency now prevents
  simultaneous upstream calls, but deliberately does not retain/replay response
  bodies. Clients should save responses and use a new key for a new operation.
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
