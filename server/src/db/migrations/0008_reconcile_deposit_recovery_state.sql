-- Reconciliation for environments whose migration journal was baselined
-- after 0001, so the migrator considered 0001 applied and never created its
-- table. The deposit-recovery checkpoint is read on every startup
-- (src/index.ts), so a missing table surfaces as 42P01 there.
--
-- Idempotent by design: a database that already has the table (production)
-- is left untouched, and the statement is safe to re-run.
CREATE TABLE IF NOT EXISTS "deposit_recovery_state" (
	"deposit_address" text PRIMARY KEY NOT NULL,
	"last_block" bigint DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
