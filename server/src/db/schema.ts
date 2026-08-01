/**
 * Database schema.
 *
 * Clean rebuild for Better Auth (magic link + anonymous + SIWE wallet).
 * OMA-specific tables stay focused: API keys, credit ledger, deposits, usage
 * records, x402 settlements, audit log.
 *
 * Tables REMOVED in this rebuild (vs the prior monolith):
 *   - teams / teamMembers / ssoConnections   (no team surface yet)
 *   - subscriptions / plans / invoices      (Polar-billing parked; not wired)
 *   - budgetAlerts / budgetAlertHistory     (no email/webhook surface)
 *   - adminConfig / rateLimitOverrides      (config moved to env)
 *   - depositRecoveries / depositNotifications / withdrawals (not wired)
 *   - byokKeys                              (BYOK was never launched)
 *   - polar* (4 tables)                      (Polar billing parked)
 *   - twoFactorBackupCodes                  (Better Auth 2FA plugin when needed)
 *   - signingKeys                           (pinning scheme was experimental)
 *   - audit_action enum removed twoFactor enum (kept the rest)
 */
import {
  pgTable,
  text,
  timestamp,
  boolean,
  jsonb,
  index,
  uniqueIndex,
  numeric,
  integer,
  pgEnum,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// =============================================================================
// Enums
// =============================================================================

export const depositStatusEnum = pgEnum("deposit_status", [
  "pending",
  "settling",
  "completed",
  "failed",
  "expired",
  "refunded",
]);

export const depositTypeEnum = pgEnum("deposit_type", [
  "usdc_direct",
  "cctp_crosschain",
  "lifi_swap",
  "payment_link",
  "wrong_network_recovery",
]);

export const providerEnum = pgEnum("provider", [
  "venice",
  "tinyfish",
  "surplus",
  "gonka",
]);

export const refundStatusEnum = pgEnum("refund_status", [
  "pending",
  "granted",
  "denied",
]);

export const auditActionEnum = pgEnum("audit_action", [
  "USER_LOGIN",
  "USER_LOGOUT",
  "API_KEY_CREATED",
  "API_KEY_REVOKED",
  "USER_CREATED",
  "USER_UPDATED",
  "USER_DELETED",
  "ACCOUNT_DELETE_REQUESTED",
  "ACCOUNT_DELETE_COMPLETED",
  "DATA_EXPORT_REQUESTED",
  "HISTORY_CLEARED",
  "WALLET_LINKED",
  "WALLET_UNLINKED",
  "DEPOSIT_CREATED",
  "DEPOSIT_COMPLETED",
  "DEPOSIT_FAILED",
  "REFUND_GRANTED",
  "REFUND_DENIED",
  "PROVIDER_TEST_FAILED",
  "PROVIDER_TEST_SUCCESS",
  "RATE_LIMIT_OVERRIDE_SET",
  "RATE_LIMIT_OVERRIDE_REMOVED",
  "ACCOUNT_LOGIN_RATE_LIMITED",
  "USER_SUSPENDED",
  "USER_UNSUSPENDED",
  "CREDIT_ADJUSTED",
  "REFUND_ISSUED",
]);

// =============================================================================
// Better Auth core tables
// =============================================================================
// Field names and types are pinned to better-auth/adapters/drizzle contract.
// DO NOT EDIT without bumping the Better Auth contract.
//
// NOTE: Better Auth's SIWE plugin expects a top-level `walletAddress`
// table (model) — not a column on `user`.  It stores the EIP-4361
// signed address per user so the same wallet can link multiple accounts.
// =============================================================================

// ---------------------------------------------------------------------------
// SIWE wallet-address model  (required by better-auth siwe plugin)
// ---------------------------------------------------------------------------
export const walletAddress = pgTable(
  "wallet_address",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
    address: text("address").notNull(),
    chainId: integer("chain_id").notNull(),
    isPrimary: boolean("is_primary").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("uq_wallet_addr_user_chain")
      .on(t.userId, t.chainId),
    uniqueIndex("uq_wallet_addr")
      .on(t.address)
      .where(sql`${t.address} IS NOT NULL`),
  ],
);

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  // OMA extension fields (see user.additionalFields in server/src/auth.ts)
  evmAddress: text("evm_address"),
  isAnonymous: boolean("is_anonymous").notNull().default(false),
  role: text("role"),
  banned: boolean("banned").notNull().default(false),
  banReason: text("ban_reason"),
  banExpires: timestamp("ban_expires", { withTimezone: true }),
  // Slice 6 (admin controls depth): dedicated suspended flag — checked by
  // sessionAuth + bearerAuth (auth/middleware.ts) so suspended accounts
  // are rejected at 403 even if a stale banned flag slips through.
  // The PATCH endpoint on banned is retained for back-compat with the
  // existing operator workflow.
  suspended: boolean("suspended").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdateFn(() => new Date()),
}, (t) => [
  uniqueIndex("idx_user_evm_address_unique")
    .on(t.evmAddress)
    .where(sql`${t.evmAddress} IS NOT NULL`),
  index("idx_user_is_anonymous").on(t.isAnonymous),
  index("idx_user_suspended").on(t.suspended),
]);

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  impersonatedBy: text("impersonated_by"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
}, (t) => [
  index("session_user_id_idx").on(t.userId),
]);

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", {
    withTimezone: true,
  }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
    withTimezone: true,
  }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (t) => [
  index("account_user_id_idx").on(t.userId),
]);

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (t) => [
  index("verification_identifier_idx").on(t.identifier),
]);

