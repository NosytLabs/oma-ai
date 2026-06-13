import { Hono } from "hono";
import { sessionAuth } from "../auth/middleware.js";
import { db } from "../db/client.js";
import { invoices, deposits, usageRecords, users } from "../db/schema.js";
import { eq, sql, desc } from "drizzle-orm";
import { nanoid } from "nanoid";
import { config } from "../config.js";
import type { OmaEnv } from "../types.js";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export const invoiceRoutes = new Hono<OmaEnv>();

invoiceRoutes.post("/v1/invoices/generate", sessionAuth, async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json();
  const periodStart = body.periodStart as string;
  const periodEnd = body.periodEnd as string;

  if (!periodStart || !periodEnd) {
    return c.json({ error: { message: "periodStart and periodEnd are required", type: "validation_error" } }, 400);
  }

  const startDate = new Date(periodStart);
  const endDate = new Date(periodEnd);

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) {
    return c.json({ error: { message: "User not found", type: "not_found" } }, 404);
  }

  const usageData = await db.select({
    model: usageRecords.model,
    totalCost: sql<string>`SUM(${usageRecords.totalCents})`,
    inputTokens: sql<string>`SUM(${usageRecords.inputTokens})`,
    outputTokens: sql<string>`SUM(${usageRecords.outputTokens})`,
    requestCount: sql<string>`COUNT(*)`,
  })
    .from(usageRecords)
    .where(sql`${usageRecords.userId} = ${userId} AND ${usageRecords.createdAt} BETWEEN ${startDate} AND ${endDate}`)
    .groupBy(usageRecords.model);

  const depositData = await db.select()
    .from(deposits)
    .where(sql`${deposits.userId} = ${userId} AND ${deposits.createdAt} BETWEEN ${startDate} AND ${endDate} AND ${deposits.status} = 'completed'`);

  const totalUsage = usageData.reduce((sum, r) => sum + parseFloat(r.totalCost), 0);
  const totalDeposits = depositData.reduce((sum, d) => sum + parseFloat(String(d.amountUsd)), 0);

  interface LineItem {
    description: string;
    quantity: number;
    unitPrice: string;
    total: string;
    details: Record<string, unknown>;
  }

  const lineItems: LineItem[] = usageData.map((r) => ({
    description: `AI Inference - ${r.model}`,
    quantity: parseInt(r.requestCount, 10),
    unitPrice: (parseFloat(r.totalCost) / parseInt(r.requestCount, 10) / 100).toFixed(4),
    total: (parseFloat(r.totalCost) / 100).toFixed(2),
    details: {
      inputTokens: parseInt(r.inputTokens, 10),
      outputTokens: parseInt(r.outputTokens, 10),
    },
  }));

  if (totalDeposits > 0) {
    lineItems.push({
      description: "Credits Deposited",
      quantity: depositData.length,
      unitPrice: (totalDeposits / depositData.length).toFixed(2),
      total: totalDeposits.toFixed(2),
      details: { depositCount: depositData.length },
    });
  }

  const invoiceNumber = `OMA-${new Date().getFullYear()}-${nanoid(8).toUpperCase()}`;
  const amount = (totalUsage / 100).toFixed(2);

  const [invoice] = await db.insert(invoices).values({
    invoiceNumber,
    userId,
    amount,
    status: "pending",
    lineItems: JSON.stringify(lineItems),
    dueDate: new Date(Date.now() + config.INVOICE_DEFAULT_DUE_DAYS * 24 * 60 * 60 * 1000),
  }).returning();

  return c.json({
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    amount: parseFloat(invoice.amount),
    status: invoice.status,
    periodStart,
    periodEnd,
    lineItems,
    dueDate: invoice.dueDate,
    createdAt: invoice.createdAt,
  });
});

