# Database and account tooling

Run the account tools from `server/`. Never use production credentials for local fixtures.

`deploy-neon.sh` is a separate production release tool: export the deployment API key, then run it from any directory. It deploys code only to the explicit production function/branch, retaining remote secrets and scheduled triggers. It no longer loads or copies development/production `.env` files or reconciles infrastructure implicitly. See [deployment instructions](../../docs/DEPLOYMENT.md) for deliberate configuration changes.

- `pnpm db:seed-test-auth`: creates or refreshes the current local user/admin fixtures and one-time magic links. Only accepts loopback app/database hosts in development or test.
- `pnpm db:cleanup-local`: previews a fixed list of historical local test identities plus expired authentication records. `pnpm db:cleanup-local --apply` first saves a full PostgreSQL backup under `.artifacts/database-backups/`. It preserves current fixtures and refuses cleanup when financial records are present. This is not a production cleanup tool.
- `pnpm test:auth:integration`: builds a temporary local database from migrations, starts the real API, exercises authentication, admin controls, treasury permissions, complete customer statistics, pagination, sessions and account deletion, then drops its own database. It never calls a paid model or signs a mainnet payment.
- From the repository root, `CREDIT_TEST_DATABASE_URL=postgresql://USER@localhost:5432/postgres pnpm validate:server` also enables the real Postgres ledger tests. These include concurrent Polar grants/refunds, usage-refund approvals and rollback, fractional credits, failed-delivery recovery and legacy subscription-period deduplication in temporary schemas. Use a local database role allowed to create schemas; no production payment is made.
- `node --env-file=.env scripts/test-live-model-tools.mjs --run`: opt-in streaming tool-call and continuation check through the running local gateway. Requires the current local user fixture and a configured OpenBroker key. Uses two sponsored website requests, requests upstream usage totals, and removes its temporary login session. `--direct-openbroker` compares the same request directly with the configured provider (provider credits apply); `--omit-assistant-content` isolates returned reasoning in the continuation. Both keep strict result/finish assertions. Without `--run`, it only explains the check.
- `node --env-file=.env scripts/test-live-api.mjs --run --models=minimax-m2-7 --formats=chat,messages`: opt-in paid API check through the local same-origin gateway. Select models explicitly to avoid probing an entire catalog with missing provider credentials. Creates a temporary one-day key limited to those models, requests at most 512 output tokens per model, verifies actual-model headers, usage attribution and credit deductions, and revokes the key/session. It respects rate-limit retry headers. Without `--run`, no provider request occurs. Reports contain synthetic output and metadata, never the key or cookie; actual inference charges remain in the ledger.
- `node scripts/migrate-prod.mjs`: applies pending migrations with Drizzle's migrator, preserving its journal, then verifies every table in `src/db/schema.ts`. A missing table is a hard failure. `--check` verifies without migrating. Requires `DATABASE_URL`; pooled Neon URLs are rewritten to the direct endpoint for migration and administrative work (see [connection guidance](../../docs/DEPLOYMENT.md#backend-deploy-neon)). Run before every backend release: readiness probes establish connectivity, not schema completeness.
- `local-test-context.mjs`: the guard every local test tool calls before touching a database or app origin. It throws outside `development`/`test`, and it requires both the database host and the app origin to be loopback, so no local script can mutate a remote database or a production environment. Use it instead of reading `DATABASE_URL`/`PUBLIC_APP_URL` directly in new tooling.
- `check-admin-binding.mjs`: read-only inspection of admin wallet binding.

For a wallet-linked account missing `evmAddress`, sign in again with that wallet.
The verified SIWE hook repairs the profile binding; `src/auth/__tests__/siwe-profile.test.ts`
covers existing accounts. Use the read-only admin-binding diagnostic if access
still fails. Historical bulk backfill scripts have been retired; migrations
and their metadata remain unchanged.

Backups may contain private account data. Keep them outside version control and restrict access.
