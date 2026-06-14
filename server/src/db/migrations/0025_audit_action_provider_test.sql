-- Migration 0025: Add PROVIDER_TEST_* values to audit_action enum (M10.2)
-- Cherry-picked from new-api's channel-test pattern — the admin "test provider"
-- endpoint writes one audit row per call. The existing schema enum does not
-- include provider-test actions, so we extend it here. This is forward-only
-- (no existing rows are touched). Note: PostgreSQL requires ALTER TYPE ... ADD
-- VALUE to be the only statement in its transaction; Drizzle runs each migration
-- file in its own implicit tx, so this is safe.

ALTER TYPE "public"."audit_action" ADD VALUE IF NOT EXISTS 'PROVIDER_TEST_SUCCESS';
--> statement-breakpoint

ALTER TYPE "public"."audit_action" ADD VALUE IF NOT EXISTS 'PROVIDER_TEST_FAILED';
