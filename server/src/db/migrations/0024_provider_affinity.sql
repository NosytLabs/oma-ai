-- Migration 0024: Channel Affinity Cache (M10.1)
-- Cherry-picked from new-api/controller/channel_affinity_cache.go pattern.
-- Persistent store for sticky (userId, modelId) → provider mappings.
-- Hot path is Redis-backed in-process L1+L2; this table is the audit trail +
-- cold-start fallback. Re-populated on next request after Redis flush.

CREATE TABLE IF NOT EXISTS "provider_affinity" (
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
	"model_id" text NOT NULL,
	"provider" text NOT NULL CHECK ("provider" IN ('venice','antseed','litellm','openrouter','together','deepinfra','surplus','morpheus')),
	"last_used" timestamp with time zone DEFAULT now() NOT NULL,
	"use_count" integer DEFAULT 1 NOT NULL,
	PRIMARY KEY ("user_id", "model_id")
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_provider_affinity_last_used" ON "provider_affinity" ("last_used" DESC);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_provider_affinity_provider" ON "provider_affinity" ("provider");
