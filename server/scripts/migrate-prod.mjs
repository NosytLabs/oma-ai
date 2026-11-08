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
import {
	declaredTables as declaredTablesFromSchema,
	diffSchema,
	readDatabaseState,
	reportDrift,
} from "./schema-drift-check.mjs";

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

/**
 * Keeps the migration journal's id sequence ahead of its rows.
 *
 * The journal table is `id SERIAL PRIMARY KEY`. An environment whose journal
 * was baselined by hand (rows inserted with explicit ids) leaves the
 * sequence behind: the next `migrate()` asks for an id the table already
 * holds and fails with `duplicate key value violates unique constraint
 * "__drizzle_migrations_pkey"`, so the deployment stops for a reason that
 * has nothing to do with the migration itself.
 *
 * `setval` is idempotent and only moves the sequence forward.
 */
async function repairJournalSequence(pool) {
	const { rows } = await pool.query(
		`SELECT setval(
		   pg_get_serial_sequence('drizzle.__drizzle_migrations', 'id'),
		   GREATEST((SELECT COALESCE(max(id), 0) FROM drizzle.__drizzle_migrations), 1)
		 ) AS next_id`,
	);
	console.log(
		`[migrate-prod] journal id sequence set to ${rows[0]?.next_id ?? "?"}`,
	);
}

/**
 * Audits the journal against the migration files.
 *
 * Drizzle decides what to apply by timestamp, not by identity: it applies
 * only the journal-file entries newer than the last applied row. A migration
 * file whose hash is absent from the journal and whose timestamp is older
 * than that row is therefore skipped FOREVER, silently -- the deploy reports
 * success and the change never lands.
 *
 * After a migration run every migration file must be recorded. A file that is
 * still missing is a hard failure: either it was skipped by the timestamp
 * rule, or it was applied and edited afterwards (in which case the recorded
 * hash no longer matches the file).
 */
async function auditJournal(pool) {
	const journalPath = join(MIGRATIONS_FOLDER, "meta", "_journal.json");
	if (!existsSync(journalPath)) return null;
	const journal = JSON.parse(readFileSync(journalPath, "utf8"));
	const entries = [...(journal.entries ?? [])].sort((a, b) => a.idx - b.idx);

	const { createHash } = await import("node:crypto");
	const { readFileSync: read } = await import("node:fs");
	const { rows } = await pool.query(
		"SELECT hash, created_at FROM drizzle.__drizzle_migrations",
	);
	const known = new Set(rows.map((row) => row.hash));

	const unmatched = [];
	for (const entry of entries) {
		const path = join(MIGRATIONS_FOLDER, `${entry.tag}.sql`);
		if (!existsSync(path)) {
			unmatched.push(`${entry.tag}.sql (listed in the journal file, file missing)`);
			continue;
		}
		const hash = createHash("sha256").update(read(path)).digest("hex");
		if (!known.has(hash)) unmatched.push(`${entry.tag}.sql`);
	}

	if (unmatched.length) {
		fail(
			`${unmatched.length} migration file(s) are not recorded in the journal: ${unmatched.join(", ")}`,
			"Drizzle applies migrations by timestamp, so a file older than the last\n" +
				"applied row is skipped silently. Run scripts/repair-journal.mjs to\n" +
				"record them (or, if a file was edited after it was applied, restore the\n" +
				"original contents and add a new migration instead).",
		);
	}
	console.log(
		`[migrate-prod] journal audit: ${entries.length} migration file(s), all recorded`,
	);
	return entries.length;
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
			await repairJournalSequence(pool);
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
		await auditJournal(pool);

		// Schema completeness: every pgTable in schema.ts must exist, with the
		// columns and indexes it declares. A table-name-only check passes while
		// a declared UNIQUE INDEX is missing -- and "ON CONFLICT (request_id)
		// DO NOTHING" fails outright without that constraint.
		const compiledSchema = join(SERVER_ROOT, "dist", "db", "schema.js");
		if (existsSync(compiledSchema)) {
			const schemaModule = await import(`file://${compiledSchema}`);
			const declared = declaredTablesFromSchema(schemaModule);
			const live = await readDatabaseState(pool);
			const drift = diffSchema(declared, live);
			const hasDrift = reportDrift(declared, live, drift);
			console.log(
				`[migrate-prod] schema check: ${declared.length} declared, ${live.size} present in public`,
			);
			if (hasDrift) {
				fail(
					"the database does not match the declared schema (see the drift above)",
					"Refusing to release. Apply migrations, then re-run. A missing column surfaces as 42703, a missing unique index as 42P10.",
				);
			}
		} else {
			// No compiled schema available: fall back to the table-name check.
			const tables = declaredTables();
			const { rows } = await pool.query(
				`SELECT table_name FROM information_schema.tables
				  WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`,
			);
			const present = new Set(rows.map((r) => r.table_name));
			const missing = tables.filter((t) => !present.has(t));
			const extra = [...present].filter((t) => !tables.includes(t));
			console.log(
				`[migrate-prod] schema check: ${tables.length} declared, ${present.size} present in public (table names only; build the server for a full check)`,
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
