-- Migration 0037: Admin controls depth — Slice 6
--
-- Adds four new audit_action enum values for admin operator actions:
--   USER_SUSPENDED, USER_UNSUSPENDED, CREDIT_ADJUSTED, REFUND_ISSUED
-- Adds a `suspended` boolean column to the user table. This is the
-- primary signal for whether an account is suspended; the existing
-- `banned` column is retained for back-compat with Better Auth's
-- session-cookie flow. Middleware checks both columns and rejects
-- API + session requests with 403 if either is true.
--
-- NOTE: this migration targets the `user` table (singular) to match
-- the live runtime schema. The drizzle snapshot in meta/0032_snapshot.json
-- shows `users` (plural), but the runtime Drizzle queries (see
-- routes/admin/index.ts, auth/middleware.ts) reference `user`. This
-- matches the pre-existing 0033+ migrations which are applied via psql
-- and not tracked by drizzle-kit, so the snapshot is stale.

-- ============================================================================
-- 1. Extend audit_action enum
-- ============================================================================
-- PostgreSQL requires ALTER TYPE ... ADD VALUE to be the only statement
-- in its transaction; Drizzle runs each migration file in its own
-- implicit tx, so these are safe.

ALTER TYPE "public"."audit_action" ADD VALUE IF NOT EXISTS 'USER_SUSPENDED';
--> statement-breakpoint

ALTER TYPE "public"."audit_action" ADD VALUE IF NOT EXISTS 'USER_UNSUSPENDED';
--> statement-breakpoint

ALTER TYPE "public"."audit_action" ADD VALUE IF NOT EXISTS 'CREDIT_ADJUSTED';
--> statement-breakpoint

ALTER TYPE "public"."audit_action" ADD VALUE IF NOT EXISTS 'REFUND_ISSUED';

-- ============================================================================
-- 2. user.suspended column
-- ============================================================================
-- A suspended user cannot authenticate (session or API key) and all
-- of their active API keys are revoked on suspend. Default false so
-- existing rows are unaffected. Indexed so the admin can quickly list
-- suspended accounts.

ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "suspended" boolean NOT NULL DEFAULT false;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_user_suspended" ON "user" ("suspended");