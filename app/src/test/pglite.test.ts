/**
 * PGlite smoke test — proves the fixture works against a real
 * Postgres-compatible database in WASM. This is the same test
 * that ran manually in scratch/pglite-test/ to validate the
 * install. Keep it as the canary for the fixture.
 */
import { describe, it, expect, afterEach } from "vitest";
import { createPgFixture, withPgFixture, fixtureWithCleanup, type PgFixtureOptions } from "./pglite";
import type { PGlite } from "@electric-sql/pglite";

describe("pglite fixture", () => {
	// PGlite cold-start can take >5s when the WASM blob hasn't been loaded
	// yet (first run in a fresh process or after long idle). Tests pass
	// individually in ~700ms; bumping to 30s prevents false-positive
	// timeouts under vitest's default pool.
	let cleanup: (() => Promise<void>)[] = [];

	afterEach(async () => {
		await Promise.all(cleanup.map((fn) => fn()));
		cleanup = [];
	});

	const register = (fn: () => Promise<void>) => {
		cleanup.push(fn);
	};

	it("runs a query against an in-memory Postgres", async () => {
		const db = await createPgFixture();
		register(() => db.close());
		await db.exec("CREATE TABLE t (id INT, name TEXT);");
		await db.exec("INSERT INTO t VALUES (1, 'pg-wasm-works');");
		const r = await db.query<{ id: number; name: string }>("SELECT * FROM t");
		expect(r.rows).toEqual([{ id: 1, name: "pg-wasm-works" }]);
	});

	it("seeds via callback", async () => {
		const opts: PgFixtureOptions = {
			seed: async (db: PGlite) => {
				await db.exec(
					"CREATE TABLE users (id SERIAL PRIMARY KEY, email TEXT NOT NULL UNIQUE);",
				);
				await db.exec("INSERT INTO users (email) VALUES ('a@x.com'), ('b@x.com');");
			},
		};
		const db = await createPgFixture(opts);
		register(() => db.close());
		const r = await db.query<{ count: string }>(
			"SELECT count(*)::text AS count FROM users",
		);
		expect(r.rows[0]?.count).toBe("2");
	});

	it("withPgFixture opens + closes for one-shot tests", async () => {
		const count = await withPgFixture(async (db) => {
			await db.exec("CREATE TABLE x (n INT); INSERT INTO x VALUES (42);");
			const r = await db.query<{ n: number }>("SELECT * FROM x");
			return r.rows[0]?.n ?? 0;
		});
		expect(count).toBe(42);
	});

	it("fixtures are isolated (one doesn't see another's data)", async () => {
		const fxA = await createPgFixture();
		const fxB = await createPgFixture();
		register(() => fxA.close());
		register(() => fxB.close());
		await fxA.exec("CREATE TABLE iso (v INT); INSERT INTO iso VALUES (1);");
		const r = await fxB.query<{ exists: boolean }>(
			"SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'iso') AS exists",
		);
		expect(r.rows[0]?.exists).toBe(false);
	});

	it("fixtureWithCleanup registers an afterEach hook", async () => {
		const db = await fixtureWithCleanup(async (fn) => cleanup.push(fn));
		await db.exec("CREATE TABLE c (v INT); INSERT INTO c VALUES (7);");
		const r = await db.query<{ v: number }>("SELECT * FROM c");
		expect(r.rows[0]?.v).toBe(7);
	});
});
