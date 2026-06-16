# In-Process Jobs → GitHub Actions Migration

**Date:** 2026-06-16
**Author:** OMA-AI infra-cost audit (see `INFRA-COST-RESEARCH-2026-06-16.md`)
**Goal:** Stop keeping the Node process active with `setInterval` timers so
NEON Postgres can scale to zero during idle periods. Estimated 30-50%
compute savings on the DB tier (NEON's 5-minute auto-suspend was being
blocked by the heartbeat these timers generated on every database query
the job issued).

---

## What changed

### Jobs moved to GitHub Actions (6)

| Job | Old in-process interval | New cron | Workflow |
|---|---|---|---|
| `processExpiredCredits` | 24h `setInterval` | `0 2 * * *` (daily 02:00 UTC) | `.github/workflows/credit-expiry.yml` |
| `processExpiredSubscriptions` | 1h `setInterval` | `17 * * * *` (hourly, offset) | `.github/workflows/subscription-check.yml` |
| `processExpiredNonces` | 15m `setInterval` | `*/15 * * * *` | `.github/workflows/nonce-cleanup.yml` |
| `retryFailedDeposits` + `expireStaleDeposits` | 60s `setInterval` | `*/5 * * * *` | `.github/workflows/deposit-retry.yml` |
| `processPendingRecoveries` | 5m `setInterval` | `*/5 * * * *` | `.github/workflows/wrong-network-recovery.yml` |
| `processPendingDeposits` + `retryFailedWebhooks` | 60s `setInterval` | `*/5 * * * *` | `.github/workflows/deposit-notifications.yml` |

Each workflow uses `npx tsx src/jobs/cli-runner.ts <job-name>` to invoke the
job. The runner imports the existing work function (e.g.
`processExpiredCredits`) and runs it once, exiting 0 on success / 1 on
error. Workflows rely on the exit code for failure detection.

### New retention job (1)

| Job | Schedule | Workflow |
|---|---|---|
| `runRetention` (NEW) | `0 3 * * *` (daily 03:00 UTC) | `.github/workflows/retention.yml` |

Adds bounded retention for four previously-unbounded tables:

| Table | Retention | Reason |
|---|---|---|
| `usage_records` | 90 days | Billing reconciliation only needs 90d; index on `created_at` |
| `audit_logs` | 365 days | Compliance: 1 year minimum |
| `oracle_prices` | 30 days | Time-series; older samples not needed |
| `deposit_notifications` | 90 days | Recent customer-support context only |

### In-process tasks that **stayed** (3)

These cannot be moved to GH Actions because they drive a process-local
in-memory state (the circuit-breaker cache) or are real-time critical:

| Function | Interval | Reason it stays |
|---|---|---|
| `startBackgroundDbSync` | 30s | Pushes the in-process circuit-breaker state to Redis → DB. The breaker is in-memory; the sync must run in the same process that holds it. |
| `startBackgroundProbing` | 60s | Actively probes idle AI providers in real time. Drives the OPEN→HALF_OPEN transition timing. |
| `startCacheCleanup` | 5m | Cleans the in-process `healthCache` map. Useless to run externally — the map lives in the Node process. |
| `triggerCheapTokensRefresh` | one-shot at boot | Cold-start cache hydration. No interval; not a "job". |
| `reloadModelCatalog` | one-shot at boot | Cold-start model catalog load. No interval; not a "job". |
| `initProviderResultReporter` | one-shot at boot | Cold-start reporter init. No interval; not a "job". |

---

## How to manually trigger a job

Every workflow has `workflow_dispatch` enabled. From the GitHub UI:

1. Repository → **Actions** → pick the workflow (e.g. "Credit Expiry")
2. Click **Run workflow** → **Run workflow**

From the CLI:

```bash
gh workflow run credit-expiry.yml
gh workflow run deposit-retry.yml
gh workflow run retention.yml
# etc.
```

You can also run the CLI runner locally against the production DB to
debug a single job:

```bash
cd server
DATABASE_URL=... JWT_SECRET=... npx tsx src/jobs/cli-runner.ts credit-expiry
```

The runner writes a single JSON line to stdout with the result and
duration, and exits with code 0 on success / 1 on error.

---

## How to add a new scheduled job

