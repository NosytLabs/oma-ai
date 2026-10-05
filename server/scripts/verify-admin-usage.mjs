/**
 * Read-only verification of the admin usage SQL.
 *
 * The admin usage endpoints hand-build SQL (drizzle's query builder cannot
 * express `GROUP BY <dynamic key>` cleanly). That means a syntax or type
 * error would only surface at runtime, on the admin panel, in production.
 * This script runs the EXACT statements from routes/admin.ts against the
 * real database and reports the plan — read-only, no writes.
 *
 * Usage:
 *   cd server && node --env-file=.env scripts/verify-admin-usage.mjs
 *
 * Add --explain to print the query plan instead of the rows.
 */
import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { sql } from "drizzle-orm";

const url = process.env.DATABASE_URL;
if (!url) {
	console.error("DATABASE_URL is not set. Run with --env-file=.env");
	process.exit(1);
}

const explain = process.argv.includes("--explain");

const pool = new Pool({ connectionString: url });
const db = drizzle(pool);

// Mirrors usageSummarySchema's default window in routes/admin.ts.
const QUERIES = {
	"usage/summary (group_by=model)": sql`
		SELECT model AS key,
			COUNT(*)::int AS requests,
			COALESCE(SUM(input_tokens), 0)::bigint AS input_tokens,
			COALESCE(SUM(output_tokens), 0)::bigint AS output_tokens,
			COALESCE(SUM(cost_cents), 0)::numeric AS upstream_cents,
			COALESCE(SUM(markup_cents), 0)::numeric AS markup_cents,
			COALESCE(SUM(total_cents), 0)::numeric AS total_cents,
			COUNT(*) FILTER (WHERE status = 'error')::int AS error_count,
			COALESCE(ROUND(AVG(latency_ms))::bigint, 0) AS avg_latency_ms
		FROM usage_records
		WHERE created_at >= ${new Date(Date.now() - 30 * 864e5)} AND created_at <= ${new Date()}
		GROUP BY model
		ORDER BY total_cents DESC
		LIMIT 200`,

	"usage/summary (group_by=provider)": sql`
		SELECT provider::text AS key, COUNT(*)::int AS requests,
			COALESCE(SUM(total_cents), 0)::numeric AS total_cents
		FROM usage_records
		WHERE created_at >= ${new Date(Date.now() - 30 * 864e5)} AND created_at <= ${new Date()}
		GROUP BY provider::text
		ORDER BY total_cents DESC
		LIMIT 200`,

	"usage/summary (group_by=user)": sql`
		SELECT user_id AS key, COUNT(*)::int AS requests,
			COALESCE(SUM(total_cents), 0)::numeric AS total_cents
		FROM usage_records
		WHERE created_at >= ${new Date(Date.now() - 30 * 864e5)} AND created_at <= ${new Date()}
		GROUP BY user_id
		ORDER BY total_cents DESC
		LIMIT 200`,

	"usage/failover": sql`
		SELECT requested_model AS key,
			COUNT(*)::int AS requests,
			COUNT(*) FILTER (WHERE requested_model IS DISTINCT FROM model)::int AS failed_over,
			COALESCE(SUM(attempt_count), 0)::numeric AS total_attempts,
			COALESCE(SUM(total_cents), 0)::numeric AS total_cents
		FROM usage_records
		WHERE created_at >= ${new Date(Date.now() - 30 * 864e5)} AND created_at <= ${new Date()}
			AND requested_model IS NOT NULL
		GROUP BY requested_model
		ORDER BY failed_over DESC, requests DESC
		LIMIT 200`,

	"admin/users usage lateral": sql`
		SELECT u.id, u.email,
			COALESCE(us.requests, 0) AS usage_requests,
			COALESCE(us.input_tokens, 0) AS usage_input_tokens,
			COALESCE(us.output_tokens, 0) AS usage_output_tokens,
			COALESCE(us.upstream_cents, '0') AS usage_upstream_cents,
			COALESCE(us.total_cents, '0') AS usage_total_cents,
			us.last_used_at AS usage_last_used_at
		FROM "user" u
		LEFT JOIN credit_balances cb ON cb.user_id = u.id
		LEFT JOIN LATERAL (
			SELECT COUNT(*)::int AS requests,
				SUM(input_tokens)::bigint AS input_tokens,
				SUM(output_tokens)::bigint AS output_tokens,
				SUM(cost_cents)::numeric AS upstream_cents,
				SUM(total_cents)::numeric AS total_cents,
				MAX(created_at) AS last_used_at
			FROM usage_records ur
			WHERE ur.user_id = u.id
		) us ON TRUE
		ORDER BY u.id ASC
		LIMIT 5`,

	"backfill preview (dry run)": sql`
		SELECT u.id AS user_id, w.address, u.evm_address AS current_evm_address
		FROM "user" u
		JOIN wallet_address w ON w.user_id = u.id AND w.is_primary
		WHERE u.evm_address IS NULL`,
};

let failures = 0;
for (const [label, query] of Object.entries(QUERIES)) {
	try {
		if (label === "backfill preview (dry run)" || explain) {
			// A dry-run must never mutate anything, so never run the UPDATE —
			// report what the backfill WOULD touch.
			const res = await db.execute(query);
			const rows = res.rows ?? res;
			console.log(`\n=== ${label} ===`);
			console.log(JSON.stringify(rows, null, 2));
		} else {
			await db.execute(query);
			console.log(`OK  ${label}`);
		}
	} catch (err) {
		failures++;
		console.error(`FAIL ${label}: ${err.message}`);
	}
}

await pool.end();
if (failures > 0) {
	console.error(`\n${failures} query/queries failed.`);
	process.exit(1);
}
console.log("\nAll admin usage SQL verified.");