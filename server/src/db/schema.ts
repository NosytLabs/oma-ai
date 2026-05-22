import {
  pgTable,
  uuid,
  text,
  numeric,
  timestamp,
  integer,
  boolean,
  index,
  pgEnum,
} from "drizzle-orm/pg-core";

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
  "oma_token",
  "houdini_swap",
  "cctp_crosschain",
  "lifi_swap",
  "jupiter_swap",
  "solana_direct",
]);

export const providerEnum = pgEnum("provider", ["venice", "antseed", "litellm"]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  address: text("address").notNull().unique(),
  solanaAddress: text("solana_address"),
  accountNumber: text("account_number"), // Mullvad-style: OMA-XXXX-XXXX-XXXX (unique, nullable)
  accountNumberHash: text("account_number_hash"), // SHA256 hash for lookup
  nonce: text("nonce").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

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
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("idx_api_keys_hash").on(t.keyHash), index("idx_api_keys_user").on(t.userId)]
);

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
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("idx_usage_user").on(t.userId),
    index("idx_usage_model").on(t.model),
    index("idx_usage_created").on(t.createdAt),
  ]
);

export const stakingTiers = pgTable("staking_tiers", {
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .primaryKey(),
  omaStaked: numeric("oma_staked", { precision: 18, scale: 8 }).default("0").notNull(),
  discountPercent: integer("discount_percent").default(0).notNull(),
  cooldownUntil: timestamp("cooldown_until", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

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
    depositId: uuid("deposit_id")
      .references(() => deposits.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("idx_credit_batches_user").on(t.userId),
    index("idx_credit_batches_expiry").on(t.expiresAt),
    index("idx_credit_batches_user_expiry_remaining").on(t.userId, t.expiresAt, t.remainingCents),
  ]
);

import { relations } from "drizzle-orm";

export const usersRelations = relations(users, ({ many }) => ({
  apiKeys: many(apiKeys),
  deposits: many(deposits),
  creditBalances: many(creditBalances),
  usageRecords: many(usageRecords),
  stakingTiers: many(stakingTiers),
  creditBatches: many(creditBatches),
}));

export const apiKeysRelations = relations(apiKeys, ({ one, many }) => ({
  user: one(users, { fields: [apiKeys.userId], references: [users.id] }),
  usageRecords: many(usageRecords),
}));

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

export const stakingTiersRelations = relations(stakingTiers, ({ one }) => ({
  user: one(users, { fields: [stakingTiers.userId], references: [users.id] }),
}));

export const creditBatchesRelations = relations(creditBatches, ({ one }) => ({
  user: one(users, { fields: [creditBatches.userId], references: [users.id] }),
  deposit: one(deposits, { fields: [creditBatches.depositId], references: [deposits.id] }),
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
