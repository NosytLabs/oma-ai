# Account workspace and dependency follow-up — October 10, 2026

This follow-up continues the [account, usage and treasury audit](account-usage-audit-2026-10-10.md). Production cleanup remains limited to the previously approved expired authentication records; test identities, financial records and audit history are preserved.

## Account workspace

The dashboard now contains Overview, Usage, API keys and Settings. Profile, appearance, sessions, exports and deletion share the account workspace. Existing `/settings` bookmarks redirect to the appropriate dashboard section, including old `privacy`, `theme`, `sessions` and API-key links. Demo links remain read-only even when a real account is signed in.

Analytics requests and polling stop while viewing Settings; session data loads on its own section. Dashboard keyboard navigation does not interfere with tab or time-range controls. Failed synchronization and an unavailable balance are reported explicitly rather than displaying a successful refresh or a zero balance.

Model/provider percentages measure request share, including free requests. Token counts retain their exact values. Charts show small dollar amounts accurately and omit the spend series when no charges occurred. Request details include a copyable request ID, requested/served model and precise time. Model/provider cards stack before their content becomes cramped.

Export, operations and admin token aggregates no longer overflow PostgreSQL's 32-bit integers. Unexpected server errors return a safe error and correlation ID; database statements and parameters are not exposed to customers. Controlled provider errors retain useful recovery messages.

The public database health probe also keeps driver details in server logs and returns only its availability status. A regression check forces a driver failure containing private connection details and verifies the public response does not expose them.

Admin deductions lock the balance and report the amount actually removed. Missing/empty balances and zero adjustments are rejected. Partial deductions carry an accurate cap flag in the response and audit record, and the console displays the applied amount. Regression checks include simultaneous deductions against one small balance.

## Dependency decisions

The compatible direct dependencies are current, including Next.js 16.4.0, Better Auth 1.7.7 and viem 2.57.4. Two apparent updates are deliberately held:

- TypeScript 6.0.3 stays within the current typescript-eslint 8.71.1 supported peer range (`>=4.8.4 <6.1.0`). TypeScript 7.0.2 is outside that range.
- Node 24 types match the repository runtime, Vercel's Node 24 setting and Neon's `nodejs24` function runtime. Node 26 types would describe a different runtime.

The production dependency audit reports zero vulnerabilities. The full audit reports the high-severity development dependency advisory [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) for `braces@3.0.3`, reached through Next's ESLint plugin and fast-glob. No patched upstream release is available. A persistent pnpm patch bounds parser and AST recursion to mitigate the reported stack exhaustion; regression checks exercise normal patterns and excessive nesting. The advisory remains visible because the installed version is unchanged. It is not suppressed or represented as an upstream fix.

Four deprecated transitive packages remain in current upstream tooling (`@esbuild-kit/core-utils`, `@esbuild-kit/esm-loader`, `glob` and `node-domexception`). Removing those dependencies independently would bypass their parents' supported dependency contracts. The frozen lockfile check includes patch changes.

## Authentication, wallet and x402

Reviewed current [Better Auth session guidance](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/concepts/session-management.mdx), [viem custom transport guidance](https://viem.sh/docs/clients/transports/custom) and the [official x402 repository](https://github.com/coinbase/x402) through Context7.

The wallet adapter uses EIP-1193 and EIP-6963 with viem. Provider announcements use their UUID before the wallet brand identifier, so two instances of the same brand do not collapse into one entry. Wallet transport retries are disabled: a rejected signing request must be explicitly retried by the customer.

The existing x402 wire adapter supports version 2, CAIP-2 Base identifiers and the standard payment headers. Production inference uses prepaid credits. Funding uses OMA's custom facilitator contract: verification broadcasts the authorization, and settlement credits the bound payer exactly once. These endpoints are not interchangeable with a generic Coinbase facilitator. Removed an unused Bazaar inference descriptor that advertised a pay-per-request inference flow production does not expose.

No mainnet transaction was executed. Facilitator gas readiness and a live settlement remain unverified. MiniMax tool-result continuation still fails the strict live probe; Gonka DeepSeek and GLM remain paused. These existing upstream and funding limitations are not resolved by dependency compatibility checks.

## Verification

- Frontend: 731 tests passed in 111 files; lint and type checks passed; production build generated 79 routes. One cold lazy-loading chat test timed out while tests and a build competed for resources; the isolated 20-test file and subsequent full 731-test run passed. No assertion was weakened.
- Backend: 523 tests passed, 6 skipped; lint, type checks and build passed. All 16 real HTTP/PostgreSQL integration groups passed, including SIWE, session revocation, account deletion, admin controls, concurrent capped deductions, multi-billion-token totals and database-error redaction. Each integration run uses a separate disposable local database. The final health-probe change was followed by the full backend suite, lint and build; it does not change the previously verified account flows.
- Dependency installation: frozen lockfile check passed; production audit reported zero vulnerabilities. The full audit retained the single mitigated development advisory described above.
- Browser: authenticated profile save/restoration, session refresh, revocation of two other local sessions, account JSON download with eight usage records, deletion confirmation/cancel, appearance change/restoration, legacy bookmarks, read-only demo isolation, keyboard tab navigation and request-ID copying. A local admin deduction of $200 against $100 in test credits applied $100 and displayed the cap; the original $100 balance was restored afterward. Production account deletion and mainnet purchases were not executed. The two updated Playwright bookmark specifications were verified manually through the browser rather than run by the Playwright CLI.
- Layout: desktop and 390px screenshots captured for unified settings and usage. Document width equaled the viewport at both sizes, and no duplicate element IDs were present. Final browser capture returned no warnings or errors. Artifacts remain ignored under `.screenshots/account-audit-2026-10-10/`.
- Public SEO: the production sitemap audit checked all 65 URLs for HTTP status, canonical URL, unique title/description, one H1 and valid structured data; no findings. Private account routes retain `noindex`.

## Release receipt

- Vercel production deployment `dpl_E8XK8kDujJKZjMcxmVFLAXmb6iJN` reached `READY` for frontend commit `6f34a6dc4501cad9ef30594727264e0335e2a755`; aliases include `www.oma-ai.com` and `oma-ai.com`. The subsequent health-probe commit affects only the API.
- Neon function deployment `76` completed with Node 24 and 2048 MiB for API commit `c919b683712f607829f5d309a8207da029bc0aff`. The Neon MCP confirmed deployment 76 was both current and active.
- Production probes at 2026-10-11 00:00 UTC (October 10 locally): native and same-origin readiness returned 200 with database and Redis healthy. The public database health probe returned 200/reachable. Native and same-origin customer usage summary and admin treasury returned 401 without authentication.
- The deployed pricing, docs, models, chat, dashboard, settings and admin pages returned 200. Dashboard, settings and admin retained `noindex, nofollow`. The public catalog returned 20 models, 18 available, with the two paused models and their reasons preserved; this is catalog availability, not a live inference test for every model. OpenAPI returned version 3.1.0; x402 info retained version 2, Base CAIP-2 network and `no-store`.
- GitHub's frozen lockfile check passed on commit `6f34a6d`. Full application tests were run locally as recorded above; the full GitHub workflow remains manual. PR 30 contains the changes and remains open.
