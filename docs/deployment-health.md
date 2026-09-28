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
