CREATE TABLE IF NOT EXISTS "payment_credit_claims" (
  "network_id" text NOT NULL,
  "tx_hash" text NOT NULL,
  "credited_user_id" text NOT NULL,
  "credited_cents" numeric(18, 8) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "payment_credit_claims_canonical" CHECK ("network_id" = 'base' AND "tx_hash" = lower("tx_hash"))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payment_credit_claims_network_tx_unique" ON "payment_credit_claims" ("network_id", "tx_hash");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payment_credit_policy" (
  "network_id" text PRIMARY KEY NOT NULL,
  "recovery_not_before" timestamp with time zone NOT NULL
);
--> statement-breakpoint
-- Preserve the first cutoff even if an operator reruns this migration.
INSERT INTO "payment_credit_policy" ("network_id", "recovery_not_before")
VALUES ('base', clock_timestamp()) ON CONFLICT ("network_id") DO NOTHING;
--> statement-breakpoint
-- A refunded payment was credited previously too. Pending/failed rows have
-- never earned a claim. Legacy credits_issued had inconsistent units, so use
-- the completed deposit's canonical dollar amount to recover credited cents.
INSERT INTO "payment_credit_claims" ("network_id", "tx_hash", "credited_user_id", "credited_cents", "created_at")
SELECT DISTINCT ON (lower("tx_hash")) 'base', lower("tx_hash"), "user_id", "amount_usd" * 100, COALESCE("completed_at", "created_at")
FROM "deposits"
WHERE "type" = 'usdc_direct' AND "status" IN ('completed', 'refunded') AND "tx_hash" IS NOT NULL
ORDER BY lower("tx_hash"), COALESCE("completed_at", "created_at"), "id"
ON CONFLICT ("network_id", "tx_hash") DO NOTHING;
