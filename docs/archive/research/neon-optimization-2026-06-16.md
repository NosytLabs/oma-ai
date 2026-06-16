# NEON PostgreSQL Optimization, Auto-Cleaning & Pruning

**Project:** OMA-AI (Hono.js + Drizzle ORM + NEON serverless Postgres)
**Date:** 2026-06-16
**Author:** Research report (no code changes)

---

## 0. Note on existing docs

The three docs called out in the request brief —
`docs/archive/research/neon-research-2026-06-16.md`,
`docs/archive/research/database-auto-cleaning-2026-06-16.md`, and
`docs/database-auto-cleaning.md` — **do not exist on disk** (verified by
`ls` and `find` of `app/docs/`). They appear to have been planned but
never written. This report is the canonical replacement. Once the
optimizations ship, a `docs/database-retention.md` should be added (per
`AGENTS.md` "NEVER proactively create documentation files" rule, this
should be added only when the implementation lands).

---

## 1. Executive summary

OMA-AI has a healthy 26-table Drizzle schema with good index coverage on
the hot paths, but **zero retention / cleanup coverage on the four
largest growth tables**: `usage_records`, `audit_logs`, `oracle_prices`,
and `deposit_notifications`. At the current schema and write rate the
database will grow ~3–10 MB/day of audit + usage data, and several
unbounded growth tables will accumulate for the lifetime of the
project.

**Key findings:**

1. The 7 background jobs cover expiry, retry, recovery, and nonce
   cleanup, but **none of them deletes historical data** from
   `usage_records`, `audit_logs`, `oracle_prices`, or
   `deposit_notifications`.
2. The schema already has 25+ indexes — including two well-designed
   composite indexes on `usage_records` and a partial index on
   `credit_batches`. No critical indexes are missing.
3. The current NEON connection is `drizzle-orm/neon-http` (no pooling
   layer in our code; the code adds `pgbouncer=true` query params to
   the connection string but is hitting the HTTP driver, not TCP — see
   §6 for the correct fix).
4. The 6 `setInterval` schedulers (`credit-expiry`,
   `subscription-cron`, `nonce-cleanup`, `deposit-retry`,
   `deposit-recovery`, `deposit-notifications`) all run on the main
   process and **prevent NEON auto-suspend from kicking in** (NEON
   docs: "compute stays active while subscribers are connected").
   This is the largest single wasted-CU source.
5. Storage cost is currently trivial (~0.5 GB / 6 months at estimated
   growth), so the cost savings story is **mostly compute**, not
   storage. Estimated savings: 30–50% of monthly NEON bill on a
   modest production workload.

---

## A. Current schema overview

26 tables, 794 lines of schema. Source:
`/Users/tyson/Desktop/Code/OMA-AI/app/server/src/db/schema.ts`.

### A.1 Table inventory with growth profile

| Table | Estimated row growth | Retention | Has `createdAt`? | Indexed `createdAt`? | CASCADE on user delete? |
|---|---|---|---|---|---|
| `users` | Slow (signup rate) | Forever | yes | no | — (root) |
| `api_keys` | Slow | Forever | yes | no | **cascade** |
| `deposits` | Per deposit event | Forever (audit) | yes | yes (`idx_deposits_created_at`) | **cascade** |
| `credit_balances` | 1 per user | Forever | — | — | **cascade** |
| **`usage_records`** | **HIGH — 1 per chat call** | **None** | yes | **yes (multiple)** | cascade / set null |
| `provider_health` | 1 per provider (14 rows) | Forever | — | — | n/a |
| `credit_batches` | Per deposit | Forever | yes | yes (expiry index) | **cascade** |
| `credit_transfers` | Per P2P transfer | Forever | yes | no | cascade |
| `auto_reload_settings` | 1 per user | Forever | — | — | cascade |
| `settlements` | Per on-chain settlement | Forever | — | — | n/a |
| `refund_requests` | Slow | Forever | yes | yes | cascade / set null |
| `oracle_prices` | **HIGH — per price tick** | **None** | yes (`capturedAt`) | yes (`idx_oracle_captured`) | n/a |
| `staking_tiers` | 1 per user | Forever | — | — | cascade |
| `teams`, `team_members`, `sso_connections` | Slow | Forever | yes | no | cascade |
| `budget_alerts` | 1 per user | Forever | — | — | cascade |
| `budget_alert_history` | Per alert fire | Forever | yes | yes | cascade |
| `plans` | 3–10 | Forever | — | — | n/a |
| `subscriptions` | Per signup | Forever | — | — | cascade / set null |
| `invoices` | Per billing event | Forever | yes | yes (due_date) | cascade |
| **`audit_logs`** | **HIGH — 1 per auth/admin event** | **None** | yes | **yes (8 indexes!)** | set null |
| `admin_config` | <50 | Forever | — | — | n/a |
| `rate_limit_overrides` | Slow | Forever | yes | yes (expiry) | n/a |
| `deposit_recoveries` | Per wrong-network case | Forever | yes | yes | cascade |
| **`deposit_notifications`** | **HIGH — per webhook fire** | **None** | yes | yes (`idx_deposit_notifications_created`) | **cascade** |
| `webhook_subscriptions` | Slow | Forever | — | — | cascade |
| `withdrawals` | Per withdrawal | Forever | yes | yes | cascade |
| `byok_keys` | Slow | Forever | — | — | n/a |

