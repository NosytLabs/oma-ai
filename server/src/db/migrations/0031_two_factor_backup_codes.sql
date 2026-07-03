-- Migration 0031: Two-Factor Backup Codes + Neon Auth Columns
--
-- Part A: Neon Auth (merged from duplicate 0031_add_neon_auth_columns.sql)
-- Adds columns needed for Neon Auth linking.
-- NEON_AUTH_URL is not currently set so this remains dormant until configured.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "neon_auth_user_id" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "neon_auth_linked_at" timestamptz;
CREATE INDEX IF NOT EXISTS "idx_users_neon_auth_user_id" ON "users" ("neon_auth_user_id");
--> statement-breakpoint

--
-- Part B: Two-Factor Backup Codes
--
-- 2FA TOTP was added in an earlier migration (the `users.two_factor_secret`
-- and `users.two_factor_enabled` columns). This migration adds the recovery
-- mechanism: 10 single-use backup codes generated at setup time, hashed at
-- rest, consumed on redemption.
--
-- Industry pattern (GitHub, Google, Stripe): show the plaintext codes to the
-- user EXACTLY ONCE at enrollment, store only SHA-256 hashes, mark a row as
-- `used_at = now()` when consumed. Codes are random 40-bit strings formatted
-- as `xxxxx-xxxxx` (10 hex chars + dash) so they're easy to type.

CREATE TABLE "two_factor_backup_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"code_hash" text NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE INDEX "idx_2fa_backup_codes_user"
  ON "two_factor_backup_codes" ("user_id");
--> statement-breakpoint

-- Partial index for the hot path: "how many unused codes does this user have?"
-- Far smaller than indexing the full table because used rows dominate over time.
CREATE INDEX "idx_2fa_backup_codes_user_unused"
  ON "two_factor_backup_codes" ("user_id")
  WHERE "used_at" IS NULL;
--> statement-breakpoint

CREATE INDEX "idx_2fa_backup_codes_hash"
  ON "two_factor_backup_codes" ("code_hash");