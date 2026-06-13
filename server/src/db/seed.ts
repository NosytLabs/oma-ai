// Database seed script. Idempotent: safe to run multiple times.
// Populates:
//   - plans: subscription tiers visible on /pricing
//   - admin_config: fee + rate-limit defaults
//   - provider_health: initial state for all known providers
//
// Usage:  npm run db:seed

import { db } from "./client.js";
import { plans, adminConfig, providerHealth } from "./schema.js";
import { sql } from "drizzle-orm";
import { logger } from "../lib/logger.js";

const DEFAULT_PLANS = [
  {
    name: "Free",
    price: 0,
    credits: 1000, // ~$1 worth of inference
    features: JSON.stringify([
      "1,000 credits / month",
      "Access to budget models",
      "Community support",
      "Standard rate limits",
    ]),
  },
  {
    name: "Starter",
    price: 1900, // $19
    credits: 25000, // $25
    features: JSON.stringify([
      "25,000 credits / month",
      "Access to all models",
      "Email support",
      "Higher rate limits",
    ]),
  },
  {
    name: "Pro",
    price: 4900, // $49
    credits: 75000, // $75
    features: JSON.stringify([
      "75,000 credits / month",
      "Access to all models including reasoning",
      "Priority support",
      "Pro rate limits",
    ]),
  },
  {
    name: "Business",
    price: 19900, // $199
    credits: 350000, // $350
    features: JSON.stringify([
      "350,000 credits / month",
      "Access to all models",
      "Dedicated support",
      "Custom rate limits",
      "SLA",
    ]),
  },
  {
    name: "Enterprise",
    price: 99900, // $999
    credits: 2000000, // $2,000
    features: JSON.stringify([
      "2,000,000 credits / month",
      "Access to all models",
      "Dedicated account manager",
      "Custom rate limits & volume discounts",
      "99.9% SLA",
      "Invoice billing",
    ]),
  },
];

// OMA is a pure Venice reseller. Users see one provider, one flat
// markup. Upstream discount markets (CheapTokens, Surplus) are
// operator-internal and never surfaced in pricing.
const DEFAULT_FEE_CONFIG = {
  providers: {
    venice: { markupPercent: 25 },
  },
};

const DEFAULT_RATE_LIMIT_CONFIG = {
  tiers: {
    free: { rpm: 60, tpm: 10000 },
    basic: { rpm: 120, tpm: 50000 },
    pro: { rpm: 300, tpm: 200000 },
    enterprise: { rpm: 1000, tpm: 1000000 },
  },
};

const PROVIDERS = ["venice", "antseed", "litellm", "openrouter", "together", "deepinfra", "tinyfish", "groq", "cerebras", "bedrock"] as const;

async function seedPlans() {
  let inserted = 0;
  for (const plan of DEFAULT_PLANS) {
    const existing = await db.select().from(plans).where(sql`${plans.name} = ${plan.name}`).limit(1);
    if (existing.length === 0) {
      await db.insert(plans).values(plan);
      inserted++;
      logger.info({ name: plan.name }, "[seed] inserted plan");
    } else {
      logger.debug({ name: plan.name }, "[seed] plan already exists, skipping");
    }
  }
  return inserted;
}

async function seedAdminConfig() {
  const rows = [
    { key: "fee_config", value: JSON.stringify(DEFAULT_FEE_CONFIG) },
    { key: "rate_limit_config", value: JSON.stringify(DEFAULT_RATE_LIMIT_CONFIG) },
  ];
  let upserted = 0;
  for (const row of rows) {
    const existing = await db.select().from(adminConfig).where(sql`${adminConfig.key} = ${row.key}`).limit(1);
    if (existing.length === 0) {
      await db.insert(adminConfig).values(row);
      upserted++;
      logger.info({ key: row.key }, "[seed] inserted admin_config row");
    } else {
      logger.debug({ key: row.key }, "[seed] admin_config row already exists, skipping");
    }
  }
  return upserted;
}

async function seedProviderHealth() {
  let inserted = 0;
  for (const provider of PROVIDERS) {
    try {
      const existing = await db.select().from(providerHealth).where(sql`${providerHealth.provider} = ${provider}`).limit(1);
      if (existing.length === 0) {
        await db.insert(providerHealth).values({ provider, isUp: true });
        inserted++;
        logger.info({ provider }, "[seed] inserted provider_health row");
      }
    } catch (err) {
      // enum constraint - skip providers not in the enum
      logger.debug({ provider, err: (err as Error).message }, "[seed] provider not in enum, skipping");
    }
  }
  return inserted;
}

async function main() {
  logger.info("[seed] starting database seed");
  const t0 = Date.now();

  const planInserts = await seedPlans();
  const configInserts = await seedAdminConfig();
  const healthInserts = await seedProviderHealth();

  logger.info(
    {
      plans: planInserts,
      adminConfig: configInserts,
      providerHealth: healthInserts,
      durationMs: Date.now() - t0,
    },
    "[seed] complete"
  );

  // Show summary
  const planCount = await db.select({ count: sql<number>`count(*)::int` }).from(plans);
  const configCount = await db.select({ count: sql<number>`count(*)::int` }).from(adminConfig);
  logger.info(
    {
      totalPlans: planCount[0]?.count ?? 0,
      totalAdminConfig: configCount[0]?.count ?? 0,
    },
    "[seed] final state"
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error({ err: err.message, stack: err.stack }, "[seed] failed");
    process.exit(1);
  });
