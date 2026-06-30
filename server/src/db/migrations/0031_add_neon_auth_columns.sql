-- 0031_add_neon_auth_columns.sql
--
-- Adds the two columns the Drizzle TypeScript schema declares in
-- app/server/src/db/schema.ts:39-61 (neonAuthUserId, neonAuthLinkedAt)
-- plus the index declared at schema.ts:59.
--
-- The Drizzle columns exist since the Neon-Auth linking path was added
-- in app/server/src/auth/middleware.ts:185-218, but no migration ever ran
-- to create them in the live DB. Every first-touch INSERT (account create,
-- SIWE/Solana nonce for unseen addresses) was 500ing with
--   "column 'neon_auth_user_id' of relation 'users' does not exist (42703)".
--
-- NEON_AUTH_URL is not currently set in app/server/.env, so the
-- Neon-Auth code path remains dormant. This migration is a no-op at
-- runtime until NEON_AUTH_URL is configured.

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "neon_auth_user_id" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "neon_auth_linked_at" timestamptz;

CREATE INDEX IF NOT EXISTS "idx_users_neon_auth_user_id" ON "users" ("neon_auth_user_id");
