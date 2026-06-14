/**
 * M10.3 — Daily model price ratio sync.
 *
 * Schedules `runFullSync()` to run at 02:00 UTC every day. We use `setTimeout`
 * + `setInterval` (matching the pattern in `credit-expiry.ts` and
 * `subscription-cron.ts`) instead of pulling in `node-cron` as a new dep —
 * the platform does not currently use `node-cron` anywhere.
 *
 * On startup, the first run is delayed to the next 02:00 UTC tick (unless
 * `RATIO_SYNC_RUN_IMMEDIATELY=true` is set, useful for tests). After that the
 * job fires every 24 hours.
 */

import { logger } from '../lib/logger.js';
import { runFullSync } from '../inference/ratio-sync.js';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

let intervalHandle: ReturnType<typeof setInterval> | null = null;
let startupTimeoutHandle: ReturnType<typeof setTimeout> | null = null;

function msUntilNext0200Utc(): number {
  const now = new Date();
  const next = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    2, 0, 0, 0,
  ));
  if (next.getTime() <= now.getTime()) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  return next.getTime() - now.getTime();
}

export function scheduleRatioSync(): { intervalHandle: ReturnType<typeof setInterval> | null; startupTimeoutHandle: ReturnType<typeof setTimeout> | null } {
  const run = async () => {
    try {
      const result = await runFullSync();
      logger.info(
        { totalUpdated: result.totalUpdated, totalErrors: result.totalErrors, type: 'ratio_sync_cron' },
        '[ratio-sync-cron] daily sync finished',
      );
    } catch (err) {
      logger.error(`[ratio-sync-cron] failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // Tests / dev: allow an immediate first run.
  if (process.env.RATIO_SYNC_RUN_IMMEDIATELY === 'true') {
    run();
  } else {
    const delay = msUntilNext0200Utc();
    logger.info({ delayMs: delay }, '[ratio-sync-cron] scheduled first run');
    startupTimeoutHandle = setTimeout(() => {
      run();
      intervalHandle = setInterval(run, ONE_DAY_MS);
    }, delay);
  }
  return { intervalHandle, startupTimeoutHandle };
}

export function stopRatioSync(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
  if (startupTimeoutHandle) {
    clearTimeout(startupTimeoutHandle);
    startupTimeoutHandle = null;
  }
}
