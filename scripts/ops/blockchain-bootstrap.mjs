#!/usr/bin/env node
// Blockchain agent bootstrap script: validates DB, ensures pgcrypto,
// provisions the admin user, writes ADMIN_WALLET_ADDRESSES, and
// records an audit log entry.
//
// Usage: node --env-file=.env scripts/ops/blockchain-bootstrap.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sql } from "drizzle-orm";
import { randomBytes, createHash } from "node:crypto";

// --- Read DATABASE_URL from server/.env so we don't depend on --env-file flag
const envPath = new URL("../../server/.env", import.meta.url);
const env = readFileSync(envPath, "utf8");
const dbUrl = env.split("\n").find((l) => l.startsWith("DATABASE_URL="))?.split("=")[1]?.trim();
if (!dbUrl) {
  console.error("DATABASE_URL not found in server/.env");
  process.exit(1);
}
const client = neon(dbUrl);
const db = drizzle(client);

const ADMIN_ADDRESS = "0xff54d5d60670d505cd956e7cbc66a33dd8544566";

// 1) Verify connection
try {
  const versionResult = await db.execute(sql`select version() as v`);
  console.log("[db] Connected:", versionResult.rows?.[0]?.v || versionResult[0]?.v || "ok");
} catch (err) {
  console.error("[db] Connection failed:", err.message);
  process.exit(1);
}

// 2) Ensure pgcrypto extension (for gen_random_uuid() default on id columns)
try {
  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
  console.log("[db] pgcrypto extension ensured");
} catch (err) {
  console.error("[db] Failed to create pgcrypto:", err.message);
  process.exit(1);
}

// 3) Check that the users table exists and the id column has a working default
try {
  const genResult = await db.execute(sql`SELECT gen_random_uuid() AS u`);
  const generated = genResult.rows?.[0]?.u || genResult[0]?.u;
  console.log("[db] gen_random_uuid() =", generated);
} catch (err) {
  console.error("[db] gen_random_uuid() failed:", err.message);
  process.exit(1);
}

// 4) Check if admin user already exists
const existingResult = await db.execute(
  sql`SELECT id, address, nonce FROM users WHERE LOWER(address) = LOWER(${ADMIN_ADDRESS})`
);
const existing = existingResult.rows?.[0] || existingResult[0];
let userId;
if (existing) {
  userId = existing.id;
  console.log(`[admin] User already exists with id=${userId} address=${existing.address}`);
} else {
  // Generate a strong nonce
  const nonce =
    createHash("md5").update(randomBytes(32)).digest("hex") +
    createHash("md5").update(randomBytes(32)).digest("hex");
  const insertResult = await db.execute(
    sql`INSERT INTO users (address, nonce, updated_at) VALUES (${ADMIN_ADDRESS}, ${nonce}, NOW()) RETURNING id, address, nonce`
  );
  const created = insertResult.rows?.[0] || insertResult[0];
  userId = created.id;
  console.log(`[admin] Created user id=${userId} address=${created.address}`);
}

// 5) Update ADMIN_WALLET_ADDRESSES in server/.env
const envLines = env.split("\n");
const adminLineIdx = envLines.findIndex((l) => l.startsWith("ADMIN_WALLET_ADDRESSES="));
const newLine = `ADMIN_WALLET_ADDRESSES=${ADMIN_ADDRESS}`;
if (adminLineIdx >= 0) {
  envLines[adminLineIdx] = newLine;
  console.log(`[env] Updated ADMIN_WALLET_ADDRESSES at line ${adminLineIdx + 1}`);
} else {
  envLines.push(newLine);
  console.log("[env] Appended ADMIN_WALLET_ADDRESSES");
}
writeFileSync(envPath, envLines.join("\n"));

// 6) Insert audit_logs row
try {
  const metadata = JSON.stringify({
    adminWallet: ADMIN_ADDRESS,
    provisionedBy: "system-bootstrap",
  });
  await db.execute(
    sql`INSERT INTO audit_logs (user_id, action, resource, resource_id, metadata, created_at)
        VALUES (${userId}, 'ADMIN_PROVISIONED', 'users', ${userId}, ${metadata}, NOW())`
  );
  console.log(`[audit] ADMIN_PROVISIONED recorded for userId=${userId}`);
} catch (err) {
  // The action enum might not contain ADMIN_PROVISIONED — fall back to USER_CREATED.
  console.warn(`[audit] ADMIN_PROVISIONED insert failed (${err.message}); falling back to USER_CREATED`);
  const metadata = JSON.stringify({
    adminWallet: ADMIN_ADDRESS,
    provisionedBy: "system-bootstrap",
    note: "ADMIN_PROVISIONED enum value not present, recorded as USER_CREATED",
  });
  await db.execute(
    sql`INSERT INTO audit_logs (user_id, action, resource, resource_id, metadata, created_at)
        VALUES (${userId}, 'USER_CREATED', 'users', ${userId}, ${metadata}, NOW())`
  );
  console.log(`[audit] USER_CREATED fallback recorded for userId=${userId}`);
}

console.log("\n[DONE] Admin user provisioned.");
console.log(`  userId = ${userId}`);
console.log(`  address = ${ADMIN_ADDRESS}`);