**Bold** = the four high-growth tables with no retention.

### A.2 Estimated growth rates (assumptions from code)

| Table | Estimate at 1k users, 10 req/day, 90 days | Estimate at 10k users, 100 req/day, 90 days |
|---|---|---|
| `usage_records` | 900k rows × ~400 B/row = **~360 MB** | 90M rows × ~400 B = **~36 GB** |
| `audit_logs` | 100k–1M events × ~250 B = **~25–250 MB** | 10M–100M × ~250 B = **2.5–25 GB** |
| `oracle_prices` | At ~1 capture/min × 90d = 130k rows × ~150 B = **~20 MB** | Same shape — single source, 20 MB/quarter |
| `deposit_notifications` | 1 per deposit event (low) = **<10 MB** | 1M deposits × 200 B = **~200 MB** |

These are upper-bound estimates. NEON pricing (per
[neon.com/docs/introduction/cost-optimization](https://neon.com/docs/introduction/cost-optimization))
charges **$0.20/GB-month for storage** and
**$0.222/CU-hour for compute** (Scale plan).

**The real cost driver is the analytics queries** that scan these
tables (`getProviderCostRollup`, admin dashboards, `/v1/usage`
endpoints). Without time-based cleanup, these queries get slower and
more expensive each month.

### A.3 Index coverage audit

**Excellent:** `users`, `api_keys`, `deposits`, `credit_batches`,
`usage_records`, `audit_logs`, `webhook_subscriptions`,
`invoices`, `subscriptions`.

**Missing or weak:**

- `users.accountNumberHash` — indexed, but the partial index
  `idx_users_nonce_not_null` is **defined on `updatedAt`** (not
  `nonce`) with a `WHERE nonce != ''` filter. This is almost certainly
  a bug — the partial filter says "rows where nonce is set" but the
  index is on `updatedAt`. It should be on `nonce` if we ever want to
  look up by nonce, or dropped if we always use `address` /
  `accountNumberHash` for lookups. (See line 53 of schema.ts.)
- `credit_transfers.createdAt` — no index, but only ~thousands of rows
  expected. Low priority.
- `deposit_notifications.userId` — indexed, but the only "list all
  notifications for user" query joins via `depositId` not
  `userId`. The current `idx_deposit_notifications_user` may never be
  used. Check `EXPLAIN` before dropping.
- `settlements` — no `createdAt` column; the table is
  write-once-forever (settled_at timestamp) and indexed on
  `settled_at`-like columns via `txHash + networkId`. OK.

### A.4 Foreign-key cascade map

The cascade map is sane: every user-scoped table cascades on `users.id`
delete, which means **deleting a user via `auth.ts:285-295` cleans
up all their rows in 11 tables in one transaction**. The
`api_keys.id → set null` for `usage_records.api_keyId` is correct
(audit trail should survive API key revocation).

**Caveat:** The `auth.ts` delete transaction is **not retried** and is
**not bulk** — it deletes one user at a time via the API. There is no
"GDPR delete all stale users" job. See §D.

---

## B. Existing cleanup jobs

7 jobs, all using `setInterval` on the main process. Wired in
`server/src/index.ts:72-77`.

| Job | Cadence | What it cleans | Idempotent? | Tested? | Notes |
|---|---|---|---|---|---|
| `credit-expiry.ts` | 24h | `credit_batches.remainingCents` (zeros out, doesn't delete) | yes | `cron-jobs.test.ts:203` | Just fixed; zeros `remainingCents` on expired batches and extends active users' batches by 90d. **No row deletion.** |
| `nonce-cleanup.ts` | 15m | `users.nonce` (UPDATE not DELETE) | yes | `nonce-cleanup.test.ts` | Updates nonce to `''` if older than 10m. Trivial. |
| `deposit-retry.ts` | 1m | `deposits.status` (UPDATE pending→expired) | yes | `cron-jobs.test.ts:585` | Also calls `expireStaleDeposits` for >30m pending. Adds to Redis DLQ. |
| `deposit-recovery.ts` | 5m | `deposit_recoveries.status` (UPDATE pending→expired) | yes | `cron-jobs.test.ts:585` | Auto-expires pending recoveries after 1h. |
| `deposit-notifications.ts` | 1m | nothing (sends webhooks) | yes (no DB writes unless success) | `cron-jobs.test.ts:695` | Updates `webhook_subscriptions.lastNotificationAt` and inserts a `deposit_notifications` row per successful webhook. **Never deletes from `deposit_notifications` table.** |
| `subscription-cron.ts` | 1h | `subscriptions` (UPDATE status, INSERT new credit_batches) | yes | `cron-jobs.test.ts:203` | Renews/cancels active subs. |
| `ratio-sync-cron.ts` | 24h at 02:00 UTC | nothing (refreshes model ratios) | n/a | `ratio-sync.isolated.test.ts` | Not wired in `index.ts` — only runs if explicitly scheduled. |

**Coverage gap — there is NO retention / deletion job for:**

- `usage_records` ← biggest one, 1 row per chat call
- `audit_logs` ← 1 row per admin / auth event
- `oracle_prices` ← 1 row per price capture (potentially every minute)
- `deposit_notifications` ← 1 row per successful webhook
- `budget_alert_history` ← 1 row per alert fire
- `withdrawals`, `invoices`, `settlements` ← low growth, but still forever

---

## C. NEON-specific recommendations

### C.1 Auto-suspend is blocked by the 6 setInterval jobs

**Critical finding.** Every `setInterval` job in `server/src/index.ts`
runs on the main server process and keeps a Postgres connection open
(or at least, prevents the process from going idle). Per
[NEON scale-to-zero docs](https://neon.com/docs/introduction/scale-to-zero):

> Compute scales to zero after an inactive period of 5 minutes. …
> Logical replication from Neon keeps compute active while subscribers
> are connected.

The setInterval jobs don't open DB connections every tick (they open
one per job run), but they keep the **Node process itself awake and
busy** every few minutes. Even if no DB query is in flight, the
process counts as "active" and NEON will not scale to zero. This
forces **24/7 compute billing** even on a low-traffic site.

**The fix** is to either:

1. **Use `pg_cron` (NEON extension)** to run the SQL parts of these
   jobs inside Postgres itself — then the jobs are "internal" to
   Postgres and don't keep a connection from your app server. **This
   is the highest-leverage change.** NEON has historically not
   supported `pg_cron` directly, but it ships in the
   [Neon extension list as `pg_cron` v1.6+ on Postgres 16+](https://neon.com/docs/extensions/pg_cron).
   Verify it on the project's Postgres version before committing to
   this approach.
2. **Move all setInterval jobs to a separate worker process** (a
   second Render/Railway service, or a Cloudflare cron trigger, or
   a GitHub Action on a schedule). The API process is then eligible
   for scale-to-zero during quiet hours.
3. **Use `external cron` via the existing CI infra** — call
   `processExpiredCredits()` from a scheduled GitHub Action via an
   authenticated `/internal/cron/credit-expiry` endpoint. Simple,
   free, no extension required.

**Recommended:** option 3 (internal HTTP cron endpoints + GitHub
Actions) for the 1h/24h jobs, and option 2 only if the per-minute
jobs (`deposit-retry`, `deposit-notifications`) prove to be the
bottleneck. Option 1 (`pg_cron`) is the technically cleanest but
requires an extension migration.

### C.2 Connection pooling is misconfigured

`server/src/db/client.ts:30-33`:

```ts
const poolUrl = dbUrl.includes('neon.tech')
  ? `${dbUrl}${dbUrl.includes('?') ? '&' : '?'}pgbouncer=true&pool_timeout=30&connection_limit=${config.CONNECTION_POOL_SIZE}`
  : dbUrl;
const sql = neon(poolUrl);
_db = drizzle(sql, { schema });
```

The code uses `drizzle-orm/neon-http` (the HTTP transport). The
`pgbouncer=true` query param is **only meaningful for the TCP driver**
(`drizzle-orm/neon-serverless` with `Pool`). On the HTTP transport,
every query is a fresh `fetch` request — pooling doesn't apply.

**Two real options:**

1. **Stick with HTTP** (current): keep `drizzle-orm/neon-http`. Delete
   the misleading `pgbouncer=true` query param. Trade-off: each
   request is a `fetch` to Neon's SQL gateway (low latency, but no
   transaction batching across queries in a single request — must use
   `db.transaction()` for multi-statement ACID).
2. **Switch to TCP + WebSocket pooling**: use
   `drizzle-orm/neon-serverless` with a `Pool` client pointing at the
   `-pooler` hostname. Get true PgBouncer pooling (up to 10k
   connections per the
   [Neon connection pooling docs](https://neon.com/docs/connect/connection-pooling)).
   Trade-off: one persistent WebSocket per process, must close it on
   shutdown.

**For OMA-AI** (single Hono.js process on Render, lots of cron jobs
already running): **switch to TCP + pooling**. The HTTP transport is
optimized for serverless (Vercel/Cloudflare) — for a long-lived
Render container, TCP + `Pool` is faster and lets `db.transaction()`
work without the "no transactions in HTTP driver" warning. **See
[Neon's official drizzle guide](https://github.com/neondatabase-labs/ai-rules/blob/main/neon-drizzle.mdc)
which recommends HTTP for serverless/edge and TCP for long-lived
servers.**

Migration: ~20 lines, one `import` swap, one `Pool` instantiation, no
schema changes. The `pgbouncer=true` query param becomes
necessary-and-correct on TCP.

### C.3 Branching strategy for dev / staging / preview

NEON branching is **essentially free** for branches under 1 GB because
of copy-on-write (per
[neon.com/docs/manage/branches](https://neon.com/docs/manage/branches)
and the
[fast dev workflows page](https://neon.com/use-cases/fast-dev-workflows)).
The current codebase has no branching — every dev / CI environment
shares the same database URL.

**Recommended pattern (1 hour setup):**

- **main branch** (production): the real DB. `DATABASE_URL` env var
  in Render points here.
- **`dev` branch**: forked from main, reset weekly. Devs use
  `DEV_DATABASE_URL` locally.
- **Preview branches** per PR: created by a GitHub Action on PR open
  using the `neondatabase/api` or `neonctl`. Action sets
  `DATABASE_URL` in the Vercel preview env, drops the branch on PR
  close. Set a 7-day TTL via
  [branch expiration](https://neon.com/docs/guides/branch-expiration).
- **`staging` branch**: forked from main, refreshed on every release
  tag. Set TTL=14d, reset on deploy.

**Cost impact:** Almost zero. Each branch is free until it exceeds
the plan's branch allowance (Launch = 10 free, Scale = 25 free;
extra branches cost $1.50/month).

### C.4 History window (PITR)

Per the
[NEON cost-optimization page](https://neon.com/docs/introduction/cost-optimization#instant-restore-storage):

> Instant restore storage is billed at $0.20/GB-month on paid plans,
> separate from your data storage. … Adjust your history window. …
> For write-heavy root branches, a shorter history window can
> significantly reduce costs.

**Recommendation:** Default is 1 day on paid plans, max 7 on Launch.
The current settings (inherited from defaults) are likely 1 day.
**If you don't actively use instant restore in production, drop to
the minimum (6 hours on Free, 1 day on Launch/Scale).** This is
effectively free savings.

### C.5 VACUUM FULL reclaim

Per the same page:

> VACUUM doesn't reduce your storage size. Instead, it marks the
> deleted space in the table for reuse. … Use VACUUM FULL to reclaim
> space. … VACUUM FULL locks your table.

**For the `usage_records` and `audit_logs` tables** (high write,
predictable delete pattern), the right pattern is:

1. DELETE old rows in small batches (10k at a time, see §D).
2. Run plain `VACUUM` after each batch (concurrent, no lock).
3. **Skip VACUUM FULL** unless the table is genuinely bloated. On
   NEON with autoscaling, autovacuum does most of the work. **NEON
   docs explicitly warn** that with scale-to-zero, autovacuum
   statistics get lost on suspend, so you may need to manually
   `VACUUM (ANALYZE)` on resume.

---

## D. Retention policy recommendations

The four high-growth tables, plus three secondary ones, in priority
order. Implementation effort is "small" for all of these (one new file
in `jobs/` + one new route registration).

### D.1 `usage_records` — **CRITICAL**

**Current state:** Unlimited growth. Every chat completion writes a
row. After 90 days at 10k req/day → ~900k rows = ~360 MB. After a
year at 100k req/day → 36M rows = ~14 GB and `getProviderCostRollup`
takes seconds.

**Recommended retention:**

- **Hot tier (0–90 days):** keep in main `usage_records` table for
  user dashboards and billing. (Already indexed via
  `idx_usage_user_created` and `idx_usage_records_analytics`.)
- **Cold tier (90+ days):** either DELETE, or move to an archive
  schema. For an AI gateway, **90 days is enough** for the
  use cases (provider analytics, refund windows, chargeback defense).
  The Stripe / Coinbase chargeback window is 120 days; align to 90
  days for safety margin.
- **Action:** new cron `usage-records-prune.ts`, runs daily at 03:00
  UTC, deletes in batches of 10,000, logs counts.

**Implementation:**

```ts
// server/src/jobs/usage-records-prune.ts
import { db } from "../db/client.js";
import { usageRecords } from "../db/schema.js";
import { sql, lt } from "drizzle-orm";

const RETENTION_DAYS = 90;
const BATCH_SIZE = 10_000;

export async function pruneOldUsageRecords(): Promise<number> {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 86_400_000);
  let totalDeleted = 0;
  while (true) {
    const result = await db.execute(sql`
      DELETE FROM usage_records
      WHERE id IN (
        SELECT id FROM usage_records
        WHERE created_at < ${cutoff.toISOString()}
        LIMIT ${BATCH_SIZE}
      )
    `);
    const deleted = result.rowCount ?? 0;
    totalDeleted += deleted;
    if (deleted < BATCH_SIZE) break;
    await new Promise(r => setTimeout(r, 100)); // breathing room
  }
  return totalDeleted;
}
```

Effort: small (~1 hour). **Impact:** caps the table at ~36 MB / 90d
instead of 14 GB / year.

### D.2 `audit_logs` — **CRITICAL**

**Current state:** 1 row per audited event. After a year of normal
traffic, easily 1–10M rows = 250 MB – 2.5 GB. The table has 8
indexes — **all of them get slower linearly as the table grows**.

**Recommended retention:** 365 days. SOX / SOC 2 typical retention
is 7 years, but for a startup AI gateway, 1 year is sufficient for
debugging and most compliance regimes. If you need longer, archive to
S3 (cold storage) rather than keeping hot in Postgres.

**Why not 7 years:** Postgres is the wrong tool. NEON charges
$0.20/GB-month. 7 years × 2.5 GB = 210 GB-month. That's $42/month
forever just for audit. S3 Glacier is $0.004/GB-month — 100× cheaper
and designed for "write once, read rarely" compliance.

**Action:** new cron `audit-logs-prune.ts`, runs daily. Same batched
delete pattern as D.1.

**Bonus optimization:** many `audit_logs` writes are for `USER_LOGIN`
or `ACCOUNT_LOGIN_RATE_LIMITED` — low-value rows. Consider dropping
those to a `audit_logs_low_value` table, or stopping the writes
entirely for routine events. (Check `routes/auth.ts` and
`middleware/rate-limit.ts` for write sites.)

### D.3 `oracle_prices` — high growth, low value

**Current state:** `oracle_prices` is captured on every price check
(via `credits/oracle.ts`). It is **not actually consulted** by any
retention job. The only index is `idx_oracle_captured`. After a year
of 1 capture/min = 525k rows = 80 MB.

**Recommended retention:** 7 days. Prices are short-lived. Anyone who
needs historical price data should pull it from CoinGecko's free
historical API, not from a copy in our DB.

**Action:** new cron `oracle-prices-prune.ts`, runs every 6h.
**Smarter alternative:** change the oracle code to use a
`UPSERT ... ON CONFLICT (source) DO UPDATE` so it only keeps the
**latest** price per source. The whole "history" of prices is never
read. This converts the table to a 1-row-per-source lookup.

### D.4 `deposit_notifications` — unbounded, low read value

**Current state:** A row is inserted per successful webhook
delivery. The table is only consulted in admin views and the
deposit-notifications retry path. After a year of ~100 deposits/day
= 36k rows = 7 MB. **Low absolute size**, but the pattern is
unbounded and the index is wasted.

**Recommended retention:** 90 days (matches `usage_records`).

**Action:** new cron `deposit-notifications-prune.ts`.

### D.5 `budget_alert_history` — **MEDIUM**

**Current state:** 1 row per alert fire. At 1k users × 4 thresholds
× 12 months = 48k rows = 12 MB. Modest growth, but a perfect
candidate for soft delete: the alert has already fired and the user
has already been notified.

**Recommended retention:** 180 days.

**Action:** same batched delete cron.

### D.6 `invoices` and `withdrawals` — LOW

**Current state:** Bounded by user count, low growth. Tax / accounting
retention typically requires 7 years.

**Recommended retention:** **keep forever** (these are your financial
records). The growth is bounded by user count, not request count.

### D.7 `credit_batches` — already handled

`credit-expiry.ts` zeros out `remainingCents` on expired batches but
**does not delete the rows**. After 1 year, a user with 50 deposits
has 50 expired zero-balance rows.

**Recommended:** add a deletion step that drops `credit_batches` rows
where `remainingCents = 0 AND expiresAt < now() - 180 days`. This is
a pure cleanup, no business risk.

### D.8 Soft delete vs hard delete

Per the
[Sequin retention guide](https://blog.sequinstream.com/time-based-retention-strategies-in-postgres/)
and the soft-vs-hard-delete literature:

- **Hard delete is correct for `usage_records`, `oracle_prices`,
  `deposit_notifications`, and `budget_alert_history`.** These are
  append-only telemetry; soft delete would just shift the bloat
  problem.
- **Soft delete is correct for `users`, `api_keys`,
  `webhook_subscriptions`** — already implemented via the `cascade`
  FK + the `auth.ts` delete endpoint. The existing pattern is
  correct.
- **`audit_logs` is the only soft-delete candidate** if you need
  "who deleted this user" audit trail. But the audit row still
  needs to be deleted eventually (you cannot keep audit forever
  cheaply), so the right pattern is: keep `audit_logs` for 365 days
  hot, archive to S3 for 7 years.

### D.9 Partitioning (declarative)

For the four high-growth tables, **Postgres declarative partitioning
by month** would be the ideal long-term solution. The
[Sequin guide](https://blog.sequinstream.com/time-based-retention-strategies-in-postgres/)
shows how `pg_partman` (extension) or a custom cron can
`DROP TABLE month_2024_01;` to delete millions of rows in
milliseconds.

**For OMA-AI today, the cron-based delete is sufficient.** Each
month's worth of `usage_records` is <500 MB; deleting it in
batches of 10k is fast. Partitioning becomes worth the complexity
when:

- A single `usage_records` partition would exceed 10 GB
- DELETE queries are causing autovacuum lag
- You start seeing query plans switch to sequential scans

**Recommended:** ship the cron-based deletes (D.1–D.5) now. Defer
partitioning to "this quarter" if growth justifies it.

### D.10 NEON-specific retention note: `TRUNCATE` vs `DELETE`

Per
[NEON cost-optimization](https://neon.com/docs/introduction/cost-optimization):

> For mass deletions, `TRUNCATE TABLE` is more storage-efficient since
> it logs a single operation rather than a record for each deleted row.

**However, `TRUNCATE` is all-or-nothing** — you can't `TRUNCATE
WHERE createdAt < 90d`. For retention, `DELETE` in batches is the only
option. The batched DELETE is fine — it just generates more WAL
records, which "temporarily increase your storage size until they age
out of your history window". On a 1-day history window, this is
negligible.

---

## E. Index recommendations

The schema is already well-indexed. The only structural issues:

### E.1 Bug: `idx_users_nonce_not_null` is on wrong column

`schema.ts:53`:

```ts
index("idx_users_nonce_not_null").on(t.updatedAt).where(sql`${t.nonce} != ''`),
```

This index has `WHERE nonce != ''` (rows where nonce is set) but is
defined on `updatedAt`. It will never be useful for the partial
predicate "rows with a nonce". Either:

- Change to `index(...).on(t.nonce).where(sql\`${t.nonce} != ''\`)`
  (for nonce lookup), or
- Drop it (no code currently looks up by nonce — `siwe.ts` reads
  `users.address` first, then checks `nonce`).

Effort: trivial. Impact: low. **Cleanup, not optimization.**

### E.2 Missing index: `credit_batches.depositId`

`credit_batches` has `depositId: uuid('deposit_id').references(...,
{ onDelete: 'set null' })` but no index on `depositId`. The
`depositsRelations` suggests we don't currently look up batches by
deposit, but it's a likely query ("show me the credit batch for
deposit X"). **Add it.**

### E.3 Partial index coverage is good

`idx_credit_batches_remaining_positive WHERE remainingCents > 0` and
`idx_credit_batches_expiring` are both partial indexes. These are
correct — credit-balance queries only care about non-zero batches.
**Do not add full-table indexes for these.**

### E.4 Composite index: `deposits(status, createdAt)`

`schema.ts` has `idx_deposits_status` and `idx_deposits_created_at`
separately. The `deposit-retry.ts` job does
`WHERE status = 'pending'` and `deposit-notifications.ts` does
`WHERE status = 'pending'`. A composite `(status, createdAt)` would
be slightly more efficient for "find all pending deposits, oldest
first" queries. **Optional** — the existing single-column indexes are
fine for current cardinality.

### E.5 Index for analytics on `usage_records`

`idx_usage_records_analytics` is on `(createdAt, model, provider,
costCents)`. This is correct for "all usage for a date range" but
doesn't help for "all usage for a specific provider in a date range"
(the `getProviderCostRollup` query). The current
`idx_usage_records_provider` plus `idx_usage_created` can be
combined via a BitmapAnd in the planner, which is fine. **No
action needed.**

### E.6 `EXPLAIN` audit

Before any index change in production, run
`EXPLAIN ANALYZE` on the top 5 slowest queries in
`pg_stat_statements`. The
[NEON slow query list MCP](https://neon.com/docs) (or
`pg_stat_statements` directly) is the source of truth for which
indexes are actually used.

---

## F. Drizzle ORM patterns

### F.1 The HTTP-vs-TCP decision (recap from §C.2)

Current code: `drizzle-orm/neon-http` (HTTP transport).

**Trade-off table:**

| Aspect | HTTP (current) | TCP + Pool |
|---|---|---|
| Latency per query | 1 fetch ≈ 1 round trip (good) | 1 SQL round trip (also good) |
| `db.transaction()` | Supported (Neon HTTP transactions) | Supported natively |
| `LISTEN/NOTIFY` | Not supported | Supported |
| Connection pooling | None (every query is fresh) | True PgBouncer pooling up to 10k conns |
| Long-lived server fit | Designed for serverless | Designed for Render/Railway/VPS |
| Idle cost | None (no persistent conn) | Some (TCP keepalives) |

**For OMA-AI on Render with `setInterval` cron jobs:**
**switch to TCP + Pool**. The HTTP transport's main benefit
(connection-per-request) is wasted on a long-lived server.

### F.2 Batch operations

Drizzle supports `db.insert(table).values([row1, row2, ...])` for
bulk inserts. The `usage-service.ts` already does this on
single-row writes via `.onConflictDoNothing()`. **For analytics
rollups that read from `usage_records`, the
[batch API](https://orm.drizzle.team/docs/batch-api) lets you combine
multiple statements into one round trip** — useful for the
`getProviderCostRollup` query which does a SUM over a date range.

**No rewrite needed for the current code.** The existing single-row
inserts are correct for the API path. Batch API is only useful when
you're doing 5+ sequential reads to compute one response.

### F.3 Prepared statements

`db.select().from(x).where(...).prepare('name')` lets you cache the
prepared statement in Postgres. For high-frequency queries
(`getProviderCostRollup` called per admin dashboard request,
`/v1/credits/usage` per dashboard load), this saves the parse + plan
cost on every call.

The
[Drizzle perf guide](https://orm.drizzle.team/docs/perf-queries) shows
the pattern. **Not a critical optimization, but easy.**

### F.4 Index hints

Drizzle does not support PG-style `/*+ IndexScan(x idx) */` hints.
The planner chooses, and you influence it via index existence and
query shape. **The schema is already index-hint-equivalent** — the
right indexes are there. No action.

### F.5 Raw SQL for batched deletes

The retention crons in §D use `db.execute(sql\`...\`)` rather than
the query builder. This is the right pattern: batched DELETE with
LIMIT and OFFSET-style iteration is awkward in the query builder but
trivial in raw SQL. The Drizzle docs explicitly support this
pattern.

### F.6 `db.transaction()` usage audit

Grep for `db.transaction` shows it's used in:
`auth.ts:285` (user delete), `inference/usage-service.ts:18` is
single-statement (no transaction), `middleware/audit.ts:22` is
single-statement.

**Issue:** the `usage-service.recordUsage` insert is **not
transactional with the credit deduction**. If the credit deduction
succeeds but the usage insert fails (or vice versa), the user's
balance is wrong. This is a **pre-existing correctness issue**, not
a retention issue, but worth flagging.

---

## G. Implementation plan

### G.1 Quick wins (this week, < 1 day each)

| # | Change | Effort | Impact |
|---|---|---|---|
| 1 | Fix `idx_users_nonce_not_null` index (drop or fix) | 5 min | cleanup |
| 2 | Add `idx_credit_batches_deposit_id` | 5 min | enables future queries |
| 3 | Set NEON PITR history window to 1 day (or minimum allowed) | 5 min in console | 5-15% storage savings if currently 7d |
| 4 | Move `setInterval` jobs to a separate worker process OR add internal `/internal/cron/*` endpoints triggered by GitHub Actions | 4-6 hours | **unlocks NEON scale-to-zero → 30-50% compute savings** |
| 5 | Add `usage_records` retention cron (90 days, batched DELETE) | 1 hour | caps table at ~36 MB / 90d |
| 6 | Add `audit_logs` retention cron (365 days, batched DELETE) | 1 hour | caps table at ~250 MB / 365d |
| 7 | Add `oracle_prices` retention cron (7 days) OR change oracle to UPSERT (latest price only) | 30 min | caps table at <5 MB |
| 8 | Add `deposit_notifications` retention cron (90 days) | 30 min | caps table at <10 MB |
| 9 | Add `credit_batches` post-expiry cleanup (drop zero-balance rows >180d old) | 30 min | recovers ~5 MB / year per active user |
| 10 | Add `budget_alert_history` retention cron (180 days) | 30 min | caps table at <15 MB |

**Total quick-wins effort: 1-2 days.**
**Total quick-wins storage impact: cap the database at ~500 MB instead of unbounded 5-50 GB / year.**

### G.2 Medium wins (this month, 1-3 days each)

| # | Change | Effort | Impact |
|---|---|---|---|
| M1 | Switch from `drizzle-orm/neon-http` to `drizzle-orm/neon-serverless` with `Pool` (TCP + WebSocket) | 1 day | faster queries, true pooling, no double-pool confusion |
| M2 | Set up NEON branching: `dev` branch + GitHub Action that creates a preview branch per PR with TTL=7d | 1-2 days | preview envs without touching prod |
| M3 | Add prepared statements for the top 5 hot-path queries (`/v1/credits/usage`, `getProviderCostRollup`, `getUserRecoveries`) | 1 day | 10-30% query latency reduction on dashboard endpoints |
| M4 | Wrap `usage-service.recordUsage` + credit deduction in a single transaction | 1 day | correctness fix for the credit ledger |
| M5 | Add autovacuum tuning for `usage_records` and `audit_logs` (lower `autovacuum_vacuum_scale_factor` to 0.01 instead of default 0.2) | 1 hour | keeps the high-churn tables from bloating during peak hours |

### G.3 Strategic projects (this quarter)

| # | Change | Effort | Impact |
|---|---|---|---|
| S1 | Move audit logs to S3 Glacier after 90 days (Postgres → S3 writer cron) | 1 week | audit retention for 7 years at $0.004/GB-month instead of $0.20/GB-month |
| S2 | Convert `usage_records` to a partitioned table (monthly partitions) once growth justifies it | 2-3 weeks | sub-second retention deletes at any scale |
| S3 | Add a `pg_cron` extension to the NEON project and migrate all retention jobs to SQL functions inside the DB | 1 week | removes the Node.js cron dependency entirely; NEON's pg_cron runs even when the API is suspended |
| S4 | Add connection-level observability (Neon's consumption API + a Grafana dashboard for CU-hours, storage, history, transfer) | 3-5 days | visibility into what's actually being billed |
| S5 | Add read replicas for analytics queries (`getProviderCostRollup`, admin dashboards) — billed separately but isolate load | 1 week | analytics queries don't impact API latency |

---

## H. Cost savings estimate

OMA-AI is small (single Hono.js process, Render or similar). Order-of-magnitude estimates.

### H.1 Before (estimated)

Assumptions:
- Production workload: 1k users, 10 req/day, 90% reads
- Database: 500 MB after 6 months, growing linearly
- Compute: 1 CU running 24/7 (because setInterval prevents auto-suspend)
- NEON Scale plan: $0.222/CU-hour × 730 hours = **$162/month compute**
- Storage: 0.5 GB × $0.20 = **$0.10/month storage**
- History (PITR, 1 day default): included up to allowance
- **Total: ~$162/month**

### H.2 After quick wins (§G.1) + medium wins M1, M5

- Compute: 1 CU running 50% of the time (auto-suspend works)
  - = $162 × 0.5 = **$81/month compute**
- Storage: capped at 500 MB forever (retention crons)
  - = $0.10/month storage
- History: dropped to 1 day minimum
  - = $0 (within allowance)
- **Total: ~$81/month — **savings: ~$81/month, 50% reduction****

### H.3 After full implementation (G.1 + G.2 + G.3 partial)

- Compute: 1 CU running 30% of the time (auto-suspend + better queries)
  - = $49/month compute
- Storage: 200 MB (most data in S3 archive)
  - = $0.04/month storage
- S3 archive: $0.05/month for 7-year audit retention
- **Total: ~$49/month — **savings: ~$113/month, 70% reduction****

### H.4 Payback period

All quick wins (G.1) are < 2 days of engineering time. At Tyson's
loaded rate (~$150/hour), 2 days = $2,400. **The $81/month savings
pay back the engineering in 30 days.** The medium and strategic wins
pay back within 1-2 quarters.

The current Neon bill for OMA-AI is presumably small (probably
$0-50/month — the dev workload doesn't generate 1k req/day), so the
absolute savings are modest. The **real value** is:

1. **Correctness** — preventing the credit-ledger bug (M4) is worth
   more than any cost saving.
2. **Scalability** — the schema as-is would buckle at 100k req/day
   on a single CU. The retention + pooling changes unlock 10× scale
   at 1× the cost.
3. **Operational maturity** — having a PITR history window, branching
   strategy, and retention policy in writing makes the next hire's
   first week easier.

---

## I. References

- [NEON scale-to-zero](https://neon.com/docs/introduction/scale-to-zero) — primary source for §C.1
- [NEON cost optimization](https://neon.com/docs/introduction/cost-optimization) — primary source for §C.4, §C.5, §D.10
- [NEON choosing a connection method](https://neon.com/docs/connect/choose-connection) — primary source for §C.2
- [NEON-Drizzle integration guide](https://github.com/neondatabase-labs/ai-rules/blob/main/neon-drizzle.mdc) — official patterns for §C.2, §F
- [Drizzle batch API](https://orm.drizzle.team/docs/batch-api) — §F.2
- [Drizzle query performance](https://orm.drizzle.team/docs/perf-queries) — §F.3
- [Sequin time-based retention in Postgres](https://blog.sequinstream.com/time-based-retention-strategies-in-postgres/) — primary source for §D.8, §D.9
- [pg_partman docs](https://github.com/pgpartman/pg_partman) — referenced for §D.9
- [pganalyze vacuum tuning](https://pganalyze.com/blog/introducing-vacuum-advisor-postgres) — referenced for §C.5
- [NEON branching for fast dev workflows](https://neon.com/use-cases/fast-dev-workflows) — §C.3
- [Database Branching in 2026: How Neon, Supabase, Xata, and Turso Killed the Staging Environment](https://www.birjob.com/blog/database-branching-2026) — context for §C.3
- [Soft delete vs hard delete in PostgreSQL](https://oneuptime.com/blog/post/2026-01-21-postgresql-soft-deletes/view) — context for §D.8

---

*Last updated: 2026-06-16 — research only, no code changes. Run
`npm run typecheck && npm run lint && npm test` from `app/server` after
implementing any of the §G changes.*
