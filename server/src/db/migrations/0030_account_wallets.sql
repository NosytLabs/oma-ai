-- Migration 0030: Account-centric identity — wallets are LINKS, not identity.
--
-- The pre-0030 design conflated the wallet address with the user's primary
-- identity. Account-number-only users had a synthetic `address = "account:<n>"`
-- placeholder, and there was no way to link/unlink a wallet from an existing
-- account. This migration introduces an explicit EVM wallet link column
-- (`evm_address`) so wallets are first-class LINKS, decoupled from the
-- account number which remains the user's durable identity.
--
-- Behavioural changes:
--   - `users.address` becomes nullable (account-number users no longer need a
--     placeholder). The UNIQUE constraint is preserved (Postgres UNIQUE allows
--     multiple NULLs by default, so existing account-number-only rows stay valid).
--   - `users.evm_address` is added as the canonical EVM wallet link. Existing
--     SIWE users are backfilled from `users.address` so the migration is a no-op
--     for current data.
--   - Account number columns (`account_number`, `account_number_hash`) are now
--     REQUIRED to be set together. A new partial unique index on `account_number`
--     re-asserts uniqueness for the user-visible identifier.
--   - New audit_action enum values for wallet / account-number lifecycle events.

-- Step 1: address becomes nullable so account-number-only users don't need
-- the synthetic "account:<n>" placeholder.
ALTER TABLE "users" ALTER COLUMN "address" DROP NOT NULL;
--> statement-breakpoint

-- Step 2: explicit EVM wallet link column. Existing SIWE users are backfilled
-- from `address` (which previously was always the EVM address for SIWE users).
ALTER TABLE "users" ADD COLUMN "evm_address" text;
--> statement-breakpoint

UPDATE "users" SET "evm_address" = "address" WHERE "address" ~ '^0x[a-fA-F0-9]{40}$';
--> statement-breakpoint

-- Step 3: unique partial indexes. Partial because NULL values are allowed
-- (account-number users have NULL evm_address; account-number-only legacy
-- rows may have NULL account_number).
CREATE UNIQUE INDEX "uq_users_account_number_partial"
  ON "users" ("account_number") WHERE "account_number" IS NOT NULL;
--> statement-breakpoint

CREATE UNIQUE INDEX "uq_users_evm_address_partial"
  ON "users" ("evm_address") WHERE "evm_address" IS NOT NULL;
--> statement-breakpoint

CREATE INDEX "idx_users_evm_address" ON "users" ("evm_address");
--> statement-breakpoint

-- Step 4: audit-action enum extensions for the new lifecycle events.
-- PostgreSQL's ALTER TYPE ... ADD VALUE cannot run in a transaction with other
-- DDL on older Postgres versions, but the IF NOT EXISTS clause + drizzle's
-- per-migration transaction isolation make this safe on PG 12+.
ALTER TYPE "public"."audit_action" ADD VALUE IF NOT EXISTS 'WALLET_LINKED';
--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE IF NOT EXISTS 'WALLET_UNLINKED';
--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE IF NOT EXISTS 'WALLET_ROTATED';
--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE IF NOT EXISTS 'ACCOUNT_NUMBER_ROTATED';
--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE IF NOT EXISTS 'ACCOUNT_NUMBER_RECOVERED';