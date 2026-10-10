# Database and account tooling

Run these from `server/`. Never use production credentials for local fixtures.

- `pnpm db:seed-test-auth`: creates or refreshes the current local user/admin fixtures and one-time magic links. Only accepts loopback app/database hosts in development or test.
- `pnpm db:cleanup-local`: previews a fixed list of historical local test identities plus expired authentication records. `pnpm db:cleanup-local --apply` first saves a full PostgreSQL backup under `.artifacts/database-backups/`. It preserves current fixtures and refuses cleanup when financial records are present. This is not a production cleanup tool.
- `pnpm test:auth:integration`: builds a temporary local database from migrations, starts the real API, exercises authentication, admin controls, treasury permissions, complete customer statistics, pagination, sessions and account deletion, then drops its own database. It never calls a paid model or signs a mainnet payment.
- `node --env-file=.env scripts/test-live-model-tools.mjs --run`: opt-in streaming tool-call and continuation check through the running local gateway. Requires the current local user fixture and a configured OpenBroker key. Uses two sponsored website requests, requests upstream usage totals, and removes its temporary login session. Without `--run`, it only explains the check.
- `check-admin-binding.mjs`: read-only inspection of admin wallet binding.
- `backfill-evm-address.sql` / `check-backfill-sql.mjs`: review historical wallet-binding candidates and the guarded query.
- `run-backfill.mjs`: dry-run report by default. Only `--apply` executes the guarded wallet binding transaction. Review candidates and obtain authorization for the target database first.

The old `verify-admin-usage.mjs` and `diagnose-failover-sql.mjs` duplicated outdated route SQL. They were removed; the real HTTP/database integration checks now validate the actual analytics routes.

Backups may contain private account data. Keep them outside version control and restrict access. See [the cleanup receipt](../../docs/database-cleanup-2026-10-10.md) for the separately approved production authentication cleanup.
