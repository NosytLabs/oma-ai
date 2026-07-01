# GitHub Workflows

This document explains the current state of `.github/workflows/`, why most
scheduled jobs are turned off, and exactly how to turn them back on when the
site goes live.

## TL;DR

| Workflow                     | Schedule          | Trigger now        | Notes                              |
| ---------------------------- | ----------------- | ------------------ | ---------------------------------- |
| `ci.yml`                     | none              | push, pull_request | Always-on. Required for PR checks. |
| `deploy.yml`                 | none              | manual             | Manual deploy to Vercel.           |
| `credit-expiry.yml`          | **disabled**      | manual             | Re-enable when site goes live.     |
| `deposit-notifications.yml`  | **disabled**      | manual             | Re-enable when site goes live.     |
| `deposit-retry.yml`          | **disabled**      | manual             | Re-enable when site goes live.     |
| `nonce-cleanup.yml`          | **disabled**      | manual             | Re-enable when site goes live.     |
| `retention.yml`              | **disabled**      | manual             | Re-enable when site goes live.     |
| `subscription-check.yml`     | **disabled**      | manual             | Re-enable when site goes live.     |
| `wrong-network-recovery.yml` | **disabled**      | manual             | Re-enable when site goes live.     |
| `notify-disabled.yml`        | none              | manual             | Prints this document's summary.    |

## Why schedules are disabled

The site is in a refactor/revamp phase and is not yet live in production.
The seven "cron" workflows all import `server/src/config.ts`, which validates
required secrets with `envSchema.parse(process.env)` at module load. Without
production secrets configured in the repo, those imports throw, the job
fails, and GitHub emails the owner about a "failure."

Email spam on every scheduled tick is not actionable — the failure is
expected. So the schedules are commented out and the workflows are gated to
`workflow_dispatch` only. The `check-secrets` step in each cron workflow
makes a manual run skip cleanly (with a warning) if secrets are still
missing, so they cannot fail by accident.

## Defense-in-depth changes (audit, this commit)

- Every workflow now declares `permissions: contents: read` at the root.
  This is the minimum token scope needed to checkout code; it limits the
  blast radius if a workflow is ever hijacked via a compromised action.
- Each cron workflow's `concurrency.group` was renamed from `cron-*` to
  `ci-*`. Old scheduled-run history is keyed under `cron-*`; reusing that
  prefix would let a queued historical run cancel or displace a fresh
  manual run. The new prefix starts a fresh group with no history.
- A new `notify-disabled.yml` workflow exists only to print a reminder
  message when run manually, so future maintainers understand why nothing
  fires on a schedule.

## Re-enable procedure (go-live checklist)

Work through this list before flipping any schedule back on.

### 1. Configure production secrets

In **GitHub → Settings → Secrets and variables → Actions → Repository
secrets**, add (all values come from your production environment, never
commit them):

- `DATABASE_URL` — Postgres connection string
- `REDIS_URL` — Redis connection string
- `JWT_SECRET` — long random string
- `CHAIN_RPC_URL` — mainnet RPC endpoint
- `HOUDINI_API_KEY`, `HOUDINI_API_SECRET`, `HOUDINI_PARTNER_ID`,
  `HOUDINI_API_URL` — Houdini swap partner credentials
- `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_APP_PROJECT_ID`,
  `VERCEL_API_PROJECT_ID` — Vercel deploy credentials

### 2. Smoke-test one cron workflow manually

1. Open **Actions → Credit Expiry → Run workflow** on `master`.
2. Confirm the run **succeeds** (the `check-secrets` step should print
   `skip=false` and the job should hit `cli-runner.ts`).
3. If it fails, the secrets list above is incomplete or the server still
   refuses to boot without additional env vars. Fix the root cause before
   enabling the schedule.

### 3. Uncomment the `schedule:` block in each cron workflow

For each of the seven disabled workflows, replace the top with the
following shape (edit `cron` to taste — examples shown):

```yaml
on:
  # Site not live yet — schedule disabled to prevent CI spam.
  # Re-enable the schedule block (below) when the site goes live.
  workflow_dispatch:
  schedule:
    - cron: "0 * * * *"        # credit-expiry.yml   — hourly
    # - cron: "*/15 * * * *"   # deposit-notifications.yml — every 15 min
    # - cron: "*/15 * * * *"   # deposit-retry.yml        — every 15 min
    # - cron: "*/5 * * * *"    # nonce-cleanup.yml        — every 5 min
    # - cron: "0 3 * * *"      # retention.yml            — daily 03:00 UTC
    # - cron: "0 * * * *"      # subscription-check.yml   — hourly
    # - cron: "*/10 * * * *"   # wrong-network-recovery.yml — every 10 min
```

Pick one suggested cadence per workflow, comment out the others, and apply
to all seven. Keep `workflow_dispatch:` so an operator can still run them
by hand.

### 4. Remove the `notify-disabled.yml` workflow (optional)

It is harmless to leave it in place — it only runs on manual dispatch.
But once schedules are live there is no longer a "why is nothing running"
question to answer, so deleting it keeps the Actions tab tidy.

### 5. Verify

- Wait one cron interval (or use `gh workflow run` to trigger manually).
- Confirm the job succeeds.
- Confirm **no email** is sent for a passing run. (GitHub only emails on
  failure or for the first success after a failure. If you get an email,
  the run actually failed; investigate.)

## Going back to pre-launch mode

If you ever need to suppress the schedules again (e.g. before a deploy that
intentionally breaks the server boot), comment the `schedule:` blocks back
out per step 3 and re-enable `notify-disabled.yml` if it was deleted. The
`check-secrets` steps will keep the workflows safe to run manually during
the transition.

## Contact

Owner: `@NosytLabs`. Repo issues for workflow changes, please.