-- Migration 0028: API Key Model Allowlist
-- Adds `allowed_models` to api_keys so users can restrict a key to specific models.
-- Empty / NULL = all models allowed (no breaking change for existing keys).
-- Enforcement lives in server/src/routes/chat/chat-completions.ts (bearerAuth handler).
-- Backfill: existing rows are left as NULL, which the handler treats
-- as "no restriction" — same as today's behavior. No row rewrite.

ALTER TABLE "api_keys" ADD COLUMN IF NOT EXISTS "allowed_models" text[] NULL;
