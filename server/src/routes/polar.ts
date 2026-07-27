/**
 * Polar.sh payment integration — STUB.
 *
 * TODO(full-rewrite): The original scaffold in this file used the Kysely-style
 * builder API on `db` (server actually uses Drizzle ORM), imported tables that
 * don't exist in `db/schema.ts` (customers, orders, license_keys, webhook_events
 * exist only via the SQL migration 0035 — Drizzle doesn't know about them), and
 * referenced `c.var.user` (OmaEnv defines `userId` + `apiKey`, not `user`).
 *
 * A proper rewrite should:
 * 1. Add Drizzle `pgTable` definitions for the 5 Polar tables in
 *    `db/schema.ts` so queries can use the ORM.
 * 2. Use `@polar-sh/sdk/webhooks` `validateEvent` + Standard Webhooks headers
 *    (`webhook-id`, `webhook-timestamp`, `webhook-signature`) — NOT the legacy
 *    `polar.webhooks.validateEvent()`.
 * 3. Use `requireAuth` middleware so `c.var.userId` is populated; query Polar
 *    customer linkage by user id.
 * 4. Issue credits / update internal `subscriptions` table on
 *    `subscription.created` and `order.paid` webhooks (idempotent on
 *    `webhook-id`).
 * 5. Mount `/v1/polar/plans`, `/v1/polar/checkout`, `/v1/polar/subscription`
 *    + dual webhook path (`/webhooks/polar` + `/api/webhook/polar`).
 *
 * Until that rewrite lands this module mounts no routes. The route is kept
 * in `index.ts` so the URL surface stays stable (a no-op Hono app returns
 * 404 on every path, which is fine — we deliberately avoid the previous
 * shape because it threw at import time and blocked `tsc --noEmit`).
 */
import { Hono } from "hono";
import type { OmaEnv } from "../types.js";

export const polarRoutes = new Hono<OmaEnv>();

// All endpoints intentionally unimplemented — see file-level TODO above.