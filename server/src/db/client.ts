import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema.js";
import { config } from "../config.js";

let _db: ReturnType<typeof drizzle> | null = null;
let _dbInitFailed = false;

export function getDb() {
  if (_dbInitFailed) {
    console.error("[db] FATAL: Database initialization failed. Using mock DB - all queries return empty results. This indicates a misconfigured DATABASE_URL or the database is unreachable.");
    return null as unknown as ReturnType<typeof drizzle>;
  }
  
  if (!_db) {
    const dbUrl = config.DATABASE_URL;
    if (!dbUrl || !dbUrl.includes("://")) {
      console.error("[db] FATAL: DATABASE_URL not configured or invalid. Using mock DB - all queries return empty results.");
      _dbInitFailed = true;
      return null as unknown as ReturnType<typeof drizzle>;
    }
    try {
      const sql = neon(dbUrl);
      _db = drizzle(sql, { schema });
    } catch (err) {
      console.error("[db] FATAL: Failed to initialize database connection:", err instanceof Error ? err.message : String(err), ". Using mock DB - all queries return empty results.");
      _dbInitFailed = true;
      return null as unknown as ReturnType<typeof drizzle>;
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