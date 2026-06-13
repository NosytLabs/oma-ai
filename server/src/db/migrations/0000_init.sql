CREATE TYPE "public"."audit_action" AS ENUM('USER_LOGIN', 'USER_LOGOUT', 'API_KEY_CREATED', 'API_KEY_REVOKED', 'USER_CREATED', 'USER_UPDATED', 'USER_DELETED', 'TEAM_MEMBER_ADDED', 'TEAM_MEMBER_REMOVED', 'TEAM_MEMBER_ROLE_CHANGED', 'DEPOSIT_CREATED', 'DEPOSIT_COMPLETED', 'DEPOSIT_FAILED', 'WITHDRAWAL_CREATED', 'WITHDRAWAL_COMPLETED', 'WITHDRAWAL_FAILED', 'FEE_CHANGED', 'RATE_LIMIT_OVERRIDE_SET', 'RATE_LIMIT_OVERRIDE_REMOVED', 'SPEND_LIMIT_CHANGED', 'BUDGET_ALERT_CHANGED', 'ACCOUNT_LOGIN_RATE_LIMITED');--> statement-breakpoint
CREATE TYPE "public"."budget_alert_type" AS ENUM('50_percent', '75_percent', '90_percent', '100_percent');--> statement-breakpoint
CREATE TYPE "public"."deposit_status" AS ENUM('pending', 'settling', 'completed', 'failed', 'expired', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."deposit_type" AS ENUM('usdc_direct', 'houdini_swap', 'cctp_crosschain', 'lifi_swap', 'payment_link', 'wrong_network_recovery');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('draft', 'pending', 'paid', 'overdue', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('email', 'webhook', 'both');--> statement-breakpoint
CREATE TYPE "public"."provider" AS ENUM('venice', 'antseed', 'litellm', 'openrouter', 'together', 'deepinfra', 'tinyfish', 'groq', 'cerebras', 'bedrock', 'surplus');--> statement-breakpoint
CREATE TYPE "public"."recovery_status" AS ENUM('pending', 'completed', 'rejected', 'expired');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('active', 'canceled', 'past_due', 'expired');--> statement-breakpoint
CREATE TYPE "public"."team_role" AS ENUM('owner', 'admin', 'member', 'billing');--> statement-breakpoint
CREATE TYPE "public"."withdrawal_status" AS ENUM('pending', 'processing', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TABLE "admin_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_config_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"key_prefix" text NOT NULL,
	"key_hash" text NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"last_used_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"action" "audit_action" NOT NULL,
	"resource" text NOT NULL,
	"resource_id" uuid,
	"ip_address" text,
	"user_agent" text,
	"metadata" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auto_reload_settings" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"threshold_cents" numeric(18, 2) DEFAULT '500' NOT NULL,
	"reload_amount_cents" numeric(18, 2) DEFAULT '10000' NOT NULL,
	"spend_limit_cents" numeric(18, 2) DEFAULT '100000' NOT NULL,
	"payment_method" text DEFAULT 'usdc',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "budget_alert_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"alert_type" "budget_alert_type" NOT NULL,
	"threshold_percent" integer NOT NULL,
	"spent_cents" numeric(18, 2) NOT NULL,
	"budget_limit_cents" numeric(18, 2) NOT NULL,
	"notification_sent" boolean DEFAULT false NOT NULL,
	"notification_channel" "notification_channel",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "budget_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"budget_limit_cents" numeric(18, 2) NOT NULL,
	"alert_thresholds" text DEFAULT '[50, 75, 90, 100]' NOT NULL,
	"email_enabled" boolean DEFAULT true NOT NULL,
	"webhook_enabled" boolean DEFAULT false NOT NULL,
	"webhook_url" text,
	"last_alert_at" timestamp with time zone,
	"daily_limit_cents" numeric(18, 2),
	"weekly_limit_cents" numeric(18, 2),
	"monthly_limit_cents" numeric(18, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "byok_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"byok_key_id" text NOT NULL,
	"provider" text NOT NULL,
	"name" text NOT NULL,
	"last_synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "byok_keys_byok_key_id_unique" UNIQUE("byok_key_id")
);
--> statement-breakpoint
CREATE TABLE "credit_balances" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"balance_cents" numeric(18, 2) DEFAULT '0' NOT NULL,
	"total_deposited_cents" numeric(18, 2) DEFAULT '0' NOT NULL,
	"total_used_cents" numeric(18, 2) DEFAULT '0' NOT NULL,
	"last_activity_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"amount_cents" numeric(18, 2) NOT NULL,
	"remaining_cents" numeric(18, 2) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"payment_method" text DEFAULT 'usdc',
	"deposit_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_transfers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_user_id" uuid NOT NULL,
	"to_user_id" uuid NOT NULL,
	"amount_dollars" numeric(18, 2) NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "deposit_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"deposit_id" uuid NOT NULL,
	"type" text NOT NULL,
	"status" text NOT NULL,
	"amount_usd" numeric(18, 8),
	"credits_issued" numeric(18, 8),
	"tx_hash" text,
	"method" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notified_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "deposit_recoveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"original_tx_hash" text NOT NULL,
	"recovery_tx_hash" text,
	"amount_usd" numeric(18, 8) NOT NULL,
	"status" "recovery_status" DEFAULT 'pending' NOT NULL,
	"rejection_reason" text,
	"completed_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "deposits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "deposit_type" NOT NULL,
	"amount_usd" numeric(18, 8) NOT NULL,
	"credits_issued" numeric(18, 8) NOT NULL,
	"tx_hash" text,
	"houdini_id" text,
	"from_coin" text,
	"to_coin" text,
	"deposit_address" text,
	"status" "deposit_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_number" text NOT NULL,
	"user_id" uuid NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"status" "invoice_status" DEFAULT 'draft' NOT NULL,
	"line_items" text NOT NULL,
	"due_date" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_invoice_number_unique" UNIQUE("invoice_number")
);
--> statement-breakpoint
CREATE TABLE "oracle_prices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"price_usd" numeric(18, 8) NOT NULL,
	"twap_30m" numeric(18, 8),
	"change_24h" numeric(8, 4),
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"price" integer NOT NULL,
	"credits" integer NOT NULL,
	"features" text DEFAULT '[]' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plans_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "provider_health" (
	"provider" "provider" PRIMARY KEY NOT NULL,
	"is_up" boolean DEFAULT true NOT NULL,
	"latency_ms" integer,
	"error_rate" numeric(5, 4) DEFAULT '0' NOT NULL,
	"last_check_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cooldown_until" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "rate_limit_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid NOT NULL,
	"rpm" integer,
	"tpm" integer,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
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
CREATE TABLE "sso_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"domain" text NOT NULL,
	"metadata" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sso_connections_domain_unique" UNIQUE("domain")
);
--> statement-breakpoint
CREATE TABLE "staking_tiers" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"oma_staked" numeric(18, 2) DEFAULT '0' NOT NULL,
	"discount_percent" integer DEFAULT 0 NOT NULL,
	"cooldown_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"status" "subscription_status" DEFAULT 'active' NOT NULL,
	"current_period_start" timestamp with time zone NOT NULL,
	"current_period_end" timestamp with time zone NOT NULL,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_members" (
	"team_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "team_role" DEFAULT 'member' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"billing_email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"api_key_id" uuid NOT NULL,
	"model" text NOT NULL,
	"provider" "provider" NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cost_cents" numeric(18, 2) NOT NULL,
	"markup_cents" numeric(18, 2) NOT NULL,
	"total_cents" numeric(18, 2) NOT NULL,
	"latency_ms" integer,
	"status" text DEFAULT 'completed' NOT NULL,
	"refunded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"address" text NOT NULL,
	"account_number" text,
	"account_number_hash" text,
	"email" text,
	"two_factor_secret" text,
	"two_factor_enabled" boolean DEFAULT false NOT NULL,
	"nonce" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_address_unique" UNIQUE("address"),
	CONSTRAINT "users_account_number_unique" UNIQUE("account_number")
);
--> statement-breakpoint
CREATE TABLE "webhook_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"url" text NOT NULL,
	"event" text NOT NULL,
	"events" text,
	"secret" text,
	"active" boolean DEFAULT true NOT NULL,
	"last_notification_at" timestamp with time zone,
	"last_notification_status" text,
	"notification_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "withdrawals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"amount_cents" numeric(18, 2) NOT NULL,
	"net_amount_cents" numeric(18, 2) NOT NULL,
	"fee_cents" numeric(18, 2) NOT NULL,
	"to_address" text NOT NULL,
	"chain_id" text DEFAULT '8453' NOT NULL,
	"status" "withdrawal_status" DEFAULT 'pending' NOT NULL,
	"tx_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auto_reload_settings" ADD CONSTRAINT "auto_reload_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_alert_history" ADD CONSTRAINT "budget_alert_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_alerts" ADD CONSTRAINT "budget_alerts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_balances" ADD CONSTRAINT "credit_balances_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_batches" ADD CONSTRAINT "credit_batches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_batches" ADD CONSTRAINT "credit_batches_deposit_id_deposits_id_fk" FOREIGN KEY ("deposit_id") REFERENCES "public"."deposits"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_transfers" ADD CONSTRAINT "credit_transfers_from_user_id_users_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_transfers" ADD CONSTRAINT "credit_transfers_to_user_id_users_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deposit_notifications" ADD CONSTRAINT "deposit_notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deposit_notifications" ADD CONSTRAINT "deposit_notifications_deposit_id_deposits_id_fk" FOREIGN KEY ("deposit_id") REFERENCES "public"."deposits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deposit_recoveries" ADD CONSTRAINT "deposit_recoveries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sso_connections" ADD CONSTRAINT "sso_connections_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staking_tiers" ADD CONSTRAINT "staking_tiers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_api_key_id_api_keys_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_subscriptions" ADD CONSTRAINT "webhook_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_admin_config_key" ON "admin_config" USING btree ("key");--> statement-breakpoint
CREATE INDEX "idx_api_keys_hash" ON "api_keys" USING btree ("key_hash");--> statement-breakpoint
CREATE INDEX "idx_api_keys_user" ON "api_keys" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_api_keys_user_active" ON "api_keys" USING btree ("user_id","active");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_user" ON "audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_action" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_resource" ON "audit_logs" USING btree ("resource");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_resource_id" ON "audit_logs" USING btree ("resource_id");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_created" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_user_action" ON "audit_logs" USING btree ("user_id","action");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_user_created" ON "audit_logs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_user_action_created" ON "audit_logs" USING btree ("user_id","action","created_at");--> statement-breakpoint
CREATE INDEX "idx_budget_alert_history_user" ON "budget_alert_history" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_budget_alert_history_created" ON "budget_alert_history" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_budget_alert_history_user_alert" ON "budget_alert_history" USING btree ("user_id","alert_type");--> statement-breakpoint
CREATE INDEX "idx_budget_alerts_user" ON "budget_alerts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_byok_keys_provider" ON "byok_keys" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "idx_byok_keys_byok_id" ON "byok_keys" USING btree ("byok_key_id");--> statement-breakpoint
CREATE INDEX "idx_credit_batches_user" ON "credit_batches" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_credit_batches_expiry" ON "credit_batches" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_credit_batches_user_remaining" ON "credit_batches" USING btree ("user_id","remaining_cents");--> statement-breakpoint
CREATE INDEX "idx_credit_batches_user_expiry_remaining" ON "credit_batches" USING btree ("user_id","expires_at","remaining_cents");--> statement-breakpoint
CREATE INDEX "idx_credit_batches_remaining_positive" ON "credit_batches" USING btree ("user_id") WHERE "credit_batches"."remaining_cents" > 0;--> statement-breakpoint
CREATE INDEX "idx_credit_transfers_from" ON "credit_transfers" USING btree ("from_user_id");--> statement-breakpoint
CREATE INDEX "idx_credit_transfers_to" ON "credit_transfers" USING btree ("to_user_id");--> statement-breakpoint
CREATE INDEX "idx_credit_transfers_from_to" ON "credit_transfers" USING btree ("from_user_id","to_user_id");--> statement-breakpoint
CREATE INDEX "idx_deposit_notifications_user" ON "deposit_notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_deposit_notifications_deposit" ON "deposit_notifications" USING btree ("deposit_id");--> statement-breakpoint
CREATE INDEX "idx_deposit_notifications_created" ON "deposit_notifications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_deposit_recoveries_user" ON "deposit_recoveries" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_deposit_recoveries_status" ON "deposit_recoveries" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_deposit_recoveries_original_tx" ON "deposit_recoveries" USING btree ("original_tx_hash");--> statement-breakpoint
CREATE INDEX "idx_deposit_recoveries_created" ON "deposit_recoveries" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_deposits_user" ON "deposits" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_deposits_houdini" ON "deposits" USING btree ("houdini_id");--> statement-breakpoint
CREATE INDEX "idx_deposits_status" ON "deposits" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_deposits_txhash" ON "deposits" USING btree ("tx_hash");--> statement-breakpoint
CREATE INDEX "idx_deposits_user_status" ON "deposits" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "idx_deposits_created_at" ON "deposits" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_invoices_user" ON "invoices" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_invoices_status" ON "invoices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_invoices_number" ON "invoices" USING btree ("invoice_number");--> statement-breakpoint
CREATE INDEX "idx_invoices_due_date" ON "invoices" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "idx_oracle_source" ON "oracle_prices" USING btree ("source");--> statement-breakpoint
CREATE INDEX "idx_oracle_captured" ON "oracle_prices" USING btree ("captured_at");--> statement-breakpoint
CREATE INDEX "idx_rate_limit_overrides_target" ON "rate_limit_overrides" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "idx_rate_limit_overrides_expiry" ON "rate_limit_overrides" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_settlements_txhash_network_unique" ON "settlements" USING btree ("tx_hash","network_id");--> statement-breakpoint
CREATE INDEX "idx_settlements_txhash" ON "settlements" USING btree ("tx_hash");--> statement-breakpoint
CREATE INDEX "idx_settlements_network" ON "settlements" USING btree ("network_id");--> statement-breakpoint
CREATE INDEX "idx_settlements_payee" ON "settlements" USING btree ("payee");--> statement-breakpoint
CREATE INDEX "idx_settlements_txhash_network_payee" ON "settlements" USING btree ("tx_hash","network_id","payee");--> statement-breakpoint
CREATE INDEX "idx_sso_connections_team" ON "sso_connections" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "idx_sso_connections_domain" ON "sso_connections" USING btree ("domain");--> statement-breakpoint
CREATE INDEX "idx_subscriptions_user" ON "subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_subscriptions_status" ON "subscriptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_subscriptions_period_end" ON "subscriptions" USING btree ("current_period_end");--> statement-breakpoint
CREATE INDEX "idx_team_members_team" ON "team_members" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "idx_team_members_user" ON "team_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_team_members_team_user" ON "team_members" USING btree ("team_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_usage_user" ON "usage_records" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_usage_api_key" ON "usage_records" USING btree ("api_key_id");--> statement-breakpoint
CREATE INDEX "idx_usage_model" ON "usage_records" USING btree ("model");--> statement-breakpoint
CREATE INDEX "idx_usage_created" ON "usage_records" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_usage_request" ON "usage_records" USING btree ("request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_usage_request_id" ON "usage_records" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "idx_usage_user_created" ON "usage_records" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_usage_records_provider" ON "usage_records" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "idx_usage_user_created_model" ON "usage_records" USING btree ("user_id","created_at","model");--> statement-breakpoint
CREATE INDEX "idx_users_address" ON "users" USING btree ("address");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_users_account_number" ON "users" USING btree ("account_number");--> statement-breakpoint
CREATE INDEX "idx_users_account_number_hash" ON "users" USING btree ("account_number_hash");--> statement-breakpoint
CREATE INDEX "idx_users_email" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_webhook_subscriptions_user" ON "webhook_subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_webhook_subscriptions_active" ON "webhook_subscriptions" USING btree ("user_id","active");--> statement-breakpoint
CREATE INDEX "idx_withdrawals_user" ON "withdrawals" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_withdrawals_status" ON "withdrawals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_withdrawals_txhash" ON "withdrawals" USING btree ("tx_hash");--> statement-breakpoint
CREATE INDEX "idx_withdrawals_user_status" ON "withdrawals" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "idx_withdrawals_created_at" ON "withdrawals" USING btree ("created_at");