-- Metering columns for observability + failover analysis.
--
-- 1. latency_ms already exists on the table but was never written by any
--    code path, so every latency query returned NULL. No DDL needed — the
--    writer fix lands in server/src/inference/{streaming,billing}.ts.
--
-- 2. requested_model / routed_via / attempt_count make failover VISIBLE.
--    `model` holds the model that actually served the request after routing,
--    so without these the admin cannot answer "how often does model X fail
--    over?" — GROUP BY requested_model, model yields the failover rate.
--
-- 3. uq_usage_request_id already enforces uniqueness of request_id, which is
--    what recordUsage() now relies on for ON CONFLICT DO NOTHING idempotency.
--    The explicit index is re-created IF NOT EXISTS as a guard in case an
--    older environment predates it.
ALTER TABLE "usage_records" ADD COLUMN IF NOT EXISTS "requested_model" text;
--> statement-breakpoint
ALTER TABLE "usage_records" ADD COLUMN IF NOT EXISTS "routed_via" text;
--> statement-breakpoint
ALTER TABLE "usage_records" ADD COLUMN IF NOT EXISTS "attempt_count" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_usage_records_requested_model" ON "usage_records" ("created_at", "requested_model");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_usage_request_id" ON "usage_records" ("request_id");
--> statement-breakpoint
-- Audit action for a duplicate recordUsage() call. A duplicate requestId was
-- NOT charged, so it must be distinguishable from CREDIT_DEDUCTED when
-- reconciling the ledger against the audit trail.
ALTER TYPE "public"."audit_action" ADD VALUE IF NOT EXISTS 'USAGE_RECORD_DUPLICATE' BEFORE 'SITE_SETTINGS_UPDATED';