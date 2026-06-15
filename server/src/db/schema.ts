import {
  pgTable,
  uuid,
  text,
  numeric,
  timestamp,
  integer,
  boolean,
  jsonb,
  index,
  pgEnum,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

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
  "usdc_solana",
  "houdini_swap",
  "cctp_crosschain",
  "lifi_swap",
  "jupiter_swap",
  "solana_direct",
  "payment_link",
  "wrong_network_recovery",
]);

export const providerEnum = pgEnum("provider", ["venice", "antseed", "litellm", "openrouter", "together", "deepinfra", "tinyfish", "groq", "cerebras", "bedrock", "surplus", "morpheus", "claude", "gemini"]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  address: text("address").notNull().unique(),
  solanaAddress: text("solana_address"),
  accountNumber: text("account_number"), // Mullvad-style: OMA-XXXX-XXXX-XXXX (unique, nullable)
  accountNumberHash: text("account_number_hash"), // SHA256 hash for lookup
  twoFactorSecret: text("two_factor_secret"),
  twoFactorEnabled: boolean("two_factor_enabled").default(false).notNull(),
  nonce: text("nonce").notNull(), // TTL: expired after 10min (checked in siwe.ts); production cleanup via cron
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("idx_users_address").on(t.address),
  index("idx_users_account_number_hash").on(t.accountNumberHash),
]);

export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    keyPrefix: text("key_prefix").notNull(),
    keyHash: text("key_hash").notNull(),
    name: text("name").notNull(),
    active: boolean("active").default(true).notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    ipAllowlist: text("ip_allowlist").array(), // G3: null/empty = no restriction
    allowedModels: text("allowed_models").array(), // null/empty = no restriction
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("idx_api_keys_hash").on(t.keyHash), index("idx_api_keys_user").on(t.userId), index("idx_api_keys_user_active").on(t.userId, t.active)]
);

export type ApiKey = Omit<typeof apiKeys.$inferSelect, "allowedModels"> & { expired?: boolean; ipAllowlist?: string[] | null; allowedModels?: string[] | null };

export const deposits = pgTable(
  "deposits",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    type: depositTypeEnum("type").notNull(),
    amountUsd: numeric("amount_usd", { precision: 18, scale: 8 }).notNull(),
    creditsIssued: numeric("credits_issued", { precision: 18, scale: 8 }).notNull(),
    txHash: text("tx_hash"),
    houdiniId: text("houdini_id"),
    fromCoin: text("from_coin"),
    toCoin: text("to_coin"),
    depositAddress: text("deposit_address"),
    status: depositStatusEnum("status").default("pending").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    index("idx_deposits_user").on(t.userId),
    index("idx_deposits_houdini").on(t.houdiniId),
    index("idx_deposits_status").on(t.status),
    index("idx_deposits_txhash").on(t.txHash),
    index("idx_deposits_user_status").on(t.userId, t.status),
    index("idx_deposits_created_at").on(t.createdAt),
  ]
);

