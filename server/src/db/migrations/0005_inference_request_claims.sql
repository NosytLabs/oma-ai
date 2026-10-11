-- Account-scoped inference retry metadata. No prompts, replies or raw keys.
CREATE TABLE IF NOT EXISTS "inference_request_claims" (
  "user_id" text NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  "key_hash" text NOT NULL,
  "request_id" text PRIMARY KEY NOT NULL,
  "state" text NOT NULL DEFAULT 'pending',
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "uq_inference_claim_user_key" UNIQUE ("user_id", "key_hash"),
  CONSTRAINT "inference_claim_state" CHECK ("state" IN ('pending', 'completed'))
);
