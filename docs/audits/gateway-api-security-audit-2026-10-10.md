# Gateway and account audit — October 10–13, 2026

Consolidated evidence for the account, API, website and infrastructure work.
Current behavior lives in [Platform](../PLATFORM.md),
[Deployment](../DEPLOYMENT.md) and [Chat UI](../chat-ui.md).

## Payment controls, dependencies and customer guidance — October 13

The crypto payment switch did not govern `/x402/verify`, and direct deposit/card
checks continued after a database failure. One shared middleware now checks
operator intent before new funding, wallet challenges or hosted checkout.
Unavailable settings return a safe 503 with Retry-After; public discovery remains
readable but disables funding. A crypto funding pause does not block crediting
an existing confirmed x402 payment. Real Postgres tests verify retries credit it
once, including after the process cache is cleared. Payment recovery records and
financial history remain intact.

Customer pages now show Checking, Available, Paused or Unavailable. Setup and
configuration instructions remain in admin diagnostics. The credits page no
longer suggests another method without knowing it is available. API-key guidance
adds a copyable SDK base URL, request examples and limits/retry links, explains
why a saved prefix cannot authenticate, and separates paid API calls from free
website chat. Menu and status wording describe the actual product and gateway
readiness rather than promising live provider inference. The duplicate outer
API-key empty state was removed, so accounts without keys also receive the
same onboarding guidance and one clear first-key action.

The newer main-branch SIWE change accidentally used hostname instead of host,
dropping local ports. Real-signature tests reproduced rejected valid logins.
The server now preserves the non-default port while matching the client’s
apex/www canonicalization; a correctly signed message for another port remains
rejected. Domain/nonce/signature checks were not relaxed.

Updated all newly available compatible dependencies, including OpenUI 1.0.0,
viem 2.57.5, Hono’s Node adapter 2.1.5, Neon config 1.9.1, Zod 4.6.7 and
Vitest 5.0.4. OpenUI parsing/actions/rendering still pass. TypeScript 6.0.3 and
Node 24 types retain their tool/runtime compatibility pins. The refreshed audit
reports zero known production vulnerabilities across 891 dependencies.

Fresh MiniMax API checks used a temporary scoped, expiring key. Chat completions
timed out at the 180-second provider deadline; Messages returned the expected
final `OMA_API_OK` in 29.7 seconds with 49 input / 200 output tokens. Only the
successful call charged 0.000498 cents. Charges matched the credit deduction;
the key was revoked (401 afterward) and its temporary session removed. The
first attempt during a local server restart failed sign-in and made no model
call. Latest model evidence is
`.artifacts/provider-audit/payment-audit-model-results-2026-10-13.json`.
Provider latency remains unreliable; this is not a clean bill of model health.
Venice Gemma was rechecked with a fresh restricted key and again returned a
safe provider-authentication error (502, 218ms), with no charge. That key and
session were removed; replacing the local Venice credential remains necessary.

Validation on Node 24.19.0: 845 frontend tests in 124 files, 651 API tests in
78 files with the Postgres suites active, and 27 real HTTP/auth groups pass.
Types, lint, both production builds and frozen installation pass. Payment,
customer-status and SIWE regressions were observed before their fixes.