export const creditBalances = pgTable("credit_balances", {
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .primaryKey(),
  balanceCents: numeric("balance_cents", { precision: 18, scale: 2 }).default("0").notNull(),
  totalDepositedCents: numeric("total_deposited_cents", { precision: 18, scale: 2 }).default("0").notNull(),
  totalUsedCents: numeric("total_used_cents", { precision: 18, scale: 2 }).default("0").notNull(),
  lastActivityAt: timestamp("last_activity_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const usageRecords = pgTable(
  "usage_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    requestId: text("request_id").notNull(), // Unique request identifier for audit trail
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    apiKeyId: uuid("api_key_id")
      .references(() => apiKeys.id, { onDelete: "set null" })
      .notNull(),
    model: text("model").notNull(),
    provider: providerEnum("provider").notNull(),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    costCents: numeric("cost_cents", { precision: 18, scale: 2 }).notNull(),
    markupCents: numeric("markup_cents", { precision: 18, scale: 2 }).notNull(),
    totalCents: numeric("total_cents", { precision: 18, scale: 2 }).notNull(),
    latencyMs: integer("latency_ms"),
    status: text("status").default("completed").notNull(),
    refundedAt: timestamp("refunded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("idx_usage_user").on(t.userId),
    index("idx_usage_api_key").on(t.apiKeyId),
    index("idx_usage_model").on(t.model),
    index("idx_usage_created").on(t.createdAt),
    index("idx_usage_request").on(t.requestId),
    uniqueIndex("uq_usage_request_id").on(t.requestId),
    index("idx_usage_user_created").on(t.userId, t.createdAt),
    index("idx_usage_records_provider").on(t.provider),
    index("idx_usage_user_created_model").on(t.userId, t.createdAt, t.model),
  ]
);

export const providerHealth = pgTable("provider_health", {
  provider: providerEnum("provider").primaryKey(),
  isUp: boolean("is_up").default(true).notNull(),
  latencyMs: integer("latency_ms"),
  errorRate: numeric("error_rate", { precision: 5, scale: 4 }).default("0").notNull(),
  lastCheckAt: timestamp("last_check_at", { withTimezone: true }).defaultNow().notNull(),
  cooldownUntil: timestamp("cooldown_until", { withTimezone: true }),
});

export const creditBatches = pgTable(
  "credit_batches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
amountCents: numeric("amount_cents", { precision: 18, scale: 2 }).notNull(),
  remainingCents: numeric("remaining_cents", { precision: 18, scale: 2 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    paymentMethod: text("payment_method").default("usdc"),
    depositId: uuid("deposit_id")
      .references(() => deposits.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("idx_credit_batches_user").on(t.userId),
    index("idx_credit_batches_expiry").on(t.expiresAt),
    index("idx_credit_batches_user_remaining").on(t.userId, t.remainingCents),
    index("idx_credit_batches_user_expiry_remaining").on(t.userId, t.expiresAt, t.remainingCents),
    index("idx_credit_batches_remaining_positive").on(t.userId).where(sql`${t.remainingCents} > 0`),
  ]
);

export const creditTransfers = pgTable(
  "credit_transfers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    fromUserId: uuid("from_user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    toUserId: uuid("to_user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    amountDollars: numeric("amount_dollars", { precision: 18, scale: 2 }).notNull(),
    status: text("status").default("pending").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    index("idx_credit_transfers_from").on(t.fromUserId),
    index("idx_credit_transfers_to").on(t.toUserId),
    index("idx_credit_transfers_from_to").on(t.fromUserId, t.toUserId),
  ]
);

export const autoReloadSettings = pgTable(
  "auto_reload_settings",
  {
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .primaryKey(),
    enabled: boolean("enabled").default(false).notNull(),
    thresholdCents: numeric("threshold_cents", { precision: 18, scale: 2 }).default("500").notNull(),
    reloadAmountCents: numeric("reload_amount_cents", { precision: 18, scale: 2 }).default("10000").notNull(),
    spendLimitCents: numeric("spend_limit_cents", { precision: 18, scale: 2 }).default("100000").notNull(),
    paymentMethod: text("payment_method").default("usdc"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  }
);

import { relations } from "drizzle-orm";

export const usersRelations = relations(users, ({ many }) => ({
  apiKeys: many(apiKeys),
  deposits: many(deposits),
  creditBalances: many(creditBalances),
  usageRecords: many(usageRecords),
  creditBatches: many(creditBatches),
  creditTransfersFrom: many(creditTransfers, { relationName: "fromUser" }),
  creditTransfersTo: many(creditTransfers, { relationName: "toUser" }),
  autoReloadSettings: many(autoReloadSettings),
  teamMemberships: many(teamMembers),
  budgetAlerts: many(budgetAlerts),
  budgetAlertHistory: many(budgetAlertHistory),
  subscriptions: many(subscriptions),
}));

export const settlements = pgTable(
  "settlements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    txHash: text("tx_hash").notNull(),
    amount: text("amount").notNull(),
    networkId: text("network_id").notNull(),
    payee: text("payee").notNull(),
    receipt: text("receipt").notNull(),
    settledAt: timestamp("settled_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("idx_settlements_txhash_network_unique").on(t.txHash, t.networkId),
    index("idx_settlements_txhash").on(t.txHash),
    index("idx_settlements_network").on(t.networkId),
    index("idx_settlements_payee").on(t.payee),
    index("idx_settlements_txhash_network_payee").on(t.txHash, t.networkId, t.payee),
  ]
);

export const apiKeysRelations = relations(apiKeys, ({ one, many }) => ({
  user: one(users, { fields: [apiKeys.userId], references: [users.id] }),
  usageRecords: many(usageRecords),
}));

// Operator refund queue. Admin grants/denies pending requests and writes
// REFUND_GRANTED / REFUND_DENIED audit-log rows. Source: `credits/refunds.ts`.
export const refundStatusEnum = pgEnum("refund_status", ["pending", "granted", "denied"]);

export const refundRequests = pgTable(
  "refund_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    depositId: uuid("deposit_id")
      .references(() => deposits.id, { onDelete: "set null" }),
    amountCents: numeric("amount_cents", { precision: 18, scale: 2 }).notNull(),
    reason: text("reason").notNull(),
    status: refundStatusEnum("status").notNull().default("pending"),
    notes: text("notes"),
    decidedBy: uuid("decided_by").references(() => users.id, { onDelete: "set null" }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("idx_refund_requests_status_created").on(t.status, t.createdAt),
    index("idx_refund_requests_user").on(t.userId),
  ]
);

export const depositsRelations = relations(deposits, ({ one, many }) => ({
  user: one(users, { fields: [deposits.userId], references: [users.id] }),
  creditBatches: many(creditBatches),
}));

export const creditBalancesRelations = relations(creditBalances, ({ one }) => ({
  user: one(users, { fields: [creditBalances.userId], references: [users.id] }),
}));

export const usageRecordsRelations = relations(usageRecords, ({ one }) => ({
  user: one(users, { fields: [usageRecords.userId], references: [users.id] }),
  apiKey: one(apiKeys, { fields: [usageRecords.apiKeyId], references: [apiKeys.id] }),
}));

export const creditBatchesRelations = relations(creditBatches, ({ one }) => ({
  user: one(users, { fields: [creditBatches.userId], references: [users.id] }),
  deposit: one(deposits, { fields: [creditBatches.depositId], references: [deposits.id] }),
}));

export const creditTransfersRelations = relations(creditTransfers, ({ one }) => ({
  fromUser: one(users, { fields: [creditTransfers.fromUserId], references: [users.id], relationName: "fromUser" }),
  toUser: one(users, { fields: [creditTransfers.toUserId], references: [users.id], relationName: "toUser" }),
}));

export const autoReloadSettingsRelations = relations(autoReloadSettings, ({ one }) => ({
  user: one(users, { fields: [autoReloadSettings.userId], references: [users.id] }),
}));

export const oraclePrices = pgTable(
  "oracle_prices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    source: text("source").notNull(),
    priceUsd: numeric("price_usd", { precision: 18, scale: 8 }).notNull(),
    twap30m: numeric("twap_30m", { precision: 18, scale: 8 }),
    change24h: numeric("change_24h", { precision: 8, scale: 4 }),
    capturedAt: timestamp("captured_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("idx_oracle_source").on(t.source), index("idx_oracle_captured").on(t.capturedAt)]
);

export const stakingTiers = pgTable(
  "staking_tiers",
  {
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .primaryKey(),
    omaStaked: numeric("oma_staked", { precision: 18, scale: 2 }).default("0").notNull(),
    discountPercent: integer("discount_percent").default(0).notNull(),
    cooldownUntil: timestamp("cooldown_until", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  }
);

export const teamRoleEnum = pgEnum("team_role", ["owner", "admin", "member", "billing"]);

export const teams = pgTable("teams", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  billingEmail: text("billing_email"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const teamMembers = pgTable(
  "team_members",
  {
    teamId: uuid("team_id")
      .references(() => teams.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    role: teamRoleEnum("role").default("member").notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("idx_team_members_team").on(t.teamId),
    index("idx_team_members_user").on(t.userId),
    index("idx_team_members_team_user").on(t.teamId, t.userId),
  ]
);

export const ssoConnections = pgTable(
  "sso_connections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    teamId: uuid("team_id")
      .references(() => teams.id, { onDelete: "cascade" })
      .notNull(),
    provider: text("provider").notNull(),
    domain: text("domain").notNull().unique(),
    metadata: text("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("idx_sso_connections_team").on(t.teamId),
    index("idx_sso_connections_domain").on(t.domain),
  ]
);

export const teamsRelations = relations(teams, ({ many }) => ({
  members: many(teamMembers),
  ssoConnections: many(ssoConnections),
}));

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  team: one(teams, { fields: [teamMembers.teamId], references: [teams.id] }),
  user: one(users, { fields: [teamMembers.userId], references: [users.id] }),
}));

export const ssoConnectionsRelations = relations(ssoConnections, ({ one }) => ({
  team: one(teams, { fields: [ssoConnections.teamId], references: [teams.id] }),
}));

export const budgetAlertTypeEnum = pgEnum("budget_alert_type", [
  "50_percent",
  "75_percent",
  "90_percent",
  "100_percent",
]);

export const notificationChannelEnum = pgEnum("notification_channel", [
  "email",
  "webhook",
  "both",
]);

export const budgetAlerts = pgTable(
  "budget_alerts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    budgetLimitCents: numeric("budget_limit_cents", { precision: 18, scale: 2 }).notNull(),
    alertThresholds: integer("alert_thresholds").array().default([50, 75, 90, 100]).notNull(), // SYNC-39: migrated from text to integer[]
    emailEnabled: boolean("email_enabled").default(true).notNull(),
    webhookEnabled: boolean("webhook_enabled").default(false).notNull(),
    webhookUrl: text("webhook_url"),
    lastAlertAt: timestamp("last_alert_at", { withTimezone: true }),
    dailyLimitCents: numeric("daily_limit_cents", { precision: 18, scale: 2 }),
    weeklyLimitCents: numeric("weekly_limit_cents", { precision: 18, scale: 2 }),
    monthlyLimitCents: numeric("monthly_limit_cents", { precision: 18, scale: 2 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("idx_budget_alerts_user").on(t.userId),
  ]
);

export const budgetAlertHistory = pgTable(
  "budget_alert_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    alertType: budgetAlertTypeEnum("alert_type").notNull(),
    thresholdPercent: integer("threshold_percent").notNull(),
    spentCents: numeric("spent_cents", { precision: 18, scale: 2 }).notNull(),
    budgetLimitCents: numeric("budget_limit_cents", { precision: 18, scale: 2 }).notNull(),
    notificationSent: boolean("notification_sent").default(false).notNull(),
    notificationChannel: notificationChannelEnum("notification_channel"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("idx_budget_alert_history_user").on(t.userId),
    index("idx_budget_alert_history_created").on(t.createdAt),
    index("idx_budget_alert_history_user_alert").on(t.userId, t.alertType),
  ]
);

export const budgetAlertsRelations = relations(budgetAlerts, ({ one }) => ({
  user: one(users, { fields: [budgetAlerts.userId], references: [users.id] }),
}));

export const budgetAlertHistoryRelations = relations(budgetAlertHistory, ({ one }) => ({
  user: one(users, { fields: [budgetAlertHistory.userId], references: [users.id] }),
}));

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "active",
  "canceled",
  "past_due",
  "expired",
]);

export const plans = pgTable("plans", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().unique(),
  price: integer("price").notNull(),
  credits: integer("credits").notNull(),
  features: text("features").notNull().default("[]"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    planId: uuid("plan_id")
      .references(() => plans.id, { onDelete: "set null" })
      .notNull(),
    status: subscriptionStatusEnum("status").default("active").notNull(),
    currentPeriodStart: timestamp("current_period_start", { withTimezone: true }).notNull(),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }).notNull(),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("idx_subscriptions_user").on(t.userId),
    index("idx_subscriptions_status").on(t.status),
    index("idx_subscriptions_period_end").on(t.currentPeriodEnd),
  ]
);

export const invoiceStatusEnum = pgEnum("invoice_status", [
  "draft",
  "pending",
  "paid",
  "overdue",
  "cancelled",
]);

export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    invoiceNumber: text("invoice_number").notNull().unique(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
    status: invoiceStatusEnum("status").default("draft").notNull(),
    lineItems: jsonb("line_items").notNull(), // SYNC-39: migrated from text to jsonb
    dueDate: timestamp("due_date", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("idx_invoices_user").on(t.userId),
    index("idx_invoices_status").on(t.status),
    index("idx_invoices_number").on(t.invoiceNumber),
    index("idx_invoices_due_date").on(t.dueDate),
  ]
);

export const invoicesRelations = relations(invoices, ({ one }) => ({
  user: one(users, { fields: [invoices.userId], references: [users.id] }),
}));

export const auditActionEnum = pgEnum("audit_action", [
  "USER_LOGIN",
  "USER_LOGOUT",
  "API_KEY_CREATED",
  "API_KEY_REVOKED",
  "USER_CREATED",
  "USER_UPDATED",
  "USER_DELETED",
  "TEAM_MEMBER_ADDED",
  "TEAM_MEMBER_REMOVED",
  "TEAM_MEMBER_ROLE_CHANGED",
  "DEPOSIT_CREATED",
  "DEPOSIT_COMPLETED",
  "DEPOSIT_FAILED",
  "WITHDRAWAL_CREATED",
  "WITHDRAWAL_COMPLETED",
  "WITHDRAWAL_FAILED",
  "FEE_CHANGED",
  "RATE_LIMIT_OVERRIDE_SET",
  "RATE_LIMIT_OVERRIDE_REMOVED",
  "SPEND_LIMIT_CHANGED",
  "BUDGET_ALERT_CHANGED",
  "ACCOUNT_LOGIN_RATE_LIMITED",
  "PROVIDER_TEST_FAILED",
  "PROVIDER_TEST_SUCCESS",
  "REFUND_GRANTED",
  "REFUND_DENIED",
]);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "set null" }),
    action: auditActionEnum("action").notNull(),
    resource: text("resource").notNull(),
    resourceId: uuid("resource_id"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    metadata: text("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("idx_audit_logs_user").on(t.userId),
    index("idx_audit_logs_action").on(t.action),
    index("idx_audit_logs_resource").on(t.resource),
    index("idx_audit_logs_resource_id").on(t.resourceId),
    index("idx_audit_logs_created").on(t.createdAt),
    index("idx_audit_logs_user_action").on(t.userId, t.action),
    index("idx_audit_logs_user_created").on(t.userId, t.createdAt),
    index("idx_audit_logs_user_action_created").on(t.userId, t.action, t.createdAt),
  ]
);

export const plansRelations = relations(plans, ({ many }) => ({
  subscriptions: many(subscriptions),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  user: one(users, { fields: [subscriptions.userId], references: [users.id] }),
  plan: one(plans, { fields: [subscriptions.planId], references: [plans.id] }),
}));

export const adminConfig = pgTable(
  "admin_config",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    key: text("key").notNull().unique(),
    value: text("value").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("idx_admin_config_key").on(t.key)]
);

export const rateLimitOverrides = pgTable(
  "rate_limit_overrides",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    targetType: text("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    rpm: integer("rpm"),
    tpm: integer("tpm"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("idx_rate_limit_overrides_target").on(t.targetType, t.targetId),
    index("idx_rate_limit_overrides_expiry").on(t.expiresAt),
  ]
);

export const recoveryStatusEnum = pgEnum("recovery_status", [
  "pending",
  "completed",
  "rejected",
  "expired",
]);

export const depositRecoveries = pgTable(
  "deposit_recoveries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    originalTxHash: text("original_tx_hash").notNull(),
    recoveryTxHash: text("recovery_tx_hash"),
    amountUsd: numeric("amount_usd", { precision: 18, scale: 8 }).notNull(),
    status: recoveryStatusEnum("status").default("pending").notNull(),
    rejectionReason: text("rejection_reason"),
    completedBy: uuid("completed_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    index("idx_deposit_recoveries_user").on(t.userId),
    index("idx_deposit_recoveries_status").on(t.status),
    index("idx_deposit_recoveries_original_tx").on(t.originalTxHash),
    index("idx_deposit_recoveries_created").on(t.createdAt),
  ]
);

export const depositNotifications = pgTable(
  "deposit_notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    depositId: uuid("deposit_id")
      .references(() => deposits.id, { onDelete: "cascade" })
      .notNull(),
    type: text("type").notNull(),
    status: text("status").notNull(),
    amountUsd: numeric("amount_usd", { precision: 18, scale: 8 }),
    creditsIssued: numeric("credits_issued", { precision: 18, scale: 8 }),
    txHash: text("tx_hash"),
    method: text("method"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    notifiedAt: timestamp("notified_at", { withTimezone: true }),
  },
  (t) => [
    index("idx_deposit_notifications_user").on(t.userId),
    index("idx_deposit_notifications_deposit").on(t.depositId),
    index("idx_deposit_notifications_created").on(t.createdAt),
  ]
);

export const webhookSubscriptions = pgTable(
  "webhook_subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    url: text("url").notNull(),
    event: text("event").notNull(),
    events: text("events").array(), // SYNC-39: migrated from text to text[]
    secret: text("secret"),
    active: boolean("active").default(true).notNull(),
    lastNotificationAt: timestamp("last_notification_at", { withTimezone: true }),
    lastNotificationStatus: text("last_notification_status"),
    notificationCount: integer("notification_count").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("idx_webhook_subscriptions_user").on(t.userId),
    index("idx_webhook_subscriptions_active").on(t.userId, t.active),
  ]
);

export const depositRecoveriesRelations = relations(depositRecoveries, ({ one }) => ({
  user: one(users, { fields: [depositRecoveries.userId], references: [users.id] }),
}));

export const depositNotificationsRelations = relations(depositNotifications, ({ one }) => ({
  user: one(users, { fields: [depositNotifications.userId], references: [users.id] }),
  deposit: one(deposits, { fields: [depositNotifications.depositId], references: [deposits.id] }),
}));

export const webhookSubscriptionsRelations = relations(webhookSubscriptions, ({ one }) => ({
  user: one(users, { fields: [webhookSubscriptions.userId], references: [users.id] }),
}));

export const withdrawalStatusEnum = pgEnum("withdrawal_status", [
  "pending",
  "processing",
  "completed",
  "failed",
  "cancelled",
]);

export const withdrawals = pgTable(
  "withdrawals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    type: text("type").notNull(),
    amountCents: numeric("amount_cents", { precision: 18, scale: 2 }).notNull(),
    netAmountCents: numeric("net_amount_cents", { precision: 18, scale: 2 }).notNull(),
    feeCents: numeric("fee_cents", { precision: 18, scale: 2 }).notNull(),
    toAddress: text("to_address").notNull(),
    chainId: text("chain_id").default("8453").notNull(),
    status: withdrawalStatusEnum("status").default("pending").notNull(),
    txHash: text("tx_hash"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    index("idx_withdrawals_user").on(t.userId),
    index("idx_withdrawals_status").on(t.status),
    index("idx_withdrawals_txhash").on(t.txHash),
    index("idx_withdrawals_user_status").on(t.userId, t.status),
    index("idx_withdrawals_created_at").on(t.createdAt),
  ]
);

export const withdrawalsRelations = relations(withdrawals, ({ one }) => ({
  user: one(users, { fields: [withdrawals.userId], references: [users.id] }),
}));

export const byokKeys = pgTable(
  "byok_keys",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    byokKeyId: text("byok_key_id").notNull().unique(),
    provider: text("provider").notNull(),
    name: text("name").notNull(),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("idx_byok_keys_provider").on(t.provider),
    index("idx_byok_keys_byok_id").on(t.byokKeyId),
  ]
);
