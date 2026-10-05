/**
 * Reproduce the GET /v1/admin/usage/failover failure with the raw driver.
 *
 * scripts/verify-admin-usage.mjs reports "Failed query" without the Postgres
 * error code/message, which hides the actual cause. This runs the same SQL
 * through the plain `pg` client so the server's error text is visible.
 *
 * Usage: node --env-file=.env scripts/diagnose-failover-sql.mjs
 */
import { Client } from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
	console.error("DATABASE_URL is not set. Run with --env-file=.env");
	process.exit(1);
}

const client = new Client({ connectionString: url });
await client.connect();

// Probe each clause independently so the failing one is unambiguous.
const probes = {
	"does requested_model exist?": `SELECT requested_model FROM usage_records LIMIT 1`,
	"does attempt_count exist?": `SELECT attempt_count FROM usage_records LIMIT 1`,
	"GROUP BY requested_model": `
		SELECT requested_model AS key, COUNT(*)::int AS requests
		FROM usage_records
		WHERE requested_model IS NOT NULL
		GROUP BY requested_model
		LIMIT 5`,
	"ORDER BY a bare alias (the suspect)": `
		SELECT requested_model AS key,
			COUNT(*) FILTER (WHERE requested_model IS DISTINCT FROM model)::int AS failed_over
		FROM usage_records
		WHERE requested_model IS NOT NULL
		GROUP BY requested_model
		ORDER BY failed_over DESC
		LIMIT 5`,
	"the full endpoint query": `
		SELECT requested_model AS key,
			COUNT(*)::int AS requests,
			COUNT(*) FILTER (WHERE requested_model IS DISTINCT FROM model)::int AS failed_over,
			COALESCE(SUM(attempt_count), 0)::numeric AS total_attempts,
			COALESCE(SUM(total_cents), 0)::numeric AS total_cents
		FROM usage_records
		WHERE created_at >= $1 AND created_at <= $2
			AND requested_model IS NOT NULL
		GROUP BY requested_model
		ORDER BY failed_over DESC, requests DESC
		LIMIT 200`,
};

const params = [new Date(Date.now() - 30 * 86_400_000), new Date()];

// The date params are only bound for the final query. Passing them to every
// probe makes `pg` reject the placeholders-free statements with 08P01, which
// reads like a schema problem when it is really a script bug.
const withParams = new Set(["the full endpoint query"]);

for (const [label, sql] of Object.entries(probes)) {
	try {
		const res = withParams.has(label)
			? await client.query(sql, params)
			: await client.query(sql);
		console.log(`OK   ${label} (${res.rowCount} rows)`);
		if (res.rowCount > 0) console.log("      ", JSON.stringify(res.rows[0]));
	} catch (err) {
		console.error(`FAIL ${label}`);
		console.error(`     code=${err.code} ${err.message}`);
	}
}
await client.end();