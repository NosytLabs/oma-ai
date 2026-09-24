/**
 * The agent-auth plugin must be opt-in.
 *
 * BUG (production outage, pre-existing): `@better-auth/agent-auth` was
 * registered unconditionally in `betterAuth({ plugins: [...] })`. Better Auth
 * validates the WHOLE plugin schema when the instance is constructed — not
 * per route — and the plugin requires four tables that exist in neither
 * `src/db/schema.ts` nor any migration:
 *
 *   agent, agentHost, agentCapabilityGrant, approvalRequest
 *
 * So every auth call threw and production sign-in/sign-up returned 500:
 *
 *   GET /api/auth/get-session -> 500 "Drizzle schema mismatch"
 *
 * This suite asserts the plugin is gated behind AGENT_AUTH_ENABLED, which
 * restores auth without a production database migration.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const authSrc = readFileSync(join(here, "../auth.ts"), "utf8");
const configSrc = readFileSync(join(here, "../config.ts"), "utf8");

describe("agent-auth plugin gating", () => {
	it("defaults AGENT_AUTH_ENABLED to false in validated config", () => {
		// Must be a real, defaulted schema entry — reading process.env directly
		// would bypass validation and make the flag undeclared in .env.example.
		expect(configSrc).toMatch(/AGENT_AUTH_ENABLED:\s*z\.enum\(\["true",\s*"false"\]\)\.default\("false"\)/);
	});

	it("gates the plugin on the flag rather than registering it unconditionally", () => {
		expect(authSrc).toMatch(/\.\.\.\(AGENT_AUTH_ENABLED\s*\n?\s*\?\s*\[/);
	});

	it("defaults the flag to disabled at the point of use", () => {
		// Anything other than the exact string "true" leaves it off, so a typo
		// or a missing var can never re-enable a plugin whose tables are absent.
		expect(authSrc).toMatch(/config\.AGENT_AUTH_ENABLED\s*===\s*"true"/);
	});

	it("documents the four unmigrated tables next to the flag", () => {
		for (const table of ["agentHost", "agentCapabilityGrant", "approvalRequest"]) {
			expect(authSrc).toContain(table);
		}
	});
});