// =============================================================================
// OMA domain tables
// =============================================================================

export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
    keyPrefix: text("key_prefix").notNull(),
    keyHash: text("key_hash").notNull(),
    name: text("name").notNull(),
    active: boolean("active").default(true).notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    ipAllowlist: text("ip_allowlist").array(),
    allowedModels: text("allowed_models").array(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("idx_api_keys_hash").on(t.keyHash),
    index("idx_api_keys_user").on(t.userId),
    index("idx_api_keys_user_active").on(t.userId, t.active),
  ],
);

export type ApiKey = Omit<typeof apiKeys.$inferSelect, never> & { expired?: boolean };

export const deposits = pgTable(
  "deposits",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
    type: depositTypeEnum("type").notNull(),
    amountUsd: numeric("amount_usd", { precision: 18, scale: 8 }).notNull(),
    creditsIssued: numeric("credits_issued", {
      precision: 18,
      scale: 8,
    }).notNull(),
    txHash: text("tx_hash"),
    fromCoin: text("from_coin"),
    toCoin: text("to_coin"),
    depositAddress: text("deposit_address"),
    status: depositStatusEnum("status").default("pending").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    index("idx_deposits_user").on(t.userId),
    index("idx_deposits_status").on(t.status),
    index("idx_deposits_txhash").on(t.txHash),
    uniqueIndex("idx_deposits_txhash_unique")
      .on(t.txHash)
      .where(sql`${t.txHash} is not null`),
    index("idx_deposits_user_status").on(t.userId, t.status),
    index("idx_deposits_created_at").on(t.createdAt),
  ],
);

