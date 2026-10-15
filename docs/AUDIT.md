# Gateway and account audit

Latest full platform validation: October 13, 2026. This is a compact evidence
index, not a claim that every model or mainnet payment has been verified.
[Platform](PLATFORM.md), [Deployment](DEPLOYMENT.md) and
[Chat UI](chat-ui.md) describe the maintained product behavior.

## Verified fixes

- Browser account actions use Better Auth sessions. API keys are scoped,
  expiring and checked against Postgres; revoked keys, suspended users and
  deleted accounts cannot authenticate through stale cache entries.
- Keys, sessions, deposits, usage and exports select the authenticated owner.
  Tests reject forged account IDs, mixed credentials and protected profile
  writes. Account deletion invalidates keys/sessions and retains detached
  payment-security records.
- The website proxy blocks private paths and strips untrusted runtime headers.
  Database/provider secrets and SQL errors are excluded from customer responses.
- Free website chat uses a separate proxy and UTC quotas: 20 guest-IP or 100
  account attempts daily. SDK requests spend prepaid credits. Copying browser
  source headers does not grant free SDK inference.
- Both inference formats share scopes, model/output limits, billing, request
  claims and streaming handling. Concurrent/repeated billed operations cannot
  duplicate the charge. Completed idempotency reuse returns 409; response
  bodies are not stored/replayed. Failed unbilled attempts may retry.
- Funding availability fails closed on disabled rails or settings outages.
  Settlement checks authentication before returning private state, uses
  `no-store`, and credits confirmed transactions once. Recovery jobs retain
  durable claims across retries.
- OTP resend limits run before Better Auth creates a replacement code. A
  blocked resend returns 429 with `Retry-After`; the delivered code remains
  usable. Origin checks precede the cooldown. Three incorrect OTP attempts
  exhaust that code's verification budget.
- The dashboard combines overview, usage, API keys and settings. Private caches
  include account identity; demo actions remain read-only. Usage totals come
  from complete aggregates, retain fractional cents, and support range exports.
- Payment notifications use account-specific cache/read state, cancel requests,
  reset open panels on account changes, and keep a newly completed payment
  unread after its pending update was acknowledged. Completion timestamps and
  advancing badge cutoffs prevent stale or missing badges. $25 displays as $25;
  errors offer retry. The popover fits 320, 390 and 640px viewports.
- Admin provides usage/revenue charts, searchable cursor-paginated records,
  account controls and treasury diagnostics. A local 1,001-account fixture
  traversed 21 pages without duplicates. Deductions lock/cap to available
  balance and distinguish failures/refunds from customer charges.
- Public docs, OpenAPI and agent guides omit private operator routes, describe
  the supported API subsets, and identify the advertised x402 recipient.
  SDK onboarding has one key-creation path and the correct base URL. Docs
  navigation follows hashes while retaining the sticky header.

## Validation and release evidence

The October 13 release passed on Node 24:

| Check | Recorded result |
| --- | --- |
| Frontend | 859 tests across 128 files |
| API | 655 tests across 79 files; all 17 Postgres payment/idempotency suites active |
| Real HTTP/auth suite | 30 groups using an isolated migrated local database |
| Toolchain | Types, lint, both production builds and frozen installation passed |
| Production dependencies | Zero known production vulnerabilities in the recorded audit |
| Customer browser flows | Local user/admin, keys, exports, sessions, deletion confirmation, deposits and mobile layouts |

The real HTTP suite covers signed EOA/SIWE login, origin/port validation, OTP
budgets, owner isolation, key restrictions/revocation, deletion, streaming,
billing and admin pagination. It creates and drops its own database; it does
not call paid providers. A local scan of 204 compiled client JavaScript files
found none of the five configured server-secret values inspected. That is not
a comparison against unknown production secrets.

