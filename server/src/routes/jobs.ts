import { Hono } from "hono";
import { timingSafeEqual } from "node:crypto";
import { config } from "../config.js";
import {
  processPendingDeposits,
  retryFailedWebhooks,
} from "../jobs/deposit-notifications.js";
import { processPendingRecoveries } from "../jobs/deposit-recovery.js";
import { logger } from "../lib/logger.js";
import { rateLimit } from "../middleware/rate-limit.js";
import type { OmaEnv } from "../types.js";

/**
 * Internal job triggers — the external-cron half of the "no in-process
 * schedulers" design (NEON scale-to-zero: the DB only wakes when a trigger
 * arrives). Called by .github/workflows/jobs.yml on a cron schedule.
 *
 * Auth: X-Jobs-Token header must match config.JOBS_TOKEN (>=32 chars,
 * timing-safe compare). When JOBS_TOKEN is unset the endpoints return 503 —
 * fail closed, never open.
 */

const JOB_RUNNERS: Record<string, () => Promise<void>> = {
  // Wrong-network deposit recovery: advance/expire recoveries in the queue.
  // (Per-user scanning happens on-demand via the deposit status routes —
  // scanForWrongNetworkDeposits takes a user address.)
  "deposit-recovery": async () => {
    await processPendingRecoveries();
  },
  // Deposit webhooks: notify subscribers of pending deposits, retry failures.
  "deposit-notifications": async () => {
    await processPendingDeposits();
    await retryFailedWebhooks();
  },
};

function tokenMatches(presented: string, expected: string): boolean {
  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export const jobsRoutes = new Hono<OmaEnv>();

jobsRoutes.post(
  "/internal/jobs/:name",
  rateLimit({ windowMs: 60_000, maxRequests: 30 }),
  async (c) => {
    if (!config.JOBS_TOKEN) {
      return c.json(
        { error: { message: "Job triggers disabled: JOBS_TOKEN unset", type: "feature_disabled" } },
        503,
      );
    }
    const presented = c.req.header("X-Jobs-Token") ?? "";
    if (!presented || !tokenMatches(presented, config.JOBS_TOKEN)) {
      return c.json(
        { error: { message: "Unauthorized", type: "authentication_error" } },
        401,
      );
    }

    const name = c.req.param("name") ?? "";
    const runner = JOB_RUNNERS[name];
    if (!runner) {
      return c.json(
        {
          error: {
            message: `Unknown job '${name}'. Available: ${Object.keys(JOB_RUNNERS).join(", ")}`,
            type: "invalid_request_error",
          },
        },
        404,
      );
    }

    const startedAt = Date.now();
    try {
      await runner();
      const durationMs = Date.now() - startedAt;
      logger.info({ job: name, durationMs }, "[jobs] run complete");
      return c.json({ ok: true, job: name, durationMs });
    } catch (err) {
      logger.error({ err, job: name }, "[jobs] run failed");
      return c.json(
        { error: { message: `Job '${name}' failed`, type: "internal_error" } },
        500,
      );
    }
  },
);
