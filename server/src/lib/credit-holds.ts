import { sql } from "drizzle-orm";
import { db } from "../db/client.js";

/** Decimal strings preserve the ledger's fractional-cent precision. */
export async function readCreditHoldTotals(userId: string): Promise<{ reservedCents: string; reconciliationCents: string }> {
	const result = await db.execute(sql`SELECT
		COALESCE(SUM(reserved_cents) FILTER (WHERE state='held'),0)::text AS reserved,
		COALESCE(SUM(reserved_cents) FILTER (WHERE state='reconciliation'),0)::text AS reconciliation
		FROM inference_credit_reservations WHERE user_id=${userId}`);
	return { reservedCents: String(result.rows[0]?.reserved ?? "0"), reconciliationCents: String(result.rows[0]?.reconciliation ?? "0") };
}
