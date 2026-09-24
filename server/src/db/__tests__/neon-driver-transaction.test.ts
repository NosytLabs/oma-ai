/**
 * The production Neon database driver MUST support db.transaction().
 *
 * BUG (audit HIGH, proven by execution):
 *   server/src/db/client.ts selected `drizzle-orm/neon-http` for *.neon.tech
 *   URLs. That driver's session throws on every transaction:
 *
 *     node_modules/drizzle-orm/neon-http/session.js:152
 *       throw new Error("No transactions support in neon-http driver");
 *
 *   Four money paths call db.transaction() and were failing outright in
 *   production: credit deduction, Polar settlement, x402 settlement, and
 *   deposit recovery. Local dev used node-postgres (which DOES support
 *   transactions), so 658 passing tests never caught it.
 *
 * This test guards the driver SELECTION, because that is the one decision
 * that silently diverges dev from prod.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const clientSrc = readFileSync(join(here, "../client.ts"), "utf8");

describe("Neon driver selection", () => {
	it("does NOT import the neon-http driver", () => {
		// neon-http cannot run a transaction. Importing it at all is the smell.
		expect(clientSrc).not.toMatch(/from\s+"drizzle-orm\/neon-http"/);
	});

	it("imports the transaction-capable neon-serverless driver", () => {
		expect(clientSrc).toMatch(/from\s+"drizzle-orm\/neon-serverless"/);
	});

	it("keeps the WebSocket pool so connections can be closed on shutdown", () => {
		// A pooled WebSocket driver that is never closed keeps the process
		// alive on SIGTERM and leaks connections across hot reloads.
		expect(clientSrc).toMatch(/export\s+async\s+function\s+closeDb/);
		expect(clientSrc).toMatch(/_neonPool\.end\(\)/);
	});

	it("logs a truthful driver name so a regression is visible in startup logs", () => {
		// It previously logged "neon-http" while actually being the broken
		// HTTP driver, which is fine; the point is the label must match the
		// driver now in use.
		expect(clientSrc).toMatch(/neon-serverless\(ws\)/);
		expect(clientSrc).not.toMatch(/driver:\s*isNeonUrl\(dbUrl\)\s*\?\s*"neon-http"/);
	});
});
