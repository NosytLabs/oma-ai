CREATE TABLE "pending_settlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tx_hash" text NOT NULL,
	"network_id" text NOT NULL,
	"amount" text NOT NULL,
	"payee" text NOT NULL,
	"payer" text NOT NULL,
	"broadcast_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"receipt" text,
	"resolved_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "idx_pending_settlements_txhash_network_unique" ON "pending_settlements" USING btree ("tx_hash","network_id");--> statement-breakpoint
CREATE INDEX "idx_pending_settlements_status" ON "pending_settlements" USING btree ("status");