invoiceRoutes.get("/v1/invoices", sessionAuth, async (c) => {
  const userId = c.get("userId");
  const limit = Math.min(parseInt(c.req.query("limit") || "20", 10), 100);
  const offset = parseInt(c.req.query("offset") || "0", 10);

  const userInvoices = await db.select()
    .from(invoices)
    .where(eq(invoices.userId, userId))
    .orderBy(desc(invoices.createdAt))
    .limit(limit)
    .offset(offset);

  return c.json({
    invoices: userInvoices.map((inv) => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      amount: parseFloat(inv.amount),
      status: inv.status,
      lineItems: JSON.parse(inv.lineItems),
      dueDate: inv.dueDate,
      createdAt: inv.createdAt,
    })),
    pagination: { limit, offset, hasMore: userInvoices.length === limit },
  });
});

invoiceRoutes.get("/v1/invoices/:id", sessionAuth, async (c) => {
  const userId = c.get("userId");
  const invoiceId = c.req.param("id") as string;

  const [invoice] = await db.select()
    .from(invoices)
    .where(eq(invoices.id, invoiceId))
    .limit(1);

  if (!invoice) {
    return c.json({ error: { message: "Invoice not found", type: "not_found" } }, 404);
  }

  if (invoice.userId !== userId) {
    return c.json({ error: { message: "Unauthorized", type: "authentication_error" } }, 403);
  }

  return c.json({
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    amount: parseFloat(invoice.amount),
    status: invoice.status,
    lineItems: JSON.parse(invoice.lineItems),
    dueDate: invoice.dueDate,
    createdAt: invoice.createdAt,
  });
});

invoiceRoutes.get("/v1/invoices/:id/pdf", sessionAuth, async (c) => {
  const userId = c.get("userId");
  const invoiceId = c.req.param("id") as string;

  const [invoice] = await db.select()
    .from(invoices)
    .where(eq(invoices.id, invoiceId))
    .limit(1);

  if (!invoice) {
    return c.json({ error: { message: "Invoice not found", type: "not_found" } }, 404);
  }

  if (invoice.userId !== userId) {
    return c.json({ error: { message: "Unauthorized", type: "authentication_error" } }, 403);
  }

  const lineItems = JSON.parse(invoice.lineItems);

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Invoice ${invoice.invoiceNumber}</title>
  <style>
    body { font-family: 'Helvetica Neue', Arial, sans-serif; margin: 40px; color: #333; }
    .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
    .company { font-size: 24px; font-weight: bold; color: #00FFC8; }
    .invoice-info { text-align: right; }
    .invoice-number { font-size: 18px; font-weight: bold; }
    .section { margin-bottom: 30px; }
    .section-title { font-size: 14px; color: #666; margin-bottom: 10px; text-transform: uppercase; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #eee; }
    th { background: #f8f8f8; font-weight: 600; }
    .total { font-size: 18px; font-weight: bold; text-align: right; margin-top: 20px; }
    .footer { margin-top: 40px; font-size: 12px; color: #999; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="company">OMA AI</div>
      <div>Permissionless AI Inference Gateway</div>
    </div>
    <div class="invoice-info">
      <div class="invoice-number">Invoice ${escapeHtml(invoice.invoiceNumber)}</div>
      <div>Date: ${new Date(invoice.createdAt).toLocaleDateString()}</div>
      <div>Due: ${new Date(invoice.dueDate).toLocaleDateString()}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Bill To</div>
    <div>${escapeHtml(invoice.userId)}</div>
  </div>

  <div class="section">
    <div class="section-title">Services</div>
    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th>Quantity</th>
          <th>Unit Price</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
        ${lineItems.map((item: { description: string; quantity: number; unitPrice: string; total: string }) => `
          <tr>
            <td>${escapeHtml(item.description)}</td>
            <td>${item.quantity}</td>
            <td>$${escapeHtml(item.unitPrice)}</td>
            <td>$${escapeHtml(item.total)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <div class="total">
    Total: $${escapeHtml(invoice.amount)}
  </div>

  <div class="footer">
    <p>Thank you for using OMA AI Gateway.</p>
    <p>Questions? Contact support@oma-ai.com</p>
  </div>
</body>
</html>
  `;

  c.header("Content-Type", "text/html");
  return c.body(html);
});