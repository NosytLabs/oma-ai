/**
 * Production migration runner + schema preflight.
 *
 * Applies pending migrations with Drizzle's migrator, preserving its journal,
 * then verifies every table declared in `src/db/schema.ts`. A missing table is
 * a hard failure: /ready establishes connectivity, not schema completeness.
 *
 * Usage:
 *   node scripts/migrate-prod.mjs            # migrate, then verify
 *   node scripts/migrate-prod.mjs --check    # verify only, migrate nothing
 *
 * Env:
 *   DATABASE_URL  required. A pooled Neon URL is rewritten to the direct
 *                 endpoint for migrations and administrative work. See
 *                 docs/DEPLOYMENT.md for connection guidance.
 */

import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER_ROOT = resolve(__dirname, "..");
const MIGRATIONS_FOLDER = join(SERVER_ROOT, "src", "db", "migrations");
const SCHEMA_FILE = join(SERVER_ROOT, "src", "db", "schema.ts");

const checkOnly = process.argv.includes("--check");

function fail(message, detail) {
	console.error(`\n[migrate-prod] FAILED: ${message}`);
	if (detail) console.error(detail);
	process.exit(1);
}

/**
 * Neon pooler hosts embed "-pooler". Prefer a direct connection for migrations
 * to avoid transaction pooling's session-state limitations between transactions.
 */
function directConnectionString(rawUrl) {
	try {
		const url = new URL(rawUrl);
		if (url.hostname.includes("-pooler.")) {
			url.hostname = url.hostname.replace("-pooler.", ".");
			return url.toString();
		}
	} catch {
		/* fall through: use the URL as given */
	}
	return rawUrl;
}

/** Every table name declared via pgTable("name", ...) in the schema file. */
function declaredTables() {
	if (!existsSync(SCHEMA_FILE)) {
		fail(`schema file not found: ${SCHEMA_FILE}`);
	}
	const source = readFileSync(SCHEMA_FILE, "utf8");
	const names = new Set();
	const pattern = /pgTable\(\s*["'`]([^"'`]+)["'`]/g;
	let match;
	while ((match = pattern.exec(source)) !== null) {
		names.add(match[1]);
	}
	return [...names].sort();
}

async function main() {
	const rawUrl = process.env.DATABASE_URL;
	if (!rawUrl || !rawUrl.includes("://")) {
		fail("DATABASE_URL is not set or is not a connection string");
	}
	if (!existsSync(MIGRATIONS_FOLDER)) {
		fail(`migrations folder not found: ${MIGRATIONS_FOLDER}`);
	}

	const connectionString = directConnectionString(rawUrl);
	const pool = new pg.Pool({ connectionString, max: 1 });

	try {
		if (!checkOnly) {
			console.log(`[migrate-prod] applying migrations from ${MIGRATIONS_FOLDER}`);
			const db = drizzle(pool);
			await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
			console.log("[migrate-prod] migrations applied (journal maintained by drizzle)");
		} else {
			console.log("[migrate-prod] --check: no migrations applied");
		}

		// Journal state, for the record.
		const journal = await pool.query(
			`SELECT count(*)::int AS applied FROM drizzle.__drizzle_migrations`,
		);
		console.log(
			`[migrate-prod] journal records ${journal.rows[0]?.applied ?? 0} applied migration(s)`,
		);

		// Schema completeness: every pgTable in schema.ts must exist.
		const tables = declaredTables();
		const { rows } = await pool.query(
			`SELECT table_name FROM information_schema.tables
			  WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`,
		);
		const present = new Set(rows.map((r) => r.table_name));
		const missing = tables.filter((t) => !present.has(t));
		const extra = [...present].filter((t) => !tables.includes(t));

		console.log(
			`[migrate-prod] schema check: ${tables.length} declared, ${present.size} present in public`,
		);
		if (extra.length) {
			console.log(`[migrate-prod] note: ${extra.length} table(s) present but not declared: ${extra.join(", ")}`);
		}
		if (missing.length) {
			fail(
				`${missing.length} declared table(s) missing from the database: ${missing.join(", ")}`,
				"Refusing to release. Apply migrations, then re-run. A missing table surfaces at runtime as 42P01.",
			);
		}
		console.log("[migrate-prod] OK: schema complete");
	} finally {
		await pool.end();
	}
}

main().catch((err) => {
	console.error("[migrate-prod] unexpected error:", err);
	process.exit(1);
});
