import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema.js";
import { config } from "../config.js";
import { logger } from "../lib/logger.js";

let _db: ReturnType<typeof drizzle> | null = null;
let _dbInitFailed = false;

export function getDb() {
  if (_dbInitFailed) {
    if (process.env.NODE_ENV === "test") {
      return null as unknown as ReturnType<typeof drizzle>;
    }
    logger.fatal("Database initialization previously failed. Refusing to continue with a mock DB in non-test environments.");
    process.exit(1);
  }

  if (!_db) {
    const dbUrl = config.DATABASE_URL;
    if (!dbUrl || !dbUrl.includes("://")) {
      _dbInitFailed = true;
      if (process.env.NODE_ENV === "test") {
        throw new Error("DATABASE_URL is required");
      }
      logger.fatal("DATABASE_URL not configured or invalid. Refusing to start with a mock DB in non-test environments.");
      process.exit(1);
    }
    try {
      const sql = neon(dbUrl);
      _db = drizzle(sql, { schema });
    } catch (err) {
      _dbInitFailed = true;
      if (process.env.NODE_ENV === "test") {
        throw err;
      }
      logger.fatal({ err }, "Failed to initialize database connection. Refusing to start with a mock DB in non-test environments.");
      process.exit(1);
    }
  }
  return _db;
}

const createMockDrizzle = () => {
  const handlers: Record<string, Function> = {
    select: () => ({ from: () => ({ where: () => Promise.resolve([]), all: () => Promise.resolve([]), limit: () => Promise.resolve([]), returning: () => Promise.resolve([]) }) }),
    insert: () => ({ values: () => ({ returning: () => Promise.resolve([{ id: "mock" }]) }) }),
    update: () => ({ set: () => ({ where: () => ({ returning: () => Promise.resolve([]) }) }) }),
    delete: () => ({ where: () => ({ returning: () => Promise.resolve([]) }) }),
    transaction: async (fn: Function) => { const mockTx = createMockDrizzle(); return fn(mockTx); },
    execute: async () => ({ rows: [] }),
    query: async () => ({ rows: [] }),
  };
  return new Proxy({}, {
    get: (_, prop) => {
      if (handlers[prop as string]) {
        return handlers[prop as string];
      }
      return () => Promise.resolve({});
    },
  }) as ReturnType<typeof drizzle>;
};

export const db = new Proxy<ReturnType<typeof drizzle>>(createMockDrizzle() as ReturnType<typeof drizzle>, {
  get: (_, prop) => {
    const actualDb = getDb();
    if (actualDb) {
      return Reflect.get(actualDb, prop);
    }
    const mock = createMockDrizzle();
    return Reflect.get(mock, prop);
  },
});

export function resetDbState(): void {
  _db = null;
  _dbInitFailed = false;
}
