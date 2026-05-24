import { Hono } from "hono";
import { z } from "zod";
import { bearerAuth } from "../auth/middleware.js";
import { db } from "../db/client.js";
import { plans, subscriptions, creditBalances, creditBatches } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { validationError } from "../lib/validation.js";
import type { OmaEnv } from "../types.js";

export const subscriptionRoutes = new Hono<OmaEnv>();

const DEFAULT_PLANS = [
  {
    id: "00000000-0000-0000-0000-000000000001",
    name: "Free",
    price: 0,
    credits: 100,
    features: JSON.stringify(["100 credits/month", "Basic models", "Community support"]),
  },
  {
    id: "00000000-0000-0000-0000-000000000002",
    name: "Pro",
    price: 2900,
    credits: 5000,
    features: JSON.stringify(["5000 credits/month", "All models", "Priority support", "No rate limits"]),
  },
  {
    id: "00000000-0000-0000-0000-000000000003",
    name: "Team",
    price: 9900,
    credits: 25000,
    features: JSON.stringify(["25000 credits/month", "All models", "Dedicated support", "No rate limits", "Team management"]),
  },
];

async function ensureDefaultPlans(): Promise<void> {
  for (const plan of DEFAULT_PLANS) {
    const existing = await db.select().from(plans).where(eq(plans.name, plan.name)).limit(1);
    if (existing.length === 0) {
      await db.insert(plans).values(plan);
    }
  }
}

subscriptionRoutes.get("/v1/plans", async (c) => {
  await ensureDefaultPlans();
  const allPlans = await db.select().from(plans).orderBy(plans.price);
  return c.json({
    plans: allPlans.map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      credits: p.credits,
      features: JSON.parse(p.features),
    })),
  });
});

const subscribeSchema = z.object({
  planId: z.string().uuid(),
});

subscriptionRoutes.post("/v1/subscriptions", bearerAuth, async (c) => {
  const userId = c.get("userId");
  const parsed = subscribeSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json(validationError(parsed.error), 400);

  const { planId } = parsed.data;

  const [plan] = await db.select().from(plans).where(eq(plans.id, planId)).limit(1);
  if (!plan) {
    return c.json({ error: { message: "Plan not found", type: "not_found" } }, 404);
  }

  if (plan.price === 0) {
    return c.json({ error: { message: "Cannot subscribe to free plan", type: "invalid_request_error" } }, 400);
  }

  const existingSub = await db.select().from(subscriptions).where(
    and(eq(subscriptions.userId, userId), eq(subscriptions.status, "active"))
  ).limit(1);

  if (existingSub.length > 0) {
    return c.json({ error: { message: "Already subscribed. Cancel current subscription first.", type: "conflict" } }, 409);
  }

  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  const [subscription] = await db.insert(subscriptions).values({
    userId,
    planId,
    status: "active",
    currentPeriodStart: now,
    currentPeriodEnd: periodEnd,
    cancelAtPeriodEnd: false,
  }).returning();

  await db.insert(creditBatches).values({
    userId,
    amountCents: String(plan.credits),
    remainingCents: String(plan.credits),
    expiresAt: periodEnd,
    paymentMethod: "subscription",
  });

  const [balance] = await db.select().from(creditBalances).where(eq(creditBalances.userId, userId)).limit(1);
  if (balance) {
    await db.update(creditBalances).set({
      balanceCents: String(Number(balance.balanceCents) + plan.credits),
      lastActivityAt: now,
      updatedAt: now,
    }).where(eq(creditBalances.userId, userId));
  }

  return c.json({
    subscription: {
      id: subscription.id,
      planId: subscription.planId,
      status: subscription.status,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    },
  }, 201);
});

subscriptionRoutes.get("/v1/subscriptions/me", bearerAuth, async (c) => {
  const userId = c.get("userId");

  const [subscription] = await db.select({
    id: subscriptions.id,
    planId: subscriptions.planId,
    status: subscriptions.status,
    currentPeriodStart: subscriptions.currentPeriodStart,
    currentPeriodEnd: subscriptions.currentPeriodEnd,
    cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd,
    createdAt: subscriptions.createdAt,
    planName: plans.name,
    planPrice: plans.price,
    planCredits: plans.credits,
    planFeatures: plans.features,
  })
    .from(subscriptions)
    .innerJoin(plans, eq(subscriptions.planId, plans.id))
    .where(and(eq(subscriptions.userId, userId), eq(subscriptions.status, "active")))
    .limit(1);

  if (!subscription) {
    return c.json({ subscription: null });
  }

  return c.json({
    subscription: {
      id: subscription.id,
      planId: subscription.planId,
      status: subscription.status,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      createdAt: subscription.createdAt,
      plan: {
        name: subscription.planName,
        price: subscription.planPrice,
        credits: subscription.planCredits,
        features: JSON.parse(subscription.planFeatures),
      },
    },
  });
});

subscriptionRoutes.delete("/v1/subscriptions/me", bearerAuth, async (c) => {
  const userId = c.get("userId");

  const [subscription] = await db.select().from(subscriptions).where(
    and(eq(subscriptions.userId, userId), eq(subscriptions.status, "active"))
  ).limit(1);

  if (!subscription) {
    return c.json({ error: { message: "No active subscription found", type: "not_found" } }, 404);
  }

  await db.update(subscriptions).set({
    cancelAtPeriodEnd: true,
    updatedAt: new Date(),
  }).where(eq(subscriptions.id, subscription.id));

  return c.json({ success: true, canceledAtPeriodEnd: true });
});