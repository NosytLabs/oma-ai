import { PGlite } from "@electric-sql/pglite";

/**
 * Vitest fixture for an in-process Postgres-compatible database.
 *
 * pglite runs real Postgres in WASM (~3MB gzipped) so:
 *   - SQL dialect matches production (postgres via drizzle)
 *   - no testcontainers / docker / network
 *   - parallel-safe: each test file gets its own data dir
 *
 * Production caveat: pglite is single-process, in-memory or single
 * dir, no auth/TLS/RLS. Do NOT use for prod data — this is for
 * unit tests + offline dev fixtures only. See scratch/pglite-test/
 * for the smoke run that proved the setup.
 */

export type PgFixture = {
	db: PGlite;
	close: () => Promise<void>;
};

export type PgFixtureOptions = {
	seed?: (db: PGlite) => Promise<void>;
};

export async function createPgFixture(opts: PgFixtureOptions = {}): Promise<PGlite> {
	const db = await PGlite.create();
	if (opts.seed) {
		await opts.seed(db);
	}
	return db;
}

export async function withPgFixture<T>(
	run: (db: PGlite) => Promise<T>,
	opts: PgFixtureOptions = {},
): Promise<T> {
	const db = await createPgFixture(opts);
	try {
		return await run(db);
	} finally {
		await db.close();
	}
}

/**
 * Convenience: register afterEach cleanup for `let db = createPgFixture()`
 * style tests. Returns the db and registers the close hook.
 */
export async function fixtureWithCleanup(
	afterEachHook: (fn: () => Promise<void>) => void,
	opts?: PgFixtureOptions,
): Promise<PGlite> {
	const db = await createPgFixture(opts);
	afterEachHook(async () => {
		await db.close();
	});
	return db;
}
