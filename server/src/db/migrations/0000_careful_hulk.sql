CREATE TYPE "public"."audit_action" AS ENUM('USER_LOGIN', 'USER_LOGOUT', 'API_KEY_CREATED', 'API_KEY_REVOKED', 'USER_CREATED', 'USER_UPDATED', 'USER_DELETED', 'ACCOUNT_DELETE_REQUESTED', 'ACCOUNT_DELETE_COMPLETED', 'DATA_EXPORT_REQUESTED', 'HISTORY_CLEARED', 'WALLET_LINKED', 'WALLET_UNLINKED', 'DEPOSIT_CREATED', 'DEPOSIT_COMPLETED', 'DEPOSIT_FAILED', 'REFUND_GRANTED', 'REFUND_DENIED', 'PROVIDER_TEST_FAILED', 'PROVIDER_TEST_SUCCESS', 'RATE_LIMIT_OVERRIDE_SET', 'RATE_LIMIT_OVERRIDE_REMOVED', 'ACCOUNT_LOGIN_RATE_LIMITED', 'USER_SUSPENDED', 'USER_UNSUSPENDED', 'CREDIT_ADJUSTED', 'CREDIT_DEDUCTED', 'SITE_SETTINGS_UPDATED', 'REFUND_ISSUED');--> statement-breakpoint
CREATE TYPE "public"."deposit_status" AS ENUM('pending', 'settling', 'completed', 'failed', 'expired', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."deposit_type" AS ENUM('usdc_direct', 'cctp_crosschain', 'lifi_swap', 'payment_link', 'wrong_network_recovery');--> statement-breakpoint
CREATE TYPE "public"."provider" AS ENUM('venice', 'litellm', 'tinyfish', 'surplus', 'oma-ai');--> statement-breakpoint
CREATE TYPE "public"."refund_status" AS ENUM('pending', 'granted', 'denied');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"key_prefix" text NOT NULL,
	"key_hash" text NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"last_used_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"ip_allowlist" text[],
	"allowed_models" text[],
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"action" "audit_action" NOT NULL,
	"resource" text NOT NULL,
	"resource_id" text,
	"ip_address" text,
	"user_agent" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auto_reload_settings" (
	"user_id" text PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"threshold_cents" numeric(18, 2) DEFAULT '500' NOT NULL,
	"reload_amount_cents" numeric(18, 2) DEFAULT '10000' NOT NULL,
	"spend_limit_cents" numeric(18, 2) DEFAULT '100000' NOT NULL,
	"payment_method" text DEFAULT 'usdc',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_balances" (
	"user_id" text PRIMARY KEY NOT NULL,
	"balance_cents" numeric(18, 8) DEFAULT '0' NOT NULL,
	"total_deposited_cents" numeric(18, 8) DEFAULT '0' NOT NULL,
	"total_used_cents" numeric(18, 8) DEFAULT '0' NOT NULL,
	"last_activity_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"amount_cents" numeric(18, 2) NOT NULL,
	"remaining_cents" numeric(18, 2) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"payment_method" text DEFAULT 'usdc',
	"deposit_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email_normalized" text NOT NULL,
	"user_id" text,
	"grant_type" text NOT NULL,
	"cents" numeric(18, 8) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deposits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"type" "deposit_type" NOT NULL,
	"amount_usd" numeric(18, 8) NOT NULL,
	"credits_issued" numeric(18, 8) NOT NULL,
	"tx_hash" text,
	"from_coin" text,
	"to_coin" text,
	"deposit_address" text,
	"from_address" text,
	"status" "deposit_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "polar_webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"polar_event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"payload" text NOT NULL,
	"processed" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limit_overrides" (
	"user_id" text PRIMARY KEY NOT NULL,
	"max_requests_per_minute" integer NOT NULL,
	"reason" text NOT NULL,
	"set_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refund_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"deposit_id" uuid,
	"amount_cents" numeric(18, 2) NOT NULL,
	"reason" text NOT NULL,
	"status" "refund_status" DEFAULT 'pending' NOT NULL,
	"notes" text,
	"decided_by" text,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"impersonated_by" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "settlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tx_hash" text NOT NULL,
	"amount" text NOT NULL,
	"network_id" text NOT NULL,
	"payee" text NOT NULL,
	"receipt" text NOT NULL,
	"settled_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_settings" (
	"id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
	"maintenance_mode" boolean DEFAULT false NOT NULL,
	"maintenance_message" text,
	"card_payments_enabled" boolean DEFAULT true NOT NULL,
	"crypto_payments_enabled" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" text NOT NULL,
	"user_id" text NOT NULL,
	"api_key_id" uuid,
	"model" text NOT NULL,
	"provider" "provider" NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cost_cents" numeric(18, 8) NOT NULL,
	"markup_cents" numeric(18, 8) NOT NULL,
	"total_cents" numeric(18, 8) NOT NULL,
	"latency_ms" integer,
	"status" text DEFAULT 'completed' NOT NULL,
	"refunded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"evm_address" text,
	"is_anonymous" boolean DEFAULT false NOT NULL,
	"role" text,
	"banned" boolean DEFAULT false NOT NULL,
	"ban_reason" text,
	"ban_expires" timestamp with time zone,
	"account_number" text,
	"suspended" boolean DEFAULT false NOT NULL,
	"suspended_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email"),
	CONSTRAINT "user_role_check" CHECK ("user"."role" IS NULL OR "user"."role" IN ('admin', 'user'))
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wallet_address" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"address" text NOT NULL,
	"chain_id" integer NOT NULL,
	"is_primary" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"url" text NOT NULL,
	"event" text NOT NULL,
	"events" text[],
	"secret" text,
	"active" boolean DEFAULT true NOT NULL,
	"last_notification_at" timestamp with time zone,
	"last_notification_status" text,
	"notification_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auto_reload_settings" ADD CONSTRAINT "auto_reload_settings_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_balances" ADD CONSTRAINT "credit_balances_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_batches" ADD CONSTRAINT "credit_batches_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_batches" ADD CONSTRAINT "credit_batches_deposit_id_deposits_id_fk" FOREIGN KEY ("deposit_id") REFERENCES "public"."deposits"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate_limit_overrides" ADD CONSTRAINT "rate_limit_overrides_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate_limit_overrides" ADD CONSTRAINT "rate_limit_overrides_set_by_user_id_fk" FOREIGN KEY ("set_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_deposit_id_deposits_id_fk" FOREIGN KEY ("deposit_id") REFERENCES "public"."deposits"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_decided_by_user_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_api_key_id_api_keys_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_address" ADD CONSTRAINT "wallet_address_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_subscriptions" ADD CONSTRAINT "webhook_subscriptions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_api_keys_hash" ON "api_keys" USING btree ("key_hash");--> statement-breakpoint
CREATE INDEX "idx_api_keys_user" ON "api_keys" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_api_keys_user_active" ON "api_keys" USING btree ("user_id","active");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_user" ON "audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_action" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_resource" ON "audit_logs" USING btree ("resource");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_resource_id" ON "audit_logs" USING btree ("resource_id");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_created" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_user_action_created" ON "audit_logs" USING btree ("user_id","action","created_at");--> statement-breakpoint
CREATE INDEX "idx_credit_batches_user" ON "credit_batches" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_credit_batches_deposit" ON "credit_batches" USING btree ("deposit_id");--> statement-breakpoint
CREATE INDEX "idx_credit_batches_expiry" ON "credit_batches" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_credit_batches_user_expiry_remaining" ON "credit_batches" USING btree ("user_id","expires_at","remaining_cents");--> statement-breakpoint
CREATE INDEX "idx_credit_batches_remaining_positive" ON "credit_batches" USING btree ("user_id") WHERE "credit_batches"."remaining_cents" > 0;--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_credit_grants_email_type" ON "credit_grants" USING btree ("email_normalized","grant_type");--> statement-breakpoint
CREATE INDEX "idx_deposits_user" ON "deposits" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_deposits_status" ON "deposits" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_deposits_txhash" ON "deposits" USING btree ("tx_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_deposits_txhash_unique" ON "deposits" USING btree ("tx_hash") WHERE "deposits"."tx_hash" is not null;--> statement-breakpoint
CREATE INDEX "idx_deposits_user_status" ON "deposits" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "idx_deposits_created_at" ON "deposits" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "polar_webhook_events_polar_event_id_unique" ON "polar_webhook_events" USING btree ("polar_event_id");--> statement-breakpoint
CREATE INDEX "idx_polar_webhook_events_event_type" ON "polar_webhook_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "idx_polar_webhook_events_processed" ON "polar_webhook_events" USING btree ("processed");--> statement-breakpoint
CREATE INDEX "idx_rate_limit_overrides_set_by" ON "rate_limit_overrides" USING btree ("set_by");--> statement-breakpoint
CREATE INDEX "idx_refund_requests_status_created" ON "refund_requests" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "idx_refund_requests_user" ON "refund_requests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_refund_requests_deposit" ON "refund_requests" USING btree ("deposit_id");--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_settlements_txhash_network_unique" ON "settlements" USING btree ("tx_hash","network_id");--> statement-breakpoint
CREATE INDEX "idx_settlements_txhash" ON "settlements" USING btree ("tx_hash");--> statement-breakpoint
CREATE INDEX "idx_settlements_network" ON "settlements" USING btree ("network_id");--> statement-breakpoint
CREATE INDEX "idx_settlements_payee" ON "settlements" USING btree ("payee");--> statement-breakpoint
CREATE INDEX "idx_usage_api_key" ON "usage_records" USING btree ("api_key_id");--> statement-breakpoint
CREATE INDEX "idx_usage_request" ON "usage_records" USING btree ("request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_usage_request_id" ON "usage_records" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "idx_usage_user_created" ON "usage_records" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_usage_records_analytics" ON "usage_records" USING btree ("created_at","model","provider","cost_cents");--> statement-breakpoint
CREATE INDEX "idx_usage_user_created_model" ON "usage_records" USING btree ("user_id","created_at","model");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_user_evm_address_unique" ON "user" USING btree ("evm_address") WHERE "user"."evm_address" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_user_is_anonymous" ON "user" USING btree ("is_anonymous");--> statement-breakpoint
CREATE INDEX "idx_user_suspended" ON "user" USING btree ("suspended");--> statement-breakpoint
CREATE INDEX "idx_user_account_number" ON "user" USING btree ("account_number");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_wallet_addr_user_chain" ON "wallet_address" USING btree ("user_id","chain_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_wallet_addr" ON "wallet_address" USING btree ("address") WHERE "wallet_address"."address" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_webhook_subscriptions_user" ON "webhook_subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_webhook_subscriptions_active" ON "webhook_subscriptions" USING btree ("user_id","active");