Released runtime sources are merge `d8056f86836ab7331fb9fc22ef6a57c6989779b0`
(PR #36), with documentation follow-ups through `799ffb25`:

- Vercel `dpl_8bFm2bGduscfgdSZd6kigvvw31Uw` was `READY` and served the
  canonical domain. Its app sources matched the tested commit.
- Neon `omaapi` deployment 88 was current/active and completed on Node 24.
  The code-only release supplied no environment updates. Its metadata retained
  the same 40 environment **names**; secret values were not independently
  compared. Both minute-based recovery jobs remained enabled and unchanged.
- Native readiness returned 200 with healthy Postgres and shared Redis.
  Anonymous private/admin routes returned 401 and `no-store`; cross-site OTP
  sends returned 403 through both the website and native API.
- The catalog returned 20 configured entries, 18 enabled. Production pricing
  had one H1, the canonical URL, no 390px overflow and no operator setup copy.

These are observations at release time. New checks belong in their release PR;
old counts and deployment IDs must not be presented as fresh validation.

## Real provider results and pricing

Scoped, temporary local keys exercised both Chat Completions and Messages.
Fresh MiniMax requests returned 200, the requested actual-model header and
49 input / 150 output tokens. Charges matched usage and balance deductions.
The key was revoked (401 afterward) and its session removed. Latencies were
141.2s and 10.5s. Both **failed** the strict answer assertion: extra reasoning
followed `OMA_API_OK`. A direct OpenBroker request reproduced it in 5.0s with
the same token counts. Initial structured tool calls succeed, but strict
tool-result continuation also produces unwanted markup/text upstream.
Assertions were not weakened and provider output was not silently rewritten.

Current private local evidence is retained under `.artifacts/provider-audit/`:

- `notification-audit-model-results-2026-10-13.json`
- `notification-audit-direct-model-2026-10-13.json`
- `payment-audit-model-results-2026-10-13.json`
- `payment-audit-venice-results-2026-10-13.json`

Live retrieval of the [OpenBroker FAQ](https://openbroker.gonka.gg/docs/faq)
and [pricing](https://openbroker.gonka.gg/docs/pricing) found the FAQ's old
1-nanosecond figure inconsistent with current escrow pricing: 10 nanoseconds
per token per attempt, around 15 averaged across retries. Provider concurrency
is shared; it is not a guaranteed per-key quota. OMA retail is fixed at
$0.02 per million input tokens and $0.02 per million output tokens. Dollar
cost/profit requires the GNK procurement cost basis and retry accounting.
Venice catalog rates include a 50% markup; estimates are not settled invoices.
The live catalog is authoritative for rates and advertised model limits.

## Remaining limitations

- MiniMax transport/billing succeeded, but strict response quality did not.
  Gonka DeepSeek/GLM routes remain paused. Enabled catalog entries do not prove
  all models serve good results.
- The local Venice credential returns upstream 401; customer errors are safe
  availability messages and these failed calls do not charge. Production Venice
  inference is unverified; the deployment exposes credential names, not values.
- Injected EIP-1193/EIP-6963 wallets and real local SIWE signatures are covered.
  Live WalletConnect QR/mobile pairing needs a valid public Reown project ID.
  Missing/placeholder IDs hide that connector; live pairing remains unverified.
- x402 v2 is OMA's authenticated funding contract. Verification broadcasts;
  settlement credits the SIWE-bound payer once. It is not generic facilitator
  or pay-per-inference compatibility. No mainnet transfer was signed in this
  audit; facilitator gas and live reconciliation remain unverified.
- Balances remain aggregate. Per-grant refund/allocation policy needs a ledger
  migration; no expiry dates or financial records were fabricated or removed.
- Messages supports text/function tools, not images/documents, extended
  thinking, caching or beta features. Full Claude Code parity is not claimed.
- Local quotas can use bounded memory without HTTP Redis credentials; this is
  weaker than durable production counters. A plain `redis://` daemon cannot
  serve the HTTP Redis client. Support delivery needs a verified webhook.
- TypeScript 7 is held outside the supported lint-tool peer range; Node 24
  typings match both production runtimes. The development-only braces advisory
  has a persistent recursion-bound patch and regression coverage, not a claimed
  upstream version fix. Deprecated transitives remain under parent contracts.

## Repository cleanup — October 14

The follow-up removes unused frontend credit-batch wrappers, props, types,
query invalidations and demo grants. The aggregate ledger remains the only
displayed balance source; the demo totals now satisfy added − spent = balance.
Sample requests use catalog token rates, failed requests have no charge/output,
and recent activity derives its usage amount from the same sample request.
The tour uses MiniMax rather than advertising the paused Gonka DeepSeek route.
The server compatibility endpoint, database tables and financial records remain.

Unused Docker/Coolify/oldpc templates and launch scripts were removed: they used
Node 22, unsupported Redis connections and nonexistent API-host defaults. The
duplicated root environment template is removed; the maintained templates are
`app/.env.example` and `server/.env.example`. Active deployment documentation
continues to target Vercel/Neon.

Eight closed/merged PR cards were unlinked from this task. GitHub PR history
remains available. Before this follow-up there were no open PRs or extra
branches. Cleanup removed 151 superseded scratch files and 58 older local audit
artifacts, retaining current evidence, runtime logs and private database backups.
Sixteen obsolete Vercel deployment records and four generated aliases for
merged branches were removed with explicit IDs and alias protection. The live
deployment, latest tested preview and two production rollback candidates remain.
The long chronological audit was replaced by this index; complete reports stay
in Git history. Security policy, license notices, migrations, generated agent
instructions and maintained operational documentation are preserved.

The cleanup passed frontend types, lint, production build and 861 tests across
129 files on Node 24. Three doc assertions targeted a removed template; one new
five-test suite verifies demo accounting and charges. Repository Markdown links resolve.
The API runtime was not changed or redeployed by this cleanup.

Production data cleanup remains limited to the separately authorized six
expired sessions and 14 verification records before `2026-10-10T22:40:00Z`.
Both test identities and the operator key were preserved. The
[exact cleanup receipt](audits/database-cleanup-2026-10-10.md) remains available;
this repository cleanup does not authorize deleting production users or money
records.

## October 15 follow-up

October 15 follow-up: retired sample model IDs are skipped, and an empty sample
catalog produces an empty history instead of crashing the dashboard module.
Demo timestamps never exceed the current time; chart windows now exclude future
requests just as the last-24-hours card does. Rolling windows use elapsed time,
so spring/fall clock changes cannot shift chart totals by an hour. The USD-per-million to fractional
cents conversion has an explicit example. The duplicate root environment file
was removed again after it was reintroduced: it pointed the auth/API proxy at
its own public website and omitted server configuration. Dedicated environment
templates and pricing-override documentation now describe the actual loader,
five-second billing cache and operator-only setup diagnostics.

Validation passed on Node 24: 871 frontend tests, 655 API tests with the Postgres
suites enabled, types, lint and both builds. The exact 24-hour boundary now has
a fixed-clock regression, replacing an ambiguous wall-clock test fixture.

## Historical evidence

- [Full October 10–13 gateway, account and release report](https://github.com/NosytLabs/oma-ai/blob/799ffb258828f44b01f92f4d9763c1222543599a/docs/audits/gateway-api-security-audit-2026-10-10.md)
- [Original account/dependency report](https://github.com/NosytLabs/oma-ai/blob/3b4774e409d923c3689c0d6a60e6108e954bdf73/docs/audits/account-platform-followup-2026-10-10.md)
- [Original usage/treasury report](https://github.com/NosytLabs/oma-ai/blob/3b4774e409d923c3689c0d6a60e6108e954bdf73/docs/audits/account-usage-audit-2026-10-10.md)
- [Original platform report](https://github.com/NosytLabs/oma-ai/blob/3b4774e409d923c3689c0d6a60e6108e954bdf73/docs/audits/audit-2026-10-10.md)
