import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema.js";
import { config } from "../config.js";

let _db: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (!_db) {
    if (!config.DATABASE_URL.includes("://")) {
      throw new Error("DATABASE_URL not configured. Set it to a valid Neon PostgreSQL connection string.");
    }
    const sql = neon(config.DATABASE_URL);
    _db = drizzle(sql, { schema });
  }
  return _db;
}

export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_, prop) {
    return Reflect.get(getDb(), prop);
  },
});
