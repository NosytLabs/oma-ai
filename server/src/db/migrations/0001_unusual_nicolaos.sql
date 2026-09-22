CREATE TABLE "deposit_recovery_state" (
	"deposit_address" text PRIMARY KEY NOT NULL,
	"last_block" bigint DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
