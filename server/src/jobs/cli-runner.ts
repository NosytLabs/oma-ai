/**
 * CLI runner for cron jobs.
 *
 * Invoked by GitHub Actions workflows (.github/workflows/*.yml) to run a
 * single job once and exit. Lets us externalize the setInterval jobs from
 * the long-lived server process so NEON can scale to zero during idle
 * periods (the #1 cost optimization — these timers were keeping the Node
 * process active and blocking PG auto-suspend).
 *
 * Usage:
 *   npx tsx src/jobs/cli-runner.ts <job-name>
 *
 * The runner maps a job name to a work function, runs it, logs the result
 * to stdout/stderr, and exits with 0 on success / 1 on error. Workflows
 * rely on the exit code for failure detection.
 *
 * Job names (see JOBS map below):
 *   credit-expiry            — processExpiredCredits()
 *   subscription-check       — processExpiredSubscriptions()
 *   nonce-cleanup            — processExpiredNonces()
 *   deposit-retry            — retryFailedDeposits() + expireStaleDeposits()
 *   wrong-network-recovery   — processPendingRecoveries()
 *   deposit-notifications    — processPendingDeposits() + retryFailedWebhooks()
 *   retention                — runRetention() — 4-table bounded retention
 */

import { processExpiredCredits } from "./credit-expiry.js";
import { processExpiredSubscriptions } from "./subscription-cron.js";
import { processExpiredNonces } from "./nonce-cleanup.js";
import {
  retryFailedDeposits,
  expireStaleDeposits,
} from "./deposit-retry.js";
import { processPendingRecoveries } from "./deposit-recovery.js";
import {
  processPendingDeposits,
  retryFailedWebhooks,
} from "./deposit-notifications.js";
import { runRetention } from "./retention.js";
import { logger } from "../lib/logger.js";

type JobResult = Record<string, unknown>;

const JOBS: Record<string, () => Promise<JobResult>> = {
  "credit-expiry": async () => {
    const r = await processExpiredCredits();
    return { ...r };
  },
  "subscription-check": async () => {
    const r = await processExpiredSubscriptions();
    return { ...r };
  },
  "nonce-cleanup": async () => {
    await processExpiredNonces();
    return { cleared: true };
  },
  "deposit-retry": async () => {
    const retries = await retryFailedDeposits();
    const expired = await expireStaleDeposits();
    return {
      retriedCount: retries.length,
      succeededCount: retries.filter((r) => r.success).length,
      failedCount: retries.filter((r) => !r.success).length,
      expiredCount: expired,
    };
  },
  "wrong-network-recovery": async () => {
    await processPendingRecoveries();
    return { processed: true };
  },
  "deposit-notifications": async () => {
    await processPendingDeposits();
    await retryFailedWebhooks();
    return { processed: true };
  },
  retention: async () => {
    const r = await runRetention();
    return { ...r };
  },
};

async function main(): Promise<number> {
  const jobName = process.argv[2];

  if (!jobName) {
    process.stderr.write(
      `Usage: tsx src/jobs/cli-runner.ts <job-name>\n` +
        `Available jobs: ${Object.keys(JOBS).join(", ")}\n`,
    );
    return 1;
  }

  const job = JOBS[jobName];
  if (!job) {
    process.stderr.write(
      `Unknown job: ${jobName}\n` +
        `Available jobs: ${Object.keys(JOBS).join(", ")}\n`,
    );
    return 1;
  }

  const startedAt = Date.now();
  logger.info({ job: jobName }, "[cli-runner] starting job");

  try {
    const result = await job();
    const durationMs = Date.now() - startedAt;
    logger.info(
      { job: jobName, durationMs, result },
      "[cli-runner] job completed",
    );
    process.stdout.write(
      JSON.stringify({ job: jobName, status: "ok", durationMs, result }) + "\n",
    );
    return 0;
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    const message = err instanceof Error ? err.message : String(err);
    logger.error(
      { job: jobName, durationMs, error: message },
      "[cli-runner] job failed",
    );
    process.stderr.write(
      JSON.stringify({ job: jobName, status: "error", durationMs, error: message }) + "\n",
    );
    return 1;
  }
}

main().then(
  (code) => process.exit(code),
  (err) => {
    process.stderr.write(
      `[cli-runner] fatal: ${err instanceof Error ? err.message : String(err)}\n`,
    );
    process.exit(1);
  },
);
