# Deployment health

The production frontend is Vercel project **oma**, rooted at `app/`, serving
`www.oma-ai.com`. The separate **oma-ai** Vercel project points at the monorepo
root and has no frontend build configuration or custom production domain.
Its Ignored Build Step is `exit 0` to stop redundant Git-triggered builds.

Use pnpm 9.15.9 from the repository root when changing dependencies. Commit
`pnpm-lock.yaml` with every workspace manifest change. Do not update only an
npm lockfile: Vercel installs the pnpm workspace with a frozen lockfile.

The September 28 production failure was `ERR_PNPM_OUTDATED_LOCKFILE`: the app
manifest had removed `@vitest/coverage-v8` while the pnpm importer still
declared it. Regenerating the lockfile fixes the production install contract.
The `Deployment lockfile` workflow checks this contract without downloading
dependencies or running package scripts. It runs only for dependency/config
changes and can also be dispatched manually. The full CI remains manual.

Before releasing changes, run `pnpm install --frozen-lockfile`, then
`pnpm validate`. Use the existing CI workflow for app/server and browser
verification. Existing Vercel Git integration publishes the frontend; no
additional GitHub deployment credential or one-shot deployment workflow is
needed for that path.

The full CI repair also makes Playwright build/start its own frontend on a
fresh runner. Previously every browser navigation failed with connection
refused because no server was started. Its CI reporter prints test failures
directly instead of leaving only an HTML report on the runner.
Responsive checks wait for rendered page content instead of background
requests becoming idle. The deposit check targets its visible page heading,
not hidden mobile navigation text.

The storage quota regression now intercepts `setItem` on its actual method
owner: jsdom's Storage proxy needs a prototype spy, whereas the Node 26
in-memory fallback has an own method. This fixes the Node 24-only test failure
without changing application storage behavior.

## September 28 service checks

The frontend and API are separate health signals. A Ready Vercel deployment
and API `/health` response do not prove that Redis or inference providers
are healthy. On September 28, API `/ready` reported degraded Redis because its configured
Upstash hostname did not resolve. The October 7 check confirms this outage
has been resolved; do not substitute the development environment.
The bounded authentication fallback preserves each route's configured
request budget while that dependency is unavailable.

At 05:28 UTC, a real website request received provider HTTP 503 responses for
both `MiniMaxAI/MiniMax-M2.7` and `zai-org/GLM-5.3-Flash`. Both identifiers are
present in the upstream's public `/v1/models` catalog. This is evidence of
provider unavailability, not a reason to invent different model IDs or route
free requests to a paid provider.

A separate raw response check showed repetitive text from the free DeepSeek
route. Automatic free failover excludes that peer until a live completion
confirms recovery; explicit selection is retained. GLM and MiniMax remain
the automatic free peers, and unavailable-provider errors remain visible
when neither can serve a request.

Model API `available` flags reflect configured routes, not synthetic
inference health probes. Public counts use **enabled models**, and both
model endpoints expose the catalog's canonical `capabilities` array so list
and detail pages do not disagree after loading live data.

## October 7 audit

The production Neon `/ready` probe reports HTTP 200, with Postgres and Redis
healthy. The usage-metering columns from migration 0004 are present. No database
migration or credential replacement was needed for this release.

A real browser chat request returned HTTP 500 with `unusable`. The per-model
limiter consumed the body before the daily limiter tried to clone the raw
Request. Both middlewares now use Hono's cached body parser. The regression
check exercises body-size, model-limit, and daily-limit middleware together.

The dependency upgrade also changed Better Auth's development magic-link
record format. Local seeded records now include the `magic-link:` identifier
prefix and record type; the real authentication integration suite validates
both seeded roles against the installed verifier.

Two more rate-limit regressions were reproduced over HTTP: delegated model
limits dropped their rejection response, and unrelated routes shared a default
counter. Rejections now propagate, and default budgets use the HTTP method and
registered route pattern. Parameter changes cannot create new budgets.

The October 7 live GLM and MiniMax browser requests returned complete HTTP 200
streams. DeepSeek still returned repetitive text and exhausted its output limit
on two independent prompts; it remains excluded from automatic free failover.
The local Venice credential returned 401, which does not establish the health
of the separate production Venice credential. See the full scope and evidence
in [the October 7 audit](audits/2026-10-07-site-auth-api.md).
