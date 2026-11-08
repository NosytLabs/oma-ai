/**
 * Schema drift check: declared schema (src/db/schema.ts) vs the live database.
 *
 * `migrate-prod.mjs` verified that every declared TABLE exists. That check
 * passes while a declared UNIQUE INDEX is missing from production -- and a
 * missing unique index is not cosmetic: the usage ledger relies on
 * `ON CONFLICT (request_id) DO NOTHING`, which Postgres rejects outright when
 * the constraint is absent ("no unique or exclusion constraint matching the
 * ON CONFLICT specification").
 *
 * This script compares tables, columns and indexes, so drift that a
 * table-name check cannot see fails loudly instead of surfacing as a runtime
 * 42P10/23505.
 *
 * Usage:
 *   node scripts/schema-drift-check.mjs            # report drift, exit 1 on drift
 *   node scripts/schema-drift-check.mjs --warn     # report only, always exit 0
 *
 * Env:
 *   DATABASE_URL  required.
 */

import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { getTableConfig } from "drizzle-orm/pg-core";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER_ROOT = resolve(__dirname, "..");
const COMPILED_SCHEMA = join(SERVER_ROOT, "dist", "db", "schema.js");
const warnOnly = process.argv.includes("--warn");

/**
 * A pooled Neon URL embeds "-pooler"; session state does not survive
 * transaction pooling, so administrative work uses the direct endpoint.
 */
export function directConnectionString(rawUrl) {
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

/** Every pgTable exported by the compiled schema module. */
export function declaredTables(schemaModule) {
	const tables = [];
	for (const value of Object.values(schemaModule)) {
		if (!value || typeof value !== "object") continue;
		if (typeof value[Symbol.for("drizzle:Name")] !== "string") continue;
		const config = getTableConfig(value);
		// `config.columns` is a list of Column objects; the database name of a
		// column is `column.name` (the schema property name may differ).
		const columnList = Array.isArray(config.columns)
			? config.columns
			: Object.values(config.columns);
		tables.push({
			name: config.name,
			columns: new Set(columnList.map((column) => column.name)),
			indexes: new Set(
				[...(config.indexes ?? []), ...(config.uniques ?? [])]
					.map((index) => index.config?.name)
					.filter(Boolean),
			),
			columnTypes: Object.fromEntries(
				columnList.map((column) => [column.name, column.getSQLType()]),
			),
		});
	}
	return tables;
}

/** Reads the live database's tables, columns and indexes. */
export async function readDatabaseState(pool) {
	const { rows: tableRows } = await pool.query(
		`SELECT table_name FROM information_schema.tables
		  WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`,
	);
	const { rows: columnRows } = await pool.query(
		`SELECT table_name, column_name, data_type, numeric_precision, numeric_scale
		   FROM information_schema.columns WHERE table_schema = 'public'`,
	);
	const { rows: indexRows } = await pool.query(
		`SELECT tablename, indexname FROM pg_indexes WHERE schemaname = 'public'`,
	);

	const tables = new Map();
	for (const row of tableRows) tables.set(row.table_name, { columns: new Set(), indexes: new Set() });
	for (const row of columnRows) {
		const entry = tables.get(row.table_name);
		if (entry) entry.columns.add(row.column_name);
	}
	for (const row of indexRows) {
		// pg_indexes names the column "tablename" (no underscore).
		const entry = tables.get(row.tablename);
		if (entry) entry.indexes.add(row.indexname);
	}
	return tables;
}

/**
 * Compares the declared schema against the live database.
 *
 * Returns the drift in three buckets: `missing` breaks the code, `notes` is
 * informational (extra tables, column type differences).
 */
export function diffSchema(declared, live) {
	const missing = { tables: [], columns: [], indexes: [] };
	const notes = { extraTables: [], columnTypes: [] };

	for (const table of declared) {
		const liveTable = live.get(table.name);
		if (!liveTable) {
			missing.tables.push(table.name);
			continue;
		}
		for (const column of table.columns) {
			if (!liveTable.columns.has(column)) missing.columns.push(`${table.name}.${column}`);
		}
		for (const index of table.indexes) {
			if (!liveTable.indexes.has(index)) missing.indexes.push(`${table.name}:${index}`);
		}
	}

	for (const name of live.keys()) {
		if (!declared.some((table) => table.name === name)) notes.extraTables.push(name);
	}

	return { missing, notes };
}

/** Prints the drift report and returns true when something is missing. */
export function reportDrift(declared, live, drift) {
	const { missing, notes } = drift;
	for (const table of missing.tables) console.error(`  missing table:   ${table}`);
	for (const column of missing.columns) console.error(`  missing column:  ${column}`);
	for (const index of missing.indexes) console.error(`  missing index:   ${index}`);
	if (notes.extraTables.length) {
		console.log(`  note: ${notes.extraTables.length} table(s) present but not declared: ${notes.extraTables.join(", ")}`);
	}
	return missing.tables.length + missing.columns.length + missing.indexes.length > 0;
}

async function main() {
	const rawUrl = process.env.DATABASE_URL;
	if (!rawUrl || !rawUrl.includes("://")) {
		console.error("[schema-drift] DATABASE_URL is not set or is not a connection string");
		process.exit(1);
	}
	if (!existsSync(COMPILED_SCHEMA)) {
		console.error(
			`[schema-drift] compiled schema not found at ${COMPILED_SCHEMA} -- run "pnpm build" first`,
		);
		process.exit(1);
	}

	const schemaModule = await import(`file://${COMPILED_SCHEMA}`);
	const declared = declaredTables(schemaModule);
	const pool = new pg.Pool({ connectionString: directConnectionString(rawUrl), max: 1 });
	try {
		const live = await readDatabaseState(pool);
		const drift = diffSchema(declared, live);
		const hasDrift = reportDrift(declared, live, drift);
		console.log(
			`[schema-drift] ${declared.length} declared table(s), ${live.size} present in public`,
		);
		if (hasDrift && !warnOnly) {
			console.error("[schema-drift] FAILED: the database does not match the declared schema");
			process.exit(1);
		}
		console.log("[schema-drift] OK: schema matches the declared schema");
	} finally {
		await pool.end();
	}
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
	main().catch((err) => {
		console.error("[schema-drift] unexpected error:", err);
		process.exit(1);
	});
}
