import { Hono } from "hono";
import { z } from "zod";
import { db } from "../../db/client.js";
import { invoices, users } from "../../db/schema.js";
import { eq, desc, count, and } from "drizzle-orm";
import type { OmaEnv } from "../../types.js";

const lineItemSchema = z.object({
  description: z.string().min(1).max(500),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
  total: z.number().nonnegative(),
});

const createInvoiceSchema = z.object({
  userId: z.string().uuid(),
  amount: z.number().positive(),
  lineItems: z.array(lineItemSchema).min(1),
  dueDate: z.string().datetime({ offset: true }),
});

export const invoicesRoutes = new Hono<OmaEnv>();

invoicesRoutes.post("/admin/invoices", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = createInvoiceSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: { message: "Invalid request", type: "invalid_request_error", issues: parsed.error.flatten() } },
      400
    );
  }

  const { userId, amount, lineItems, dueDate } = parsed.data;

  try {
    const userResult = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!userResult.length) {
      return c.json({ error: { message: "User not found", type: "not_found" } }, 404);
    }

    const lastInvoice = await db.select({ invoiceNumber: invoices.invoiceNumber })
      .from(invoices)
      .orderBy(desc(invoices.createdAt))
      .limit(1);

    let nextNumber = 1;
    if (lastInvoice.length > 0) {
      const lastNum = lastInvoice[0].invoiceNumber;
      const match = lastNum.match(/INV-(\d{4})-(\d+)/);
      if (match) {
        const year = parseInt(match[1], 10);
        const seq = parseInt(match[2], 10);
        const currentYear = new Date().getFullYear();
        nextNumber = year === currentYear ? seq + 1 : 1;
      }
    }

    const year = new Date().getFullYear();
    const invoiceNumber = `INV-${year}-${String(nextNumber).padStart(5, "0")}`;

    const lineItemsJson = JSON.stringify(lineItems);

    const result = await db.insert(invoices).values({
      invoiceNumber,
      userId,
      amount: amount.toString(),
      status: "pending",
      lineItems: lineItemsJson,
      dueDate: new Date(dueDate),
    }).returning();

    return c.json({ invoice: result[0] }, 201);
  } catch (err) {
    console.error('Admin create invoice error:', err);
    return c.json({ error: { message: "Internal server error" } }, 500);
  }
});

invoicesRoutes.get("/admin/invoices/:id", async (c) => {
  const invoiceId = c.req.param("id");

  try {
    const invoiceResult = await db.select()
      .from(invoices)
      .where(eq(invoices.id, invoiceId))
      .limit(1);

    if (!invoiceResult.length) {
      return c.json({ error: { message: "Invoice not found", type: "not_found" } }, 404);
    }

    const invoice = invoiceResult[0];
    const userResult = await db.select({
      id: users.id,
      address: users.address,
      accountNumber: users.accountNumber,
    }).from(users).where(eq(users.id, invoice.userId)).limit(1);

    return c.json({
      invoice: {
        ...invoice,
        amount: Number(invoice.amount),
        lineItems: invoice.lineItems as Record<string, unknown>[],
        user: userResult[0] || null,
      },
    });
  } catch (err) {
    console.error('Admin invoice detail error:', err);
    return c.json({ error: { message: "Internal server error" } }, 500);
  }
});

invoicesRoutes.get("/admin/invoices", async (c) => {
  const page = Math.max(parseInt(c.req.query("page") || "1", 10), 1);
  const limit = Math.min(parseInt(c.req.query("limit") || "50", 10), 100);
  const offset = (page - 1) * limit;
  const status = c.req.query("status");
  const userIdFilter = c.req.query("userId");

  try {
    const conditions = [];
    if (status) {
      conditions.push(eq(invoices.status, status as "draft" | "pending" | "paid" | "overdue" | "cancelled"));
    }
    if (userIdFilter) {
      conditions.push(eq(invoices.userId, userIdFilter));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const results = await db.select({
      id: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      userId: invoices.userId,
      amount: invoices.amount,
      status: invoices.status,
      dueDate: invoices.dueDate,
      createdAt: invoices.createdAt,
      userAddress: users.address,
    })
    .from(invoices)
    .leftJoin(users, eq(invoices.userId, users.id))
    .where(whereClause)
    .orderBy(desc(invoices.createdAt))
    .limit(limit)
    .offset(offset);

    const totalResult = await db.select({ count: count() }).from(invoices).where(whereClause);
    const total = totalResult[0]?.count || 0;

    return c.json({
      invoices: results.map((inv) => ({
        ...inv,
        amount: Number(inv.amount),
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('Admin invoices list error:', err);
    return c.json({ error: { message: "Internal server error" } }, 500);
  }
});