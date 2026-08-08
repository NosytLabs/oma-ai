/**
 * Database client.
 *
 * - Neon cloud (`*.neon.tech`): HTTP driver via `@neondatabase/serverless`.
 * - Local / self-hosted Postgres: TCP via `pg` + `drizzle-orm/node-postgres`.
 */

import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { drizzle as drizzleNode, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema.js";
import { config } from "../config.js";
import { logger } from "../lib/logger.js";

/** Canonical app DB type. Neon HTTP is API-compatible at runtime; we cast
 *  so call sites keep full `returning()` / query typing without union collapse. */
export type AppDb = NodePgDatabase<typeof schema>;

let _db: AppDb | null = null;
let _dbInitFailed = false;
let _pgPool: pg.Pool | null = null;

function isNeonUrl(url: string): boolean {
	try {
		const host = new URL(url).hostname;
		return host.endsWith("neon.tech") || host.includes("neon.tech");
	} catch {
		return url.includes("neon.tech");
	}
}

function createNeonDb(dbUrl: string): AppDb {
	const poolUrl = dbUrl.includes("neon.tech")
		? `${dbUrl}${dbUrl.includes("?") ? "&" : "?"}pgbouncer=true&pool_timeout=30&connection_limit=${config.CONNECTION_POOL_SIZE}`
		: dbUrl;
	const sql = neon(poolUrl);
	// Neon HTTP drizzle is structurally close enough for our query surface.
	return drizzleNeon(sql, { schema }) as unknown as AppDb;
}

function createNodePgDb(dbUrl: string): AppDb {
	_pgPool = new pg.Pool({
		connectionString: dbUrl,
		max: Math.min(config.CONNECTION_POOL_SIZE ?? 10, 20),
	});
	_pgPool.on("error", (err) => {
		logger.error({ err }, "[db] idle client error");
	});
	return drizzleNode(_pgPool, { schema });
}

function getDb() {
	if (_dbInitFailed) {
		if (process.env.NODE_ENV === "test") {
			return null as unknown as AppDb;
		}
		logger.fatal(
			"Database initialization previously failed. Refusing to continue with a mock DB in non-test environments.",
		);
		process.exit(1);
	}

	if (!_db) {
		const dbUrl = config.DATABASE_URL;
		if (!dbUrl || !dbUrl.includes("://")) {
			_dbInitFailed = true;
			if (process.env.NODE_ENV === "test") {
				throw new Error("DATABASE_URL is required");
			}
			logger.fatal(
				"DATABASE_URL not configured or invalid. Refusing to start with a mock DB in non-test environments.",
			);
			process.exit(1);
		}
		try {
			_db = isNeonUrl(dbUrl) ? createNeonDb(dbUrl) : createNodePgDb(dbUrl);
			logger.info(
				{ driver: isNeonUrl(dbUrl) ? "neon-http" : "node-postgres" },
				"[db] connected",
			);
		} catch (err) {
			_dbInitFailed = true;
			if (process.env.NODE_ENV === "test") {
				throw err;
			}
			logger.fatal(
				{ err },
				"Failed to initialize database connection. Refusing to start with a mock DB in non-test environments.",
			);
			process.exit(1);
		}
	}
	return _db;
}

const createMockDrizzle = (): AppDb => {
	const handlers: Record<string, Function> = {
		select: () => ({
			from: () => ({
				where: () => Promise.resolve([]),
				all: () => Promise.resolve([]),
				limit: () => Promise.resolve([]),
				returning: () => Promise.resolve([]),
			}),
		}),
		insert: () => ({
			values: () => ({
				returning: () => Promise.resolve([{ id: "mock" }]),
			}),
		}),
		update: () => ({
			set: () => ({
				where: () => ({ returning: () => Promise.resolve([]) }),
			}),
		}),
		delete: () => ({
			where: () => ({ returning: () => Promise.resolve([]) }),
		}),
		transaction: async (fn: Function) => {
			const mockTx = createMockDrizzle();
			return fn(mockTx);
		},
		execute: async () => ({ rows: [] }),
		query: async () => ({ rows: [] }),
	};
	return new Proxy(
		{},
		{
			get: (_, prop) => {
				if (handlers[prop as string]) {
					return handlers[prop as string];
				}
				return () => Promise.resolve({});
			},
		},
	) as AppDb;
};

export const db = new Proxy(createMockDrizzle(), {
	get: (_, prop) => {
		const actualDb = getDb();
		if (actualDb) {
			return Reflect.get(actualDb, prop);
		}
		const mock = createMockDrizzle();
		return Reflect.get(mock, prop);
	},
}) as AppDb;