Research used Firecrawl to retrieve primary [Google canonicalization guidance](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls),
[Anthropic rate-limit documentation](https://docs.anthropic.com/en/api/rate-limits),
and live [OpenBroker FAQ](https://openbroker.gonka.gg/docs/faq) / [load guidance](https://openbroker.gonka.gg/docs/load).
Docs now distinguish OMA’s request limits, the 120,000 TPM budget on the listed
models, and upstream shared concurrency. Other models do not inherit that TPM
budget. Retry-After/backoff guidance does not invent provider capacity promises.

Browser checks of 12 current public footer destinations found one H1, matching
www canonicals and no document overflow at 390px; captured warnings/errors were
empty. Those destinations are active, so no healthy footer pages were deleted.
The landing logo and navigation use the same existing brand component. Admin
funding controls were exercised locally; no mainnet payment was signed.

A normal-account browser chat returned `OMA_CHAT_OK` in 45.2 seconds. Its
50 input / 127 output tokens were recorded as free website usage with zero
charge. Copying the visible answer excludes the collapsed reasoning. The
API-key empty state shows guidance and one creation action; mobile copy and
navigation controls work without document overflow or captured console errors.

Fresh structured tool calls succeed through OMA (11.8s) and directly through
OpenBroker (51.8s). Both strict tool-result continuations fail: the provider
returns reasoning/native tool markup instead of exactly `4`. Direct comparison
isolates that behavior upstream; assertions and returned provider content are
not weakened or silently rewritten.

PR #32 merged as `9f1ba53cdc00da44bc0e1917e41dfd7de803787a`; its source tree matches
the tested head `4a6e83595401533dedc5a66994b84c9bb88a659b` exactly. Lockfile CI,
Vercel preview and external code review passed (no issues reported). Production
website deployment `dpl_Fan2T5stDqHkmBWUJz8yvqJuGECx` is Ready. Neon API deployment
86 completed on Node 24 with all 40 environment values and both jobs unchanged.
Production readiness confirms database/shared-cache health; unauthorized admin,
treasury and key actions are denied, malformed cookies return 401 and the Base
RPC proxy returns chain ID `0x2105`. `/api/ready` is the health path; a probe of
`/api/v1/ready` was an incorrect URL and returned 404.

Removed the merged branch, one duplicate canceled preview, and three superseded
October 10 lockfile log archives (run IDs 38096594691, 38096308850, 38094588269).
Run metadata, current validation evidence, active deployments and financial
records remain. No further production database deletion was performed.

Post-release checks found settlement responses missing an explicit no-store
policy. The follow-up applies it before session authentication, including
denials and successful payment receipts. Both 401 and confirmed 200 regressions
failed before the fix; the full API suite now passes 652 tests with real
Postgres credit checks. Types, lint and API build pass. Frontend source is
unchanged by this follow-up.

PR #33 merged as `2a2ab5dd40caecc9d9ff8135091ad82a52e6c61b`, with the exact
tested source tree retained. Neon API deployment 87 completed; all 40 environment
values and both recovery jobs remain unchanged. The canonical website now
returns 401 with no-store for an unauthenticated settlement; `/api/ready`
confirms database and shared-cache health. Its merged branch and duplicate
canceled preview were removed after validation.

Direct `/docs#rate-limits` bookmarks revealed a stale Quick Start selection.
The short heading lands at 84px, outside the previous observer's 20–30% viewport
band. Navigation now measures the section reached at a reading line, once per
animation frame, on mount, scrolling and resizing. Subsection bookmarks
select their parent. All three regressions failed before the change and pass
after it. The complete frontend suite passes 848 tests in 125 files; types,
lint and production build pass. Browser checks against the newly built local
site confirm Rate Limits, SDKs and the chat endpoint subsection select correctly,
without overflow or captured console warnings/errors. The existing process on
port 3000 retained the previous build, so these checks used a fresh process on
port 3002. Production verification follows the reviewed release.

The real HTTP/auth suite now also migrates a unique local database and creates
1,001 isolated accounts. Admin search and cursor pagination returned all of them
in 21 bounded pages without duplicates, and found an exact email. The measured
total HTTP time was 186ms on this machine; this is not a production benchmark
or a 1,000-user simultaneous browser load test. The suite drops its temporary
database in finally and now passes 28 groups.

Admin user-list failures previously offered no recovery, and next-page failures
were silent when earlier users were already loaded. The console now retains
loaded rows, explains the failure and provides Retry users for the same page.
It labels the search field, shows the loaded count and uses a larger paging
button. Both recovery regressions failed before the change, then passed. All
850 frontend tests in 126 files, types, lint and production build pass. A real
local admin sign-in confirms the search label, bounded paging guidance and
loaded count. Attempted browser-only outage interception was cleared; the
explicit error/retry behavior is established by the component regressions,
not a claim of a captured browser error state.
The combined branch, including the docs hash-before-scroll regression and
cached headings, passes 851 frontend tests plus types, lint and build. The local
admin test session was signed out; its unused normal-user seed verification and
private link file were removed.

## Authentication and dashboard follow-up — October 11

Malformed API-key cookie encoding reproduced a 500 on an authenticated API
route; it now returns 401 without a key lookup or account access. The Better
Auth website proxy now bounds input to 64 KiB and gives body upload plus
upstream work a 30-second deadline. Oversized bodies return 413; stalled
requests return 504; browser cancellation stays separate. Normal request
bodies, callback redirects and separate session cookies still pass through.

A real mobile dashboard outage reproduced a generic error without Retry:
the browser reached the website, but the website could not reach the API.
Explicit proxy transport failures now use the connection-recovery banner.
Provider authentication failures keep their own error classification. The
banner stacks actions on narrow screens, removes operator configuration
instructions, and distinguishes prepaid API credits from free website quota.
Removed unused test mocks for packages no longer installed.

Validation on Node 24.19.0, matching production's runtime family: 846 frontend
tests in 124 files, 642 API tests in 78 files with Postgres suites active, all
26 real HTTP/authentication groups, types, lint and both production builds.
The new cookie, auth-input/deadline and connection-recovery regressions failed
before their fixes. Frozen install and runtime dependency audit passed; zero
known runtime vulnerabilities across 888 packages. The compatible dependency
versions and development advisory below are unchanged.

Fresh scoped, expiring-key MiniMax inference succeeded in both formats (2/2),
with final answer `OMA_API_OK`, 49 input / 100 output tokens each. End-to-end
times were 126.4 and 3.7 seconds. Its inline reasoning was preserved and the
final answer assessed separately. Persisted charges totaled 0.000596 cents,
matched the balance deduction and belonged to the test key. Revocation then
returned 401; temporary keys were revoked and test sessions removed.

Venice Gemma inference failed provider authentication (0/1, safe 502), without
a charge. A public catalog 200 is not proof the credential works. Two MiniMax
tool-stream checks reached the 180-second provider deadline before a complete
first tool-call result; strict continuation remains unresolved. Latest reports
are in `.artifacts/provider-audit/auth-followup-minimax-results.json` and
`.artifacts/provider-audit/live-api-results.json`. Live WalletConnect still
needs a public Reown project ID. No mainnet payment was signed.

Browser checks covered real local sign-in, usage/key attribution, unified
profile/sessions/settings, key scope/expiry controls and a regular user's
denied admin access. The 390px outage banner showed Retry without horizontal
overflow; Retry restored current usage when the API returned. Evidence is in
`.screenshots/auth-followup-2026-10-11/`. Removed two additional obsolete
canceled Vercel builds with alias protection; aliased and ready/rollback
deployments remain. No additional production database records were deleted.

[PR #31](https://github.com/NosytLabs/oma-ai/pull/31) merged into `main` at
`928db788b34f0069789bd66bac2d72b0df6c660e`. The merged tree equals tested
head `912608ccdd35576447e4959cfe783658a5fd1373` exactly. Its merged branch is
removed; only `main` remains locally and remotely.

| Service | Deployment | Verified state |
| --- | --- | --- |
| Vercel website | `dpl_wox96KXHLR6TYpRLnG5cafGcUBzg` | READY; canonical host serves the merged SHA |
| Neon API | `omaapi` 85 | Current/active, completed; Node 24, 2048 MiB |

The code-only API release preserved all 40 environment values and both recovery
job IDs/configurations. Post-release native and same-origin readiness reported
healthy Postgres/Redis. The first native malformed-cookie probe returned 500
during rollout; subsequent native and canonical probes returned 401. The live
auth proxy rejects oversized input with 413 and returns 200/null for an
anonymous session. Keys, account export and admin settings/usage require
authentication; private recovery paths and `/.env` return 404. OpenAPI retains
20 customer paths and excludes operator/website routes. x402 advertises v2
Base USDC funding; Base RPC returns `0x2105`. These read-only probes do not
verify a mainnet transfer. Results: `.artifacts/release/auth-followup-live-smoke.json`.

Production login, docs and mobile pricing browser checks passed. Docs and
pricing had one H1, correct canonical URLs and no horizontal overflow; captured
console warnings/errors were empty. Local sign-out returned to the public home
page, and the private fixture-link file was removed. Full paid GitHub CI stays
manual; local validation and Vercel builds passed. The optional external Kilo
review was still queued at merge, with no published review comments observed.

## Main integration and cleanup — October 11

[PR #30](https://github.com/NosytLabs/oma-ai/pull/30) is merged into `main` at
`2f029d4f6642df2bed0c66419dab507654e12315`. Its tree exactly matches the tested
source tree `0f2ff0b8b0396b46ce2b0c1ca586def4fcded80a`. The merged local/remote
audit branch was removed; only remote `main` remains. Later receipt and release-
script permission commits do not change that application source. The Neon
deployment helper now has its executable bit; its shell syntax check passed.

The final integration fixes two reproduced defects: malformed or non-object
upstream SSE frames no longer truncate Anthropic Messages before later text,
usage and the final stop; leading-dot deposit amounts such as `.50` now reach
the configured minimum check instead of an incorrect precision error. Explicit
provider stream errors still terminate, and invalid deposits never broadcast.
Both regressions failed before their fixes and passed afterward.

Fresh validation passed 837 frontend tests in 124 files, 640 API tests in 78
files with the real Postgres suites active, types, lint and both production
builds. All 25 real HTTP/authentication groups passed on the final rerun. The
preceding harness attempt hit a local TCP startup timeout before assertions;
the rerun preserved all checks. Frozen-lockfile installation passed, as did the
[main lockfile workflow](https://github.com/NosytLabs/oma-ai/actions/runs/38148426831).
Runtime dependency audit found zero known vulnerabilities across 888 packages;
the development-only patched braces advisory remains as described below.

| Service | Source | Deployment | Verified state |
| --- | --- | --- | --- |
| Vercel website | `2f029d4f6642df2bed0c66419dab507654e12315` | `dpl_6sC16oBA3iDVUY6v7Y4NJvjcninA` | READY; canonical `www.oma-ai.com` matched |
| Neon API | same tested main tree | `omaapi` 84 | Current/active, completed; Node 24, 2048 MiB |

All 40 API environment values matched the pre-release snapshot. The two
enabled recovery jobs retained their IDs, paths, versions and every-minute
schedules. Native and same-origin readiness returned 200 with healthy Postgres
and Redis. Anonymous keys, usage export, admin site settings and admin usage
logs returned 401; private recovery paths and `/.env` returned 404. Public
OpenAPI 3.1 has 20 customer paths and no operator/website-chat paths. The catalog
returned 20 models, 18 configured as available, with MiniMax priced at $0.02 per
million input/output tokens and limits of 200,000 context / 16,384 output tokens.
Gonka DeepSeek/GLM remain paused. Base RPC returned chain ID `0x2105`.

At the PR #30 release, calls with a temporary scoped, expiring API key returned upstream 408
timeouts in both OpenAI and Anthropic formats (0/2 successful). Neither charged
credits; persisted billing matched, revocation returned 401 and the harness
session was removed. The follow-up above records the subsequent 2/2 success;
provider latency/capacity and tool-continuation quality remain
unresolved, along with the missing public Reown project ID and failing local
Venice credential. No mainnet payment or facilitator gas transaction was signed.

Browser checks covered 14 public routes, local user Overview/Usage/Settings,
usage pagination, profile/sessions/privacy controls and local admin charts,
usage search/outcome filtering and treasury mock-state disclosure. A nonexistent
request displayed an explicit empty state; free website records showed zero
charges. Final production pricing/docs had one H1, correct canonicals and no
horizontal page overflow at 1280px/390px; captured console warnings/errors were
empty. Current screenshots are in `.screenshots/main-integration-2026-10-11/`.
This is not a claim of a manual review of every generated content page or a
completed live purchase.

Removed 113 superseded CI/build logs while retaining their workflow records and
current release evidence. Payment/recovery histories were preserved. Removed
12 obsolete canceled Vercel builds with alias protection; three aliased canceled
builds and all ready production/rollback deployments were retained. Removed six
generated local example artifacts and the consumed private fixture-link file.
No additional production account, financial or anti-abuse data was deleted.

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
  zero usage. Cancellation before completion finalizes once without deduction;
  delivery failure after committed usage retains the charge and retry claim.
  Upstream credential failures are gateway errors, not customer login failures.
- Account-scoped inference claims prevent simultaneous calls across both API
  formats and different keys owned by the same account. Completed reuse returns
  409 without another call or charge; failed, unbilled attempts can retry.
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
responses are recorded as failed and remain uncharged. Homepage/status/docs
labels describe the enabled catalog instead of implying tested provider health, and
the footer describes actual funding/free-chat behavior with larger mobile links.
The illustrative homepage request uses enabled MiniMax rather than paused
Gonka DeepSeek, matching the quick-start model.
Bookmarked docs sections now scroll after the streamed page mounts instead of
remaining at the hero. A failing regression preceded the fix; the rebuilt
390px browser reached Rate Limits below the sticky header. Default limit notes
wrap within the mobile table; wider model tables remain keyboard-scrollable.

Validation passed 639 API tests in 78 files, including previously skipped real
Postgres payment checks, and 25 real HTTP/authentication groups. These cover
scoped/revoked keys, signup, SIWE, account deletion, ownership isolation,
concurrent inference admission, metering and account-wide emergency limits.
Frontend validation passed 836 tests in 124 files with two workers. Types, lint,
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

### Verified wallet/retry release

| Service | Source | Deployment | Observed state |
| --- | --- | --- | --- |
| Vercel website | `8501209d01f4ada54082d91f77f2bb288dfa9879` | `dpl_5esiZKAzRbnvk7bhoVtQ5mAzeaW7` | READY; canonical `www.oma-ai.com` matched |
| Neon API | `fb4bebcc65c4f64f928630149be41867c21475aa` | `omaapi` 83 | Current/active, completed; Node 24, 2048 MiB |

All 40 API environment values match the pre-release snapshot. Both original
every-minute recovery jobs remain enabled with the same trigger IDs and paths.
The later website copy/bookmark changes did not change or redeploy the API.
Production migration 0005 matches SHA-256
`57ff37962d1a4d9b5c8fc74cc19ab69b74e821bd28ce26992fdb2da7d67e85ae`.
No production account, financial record or historical deployment was deleted.
Two superseded in-progress website releases were canceled during verification.

Native and same-origin readiness returned 200 with healthy Postgres/Redis.
Anonymous key, usage-export and admin-setting requests returned 401;
private recovery paths and `/.env` returned 404. Public OpenAPI 3.1 contains
both inference 409 contracts, the idempotency byte cap and no private paths.
The live catalog returns 20 entries, 18 enabled, MiniMax's 200,000-token context
and 16,384-token output cap, and $0.02 per million input/output tokens.
DeepSeek/GLM remain marked unavailable. Read-only Base and Base Sepolia RPC
checks returned the correct chain IDs; `/x402/info` advertises Base USDC and
the configured treasury. No transfer was signed.

Fresh production browser checks confirmed the docs bookmark, rate-limit notes,
enabled-count copy, correct canonical URLs, one H1 and no page overflow or
captured warnings/errors. Footer columns align on desktop and mobile links
measure 44px. Captures are under
`.screenshots/wallet-retry-audit-2026-10-11/`. The consumed local fixture-link
file was removed. The final website source's
[lockfile workflow](https://github.com/NosytLabs/oma-ai/actions/runs/38146152634)
passed. PR #30 remains open; later receipt commits change documentation only.

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

PRs #30 and #31 are merged. Subsequent receipt commits may change documentation only.
