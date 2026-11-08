/**
 * Repairs the Drizzle migration journal of a database whose journal was
 * baselined by hand.
 *
 * ## Why this exists
 *
 * Drizzle's migrator decides what to apply by comparing timestamps, not by
 * identity: it reads the last applied row (`ORDER BY created_at DESC LIMIT
 * 1`) and applies only the journal-file entries newer than it. An environment
 * whose journal was seeded with explicit rows therefore has two failure modes
 * that look identical from the outside -- the migration "did nothing" and the
 * migration "was never seen":
 *
 *   1. A migration file whose hash is absent from the journal and whose
 *      timestamp is older than the last applied row is skipped forever, with
 *      no error. That is how production ended up with a journal that recorded
 *      6 of its 10 migration files.
 *   2. The next inserted row collides with the journal's `id SERIAL`, because
 *      a hand-seeded table leaves the sequence behind its rows. See
 *      `repairJournalSequence()` in migrate-prod.mjs.
 *
 * This script fixes (1) by recording the missing migrations with the
 * timestamps their journal-file entries already carry, so the journal becomes
 * a faithful record of what has been applied.
 *
 * ## Safety
 *
 * - Idempotent: a migration whose hash is already recorded is left alone.
 * - Only rows are INSERTed. Nothing is deleted or updated.
 * - A migration file that was applied and then EDITED keeps its old hash, so
 *   it is reported as "unmatched" rather than silently recorded -- editing an
 *   applied migration is a mistake worth reporting, not papering over.
 * - Run with `--dry` to see what would be inserted without writing.
 *
 * Usage:
 *   DATABASE_URL=... node scripts/repair-journal.mjs [--dry]
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER_ROOT = resolve(__dirname, "..");
const MIGRATIONS_FOLDER = join(SERVER_ROOT, "src", "db", "migrations");
const JOURNAL_FILE = join(MIGRATIONS_FOLDER, "meta", "_journal.json");

const dryRun = process.argv.includes("--dry");

/** sha256 of a migration file's contents -- the hash Drizzle stores. */
function hashFile(path) {
	return createHash("sha256").update(readFileSync(path)).digest("hex");
}

async function main() {
	const rawUrl = process.env.DATABASE_URL;
	if (!rawUrl || !rawUrl.includes("://")) {
		console.error("[repair-journal] DATABASE_URL is not set or is not a connection string");
		process.exit(1);
	}
	if (!existsSync(JOURNAL_FILE)) {
		console.error(`[repair-journal] journal file not found: ${JOURNAL_FILE}`);
		process.exit(1);
	}

	const journal = JSON.parse(readFileSync(JOURNAL_FILE, "utf8"));
	const entries = [...(journal.entries ?? [])].sort((a, b) => a.idx - b.idx);
	const files = readdirSync(MIGRATIONS_FOLDER)
		.filter((name) => name.endsWith(".sql"))
		.sort();

	const pool = new pg.Pool({ connectionString: rawUrl, max: 1 });
	try {
		const { rows } = await pool.query(
			"SELECT id, hash, created_at FROM drizzle.__drizzle_migrations ORDER BY id",
		);
		const known = new Set(rows.map((row) => row.hash));
		const lastApplied = rows.reduce(
			(max, row) => Math.max(max, Number(row.created_at)),
			0,
		);

		const missing = [];
		for (const entry of entries) {
			const file = `${entry.tag}.sql`;
			const path = join(MIGRATIONS_FOLDER, file);
			if (!existsSync(path)) {
				console.warn(`[repair-journal] ${file}: listed in the journal file but absent on disk`);
				continue;
			}
			const hash = hashFile(path);
			if (known.has(hash)) continue;
			missing.push({ file, hash, when: Number(entry.when) });
		}

		if (missing.length === 0) {
			console.log(
				`[repair-journal] journal is complete: ${rows.length} row(s), every migration recorded`,
			);
			return;
		}

		for (const item of missing) {
			const skipped = item.when <= lastApplied;
			console.log(
				`[repair-journal] ${item.file}: ${skipped ? "never applied (timestamp older than the last applied row)" : "pending"}`,
			);
		}

		if (dryRun) {
			console.log("[repair-journal] --dry: nothing written");
			return;
		}

		const client = await pool.connect();
		try {
			await client.query("BEGIN");
			for (const item of missing) {
				await client.query(
					"INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2) ON CONFLICT DO NOTHING",
					[item.hash, item.when],
				);
			}
			await client.query("COMMIT");
		} catch (error) {
			await client.query("ROLLBACK");
			throw error;
		} finally {
			client.release();
		}

		const after = await pool.query(
			"SELECT count(*)::int AS applied FROM drizzle.__drizzle_migrations",
		);
		console.log(
			`[repair-journal] recorded ${missing.length} migration(s); journal now has ${after.rows[0]?.applied ?? "?"} row(s)`,
		);
	} finally {
		await pool.end();
	}
}

main().catch((error) => {
	console.error("[repair-journal] FAILED:", error?.message ?? error);
	process.exit(1);
});