export const creditBalances = pgTable("credit_balances", {
  userId: text("user_id")
    .references(() => user.id, { onDelete: "cascade" })
    .primaryKey(),
  balanceCents: numeric("balance_cents", { precision: 18, scale: 8 })
    .default("0")
    .notNull(),
  totalDepositedCents: numeric("total_deposited_cents", {
    precision: 18,
    scale: 8,
  })
    .default("0")
    .notNull(),
  totalUsedCents: numeric("total_used_cents", { precision: 18, scale: 8 })
    .default("0")
    .notNull(),
  lastActivityAt: timestamp("last_activity_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdateFn(() => new Date()),
});

export const usageRecords = pgTable(
  "usage_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    requestId: text("request_id").notNull(),
    userId: text("user_id")
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
    apiKeyId: uuid("api_key_id").references(() => apiKeys.id, {
      onDelete: "set null",
    }),
    model: text("model").notNull(),
    provider: providerEnum("provider").notNull(),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    costCents: numeric("cost_cents", { precision: 18, scale: 8 }).notNull(),
    markupCents: numeric("markup_cents", { precision: 18, scale: 8 }).notNull(),
    totalCents: numeric("total_cents", { precision: 18, scale: 8 }).notNull(),
    latencyMs: integer("latency_ms"),
    status: text("status").default("completed").notNull(),
    refundedAt: timestamp("refunded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("idx_usage_api_key").on(t.apiKeyId),
    index("idx_usage_request").on(t.requestId),
    uniqueIndex("uq_usage_request_id").on(t.requestId),
    index("idx_usage_user_created").on(t.userId, t.createdAt),
    index("idx_usage_records_analytics").on(
      t.createdAt,
      t.model,
      t.provider,
      t.costCents,
    ),
    index("idx_usage_user_created_model").on(
      t.userId,
      t.createdAt,
      t.model,
    ),
  ],
);

export const creditBatches = pgTable(
  "credit_batches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
    amountCents: numeric("amount_cents", { precision: 18, scale: 2 }).notNull(),
    remainingCents: numeric("remaining_cents", {
      precision: 18,
      scale: 2,
    }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    paymentMethod: text("payment_method").default("usdc"),
    depositId: uuid("deposit_id").references(() => deposits.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("idx_credit_batches_user").on(t.userId),
    index("idx_credit_batches_deposit").on(t.depositId),
    index("idx_credit_batches_expiry").on(t.expiresAt),
    index("idx_credit_batches_user_expiry_remaining").on(
      t.userId,
      t.expiresAt,
      t.remainingCents,
    ),
    index("idx_credit_batches_remaining_positive")
      .on(t.userId)
      .where(sql`${t.remainingCents} > 0`),
  ],
);

export const autoReloadSettings = pgTable("auto_reload_settings", {
  userId: text("user_id")
    .references(() => user.id, { onDelete: "cascade" })
    .primaryKey(),
  enabled: boolean("enabled").default(false).notNull(),
  thresholdCents: numeric("threshold_cents", { precision: 18, scale: 2 })
    .default("500")
    .notNull(),
  reloadAmountCents: numeric("reload_amount_cents", {
    precision: 18,
    scale: 2,
  })
    .default("10000")
    .notNull(),
  spendLimitCents: numeric("spend_limit_cents", { precision: 18, scale: 2 })
    .default("100000")
    .notNull(),
  paymentMethod: text("payment_method").default("usdc"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdateFn(() => new Date()),
});

export const settlements = pgTable(
  "settlements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    txHash: text("tx_hash").notNull(),
    amount: text("amount").notNull(),
    networkId: text("network_id").notNull(),
    payee: text("payee").notNull(),
    receipt: text("receipt").notNull(),
    settledAt: timestamp("settled_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("idx_settlements_txhash_network_unique").on(
      t.txHash,
      t.networkId,
    ),
    index("idx_settlements_txhash").on(t.txHash),
    index("idx_settlements_network").on(t.networkId),
    index("idx_settlements_payee").on(t.payee),
  ],
);

export const refundRequests = pgTable(
  "refund_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
    depositId: uuid("deposit_id").references(() => deposits.id, {
      onDelete: "set null",
    }),
    amountCents: numeric("amount_cents", { precision: 18, scale: 2 }).notNull(),
    reason: text("reason").notNull(),
    status: refundStatusEnum("status").notNull().default("pending"),
    notes: text("notes"),
    decidedBy: text("decided_by").references(() => user.id, {
      onDelete: "set null",
    }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("idx_refund_requests_status_created").on(t.status, t.createdAt),
    index("idx_refund_requests_user").on(t.userId),
    index("idx_refund_requests_deposit").on(t.depositId),
  ],
);

export const webhookSubscriptions = pgTable(
  "webhook_subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
    url: text("url").notNull(),
    event: text("event").notNull(),
    events: text("events").array(),
    secret: text("secret"),
    active: boolean("active").default(true).notNull(),
    lastNotificationAt: timestamp("last_notification_at", {
      withTimezone: true,
    }),
    lastNotificationStatus: text("last_notification_status"),
    notificationCount: integer("notification_count").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("idx_webhook_subscriptions_user").on(t.userId),
    index("idx_webhook_subscriptions_active").on(t.userId, t.active),
  ],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    action: auditActionEnum("action").notNull(),
    resource: text("resource").notNull(),
    resourceId: text("resource_id"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("idx_audit_logs_user").on(t.userId),
    index("idx_audit_logs_action").on(t.action),
    index("idx_audit_logs_resource").on(t.resource),
    index("idx_audit_logs_resource_id").on(t.resourceId),
    index("idx_audit_logs_created").on(t.createdAt),
    index("idx_audit_logs_user_action_created").on(
      t.userId,
      t.action,
      t.createdAt,
    ),
  ],
);

export const siteSettings = pgTable("site_settings", {
  id: text("id").primaryKey().default("default"),
  maintenanceMode: boolean("maintenance_mode").notNull().default(false),
  cardPaymentsEnabled: boolean("card_payments_enabled").notNull().default(true),
  cryptoPaymentsEnabled: boolean("crypto_payments_enabled").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