1. **Add the work function** to `server/src/jobs/<name>.ts`. Export it.
   Keep it idempotent — workflows can be triggered manually and may
   overlap if a previous run is still in flight.
2. **Register the function** in `server/src/jobs/cli-runner.ts` under
   `JOBS` with a kebab-case name.
3. **Add a workflow** at `.github/workflows/<name>.yml` following the
   pattern of the existing ones. Always include both `schedule` and
   `workflow_dispatch` triggers. Always set a `concurrency.group` to
   prevent overlapping runs.
4. **Add a unit test** under `server/src/__tests__/` that calls the
   work function directly (the CLI runner is just a thin wrapper).
5. **Update this document** with the new job.

If the work function needs to run in-process (e.g. it drives a state
machine that lives in the Node process), do NOT move it. Just add it
to the `if (config.NODE_ENV !== "test")` block in `index.ts`.

---

## File inventory

### Created

- `app/.github/workflows/credit-expiry.yml`
- `app/.github/workflows/subscription-check.yml`
- `app/.github/workflows/nonce-cleanup.yml`
- `app/.github/workflows/deposit-retry.yml`
- `app/.github/workflows/wrong-network-recovery.yml`
- `app/.github/workflows/deposit-notifications.yml`
- `app/.github/workflows/retention.yml`
- `app/server/src/jobs/cli-runner.ts`
- `app/server/src/jobs/retention.ts`
- `app/docs/INFRA-JOBS-MIGRATION-2026-06-16.md` (this file)

### Modified

- `app/server/src/index.ts` — removed 6 setInterval schedules + their
  imports; added a comment block listing the external triggers and the
  in-process tasks that must stay.
- `app/server/src/jobs/deposit-recovery.ts` — `processPendingRecoveries`
  changed from `async function` (file-local) to `export async function`
  so the CLI runner can call it.
- `app/server/src/jobs/deposit-notifications.ts` — `processPendingDeposits`
  and `retryFailedWebhooks` changed from file-local to `export`.

### Untouched (intentional)

- The `schedule*()` helper functions in each job module are kept
  (exported) but no longer called from `index.ts`. The existing unit
  tests in `__tests__/cron-jobs.test.ts` and `__tests__/nonce-cleanup.test.ts`
  call them with `vi.useFakeTimers()` and still pass.
- `app/server/src/inference/provider-health.ts` (the
  `startBackgroundDbSync` / `startBackgroundProbing` / `startCacheCleanup`
  trio) is unchanged. These are the in-process tasks the breaker depends
  on.

---

## Required GitHub repository secrets

The workflows read the same env vars the long-lived server reads.
Configure these under **Settings → Secrets and variables → Actions**:

| Secret | Used by | Required? |
|---|---|---|
| `DATABASE_URL` | all 7 workflows | yes |
| `JWT_SECRET` | all 7 workflows | yes (config.ts requires it) |
| `REDIS_URL` | deposit-retry, wrong-network-recovery, deposit-notifications | yes (these jobs use Redis for retry counters / state) |
| `HOUDINI_API_KEY` | deposit-retry | required if any pending deposits are `houdini_swap` type |
| `HOUDINI_API_SECRET` | deposit-retry | required if any pending deposits are `houdini_swap` type |
| `HOUDINI_PARTNER_ID` | deposit-retry | required if any pending deposits are `houdini_swap` type |
| `HOUDINI_API_URL` | deposit-retry | optional (defaults to production) |
| `CHAIN_RPC_URL` | wrong-network-recovery | optional (defaults to public Base RPC) |

---

## Verification

After deploy, watch one cycle of each:

1. **GitHub Actions → All workflows** — every cron should show a green
   tick within its first scheduled window.
2. **NEON console → Compute** — the API compute should now show idle /
   suspended periods of 5+ minutes during low traffic (previously it
   never suspended because of the 6 setIntervals).
3. **Logs** — the JSON result line from the CLI runner is searchable
   by job name.

## Rollback

If a job needs to revert to in-process:

1. Restore the `import` and `schedule*()` call in `server/src/index.ts`.
2. Disable the corresponding workflow (or delete the `.yml` file).
3. The CLI runner can stay — it has no other callers.

The `schedule*()` helpers are kept intentionally so rollback is a
two-line change.
