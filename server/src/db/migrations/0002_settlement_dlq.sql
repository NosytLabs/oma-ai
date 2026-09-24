ALTER TYPE "public"."audit_action" ADD VALUE 'CREDIT_DEDUCTION_REJECTED' BEFORE 'SITE_SETTINGS_UPDATED';--> statement-breakpoint
CREATE TABLE "settlement_dlq" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tx_hash" text NOT NULL,
	"network_id" text NOT NULL,
	"amount" text NOT NULL,
	"payee" text NOT NULL,
	"receipt" text NOT NULL,
	"settled_at" timestamp with time zone NOT NULL,
	"attempts" integer DEFAULT 1 NOT NULL,
	"last_error" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN "issuer" text;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_settlement_dlq_txhash_network_unique" ON "settlement_dlq" USING btree ("tx_hash","network_id");--> statement-breakpoint
CREATE INDEX "idx_settlement_dlq_next_attempt" ON "settlement_dlq" USING btree ("next_attempt_at");