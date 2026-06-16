CREATE TYPE "public"."refund_status" AS ENUM('pending', 'granted', 'denied');--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'PROVIDER_TEST_FAILED';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'PROVIDER_TEST_SUCCESS';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'REFUND_GRANTED';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'REFUND_DENIED';--> statement-breakpoint
ALTER TYPE "public"."deposit_type" ADD VALUE 'usdc_solana' BEFORE 'houdini_swap';--> statement-breakpoint
ALTER TYPE "public"."deposit_type" ADD VALUE 'jupiter_swap' BEFORE 'payment_link';--> statement-breakpoint
ALTER TYPE "public"."deposit_type" ADD VALUE 'solana_direct' BEFORE 'payment_link';--> statement-breakpoint
ALTER TYPE "public"."provider" ADD VALUE 'morpheus';--> statement-breakpoint
ALTER TYPE "public"."provider" ADD VALUE 'claude';--> statement-breakpoint
ALTER TYPE "public"."provider" ADD VALUE 'gemini';--> statement-breakpoint
CREATE TABLE "provider_affinity" (
	"user_id" uuid NOT NULL,
	"model_id" text NOT NULL,
	"provider" text NOT NULL,
	"last_used" timestamp with time zone DEFAULT now() NOT NULL,
	"use_count" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "provider_affinity_user_id_model_id_pk" PRIMARY KEY("user_id","model_id")
);
--> statement-breakpoint
CREATE TABLE "refund_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"deposit_id" uuid,
	"amount_cents" numeric(18, 2) NOT NULL,
	"reason" text NOT NULL,
	"status" "refund_status" DEFAULT 'pending' NOT NULL,
	"notes" text,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_account_number_unique";--> statement-breakpoint
DROP INDEX "uq_users_account_number";--> statement-breakpoint
DROP INDEX "idx_users_email";--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "ip_allowlist" text[];--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "allowed_models" text[];--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "solana_address" text;--> statement-breakpoint
ALTER TABLE "provider_affinity" ADD CONSTRAINT "provider_affinity_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_deposit_id_deposits_id_fk" FOREIGN KEY ("deposit_id") REFERENCES "public"."deposits"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_provider_affinity_last_used" ON "provider_affinity" USING btree ("last_used" DESC);--> statement-breakpoint
CREATE INDEX "idx_provider_affinity_provider" ON "provider_affinity" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "idx_refund_requests_status_created" ON "refund_requests" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "idx_refund_requests_user" ON "refund_requests" USING btree ("user_id");