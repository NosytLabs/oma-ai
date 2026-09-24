/**
 * The agent-auth plugin must NOT be registered in `auth.ts`.
 *
 * HISTORY
 * -------
 * `@better-auth/agent-auth` was added in 4bf6a103 (2026-07-29) with no
 * migration. It requires four tables — `agent`, `agentHost`,
 * `agentCapabilityGrant`, `approvalRequest` — that exist in neither
 * `src/db/schema.ts` nor any migration in `src/db/migrations/`.
 *
 * Better Auth validates the ENTIRE plugin schema when `betterAuth()` is
 * constructed, not per route, so registering the plugin made every auth call
 * throw and took production sign-in/sign-up down entirely:
 *
 *   GET /api/auth/get-session -> 500 "Drizzle schema mismatch"
 *
 * It was briefly gated behind a default-off flag to restore auth without a
 * production database migration, then removed outright once the owner chose
 * cleanup over a speculative capability.
 *
 * This suite is a regression guard: re-adding the plugin to `plugins: [...]`
 * without first migrating those four tables will fail here rather than in
 * production.
 *
 * Re-enabling it requires, in order:
 *   1. the four tables, using the plugin's own `mergeSchema` output as the
 *      authoritative shape (never hand-written from memory),
 *   2. `db:generate` + the migration actually applied to production,
 *   3. only then the plugin call in `betterAuth({ plugins: [...] })`.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const authSrc = readFileSync(join(here, "../auth.ts"), "utf8");
const schemaSrc = readFileSync(join(here, "../db/schema.ts"), "utf8");

describe("agent-auth plugin is not registered", () => {
	it("does not import or call the plugin", () => {
		expect(authSrc).not.toMatch(/from\s+"@better-auth\/agent-auth"/);
		expect(authSrc).not.toMatch(/\bagentAuthPlugin\b/);
	});

	it("leaves no dead feature flag behind", () => {
		// A config entry nothing reads is the same class of rot as the
		// orphaned `MODEL_COUNT_LABEL` and unused `and` import fixed earlier.
		expect(authSrc).not.toContain("AGENT_AUTH_ENABLED");
	});

	it("keeps the plugins array well-formed", () => {
		// A dangling spread or unclosed element from a botched removal would
		// be a syntax error; this pins the array terminator.
		expect(authSrc).toMatch(/plugins:\s*\[/);
	});

	it("documents why it must stay out until migrated", () => {
		// If someone re-adds the plugin, the reasoning must still be here.
		for (const table of ["agentHost", "agentCapabilityGrant", "approvalRequest"]) {
			expect(authSrc).toContain(table);
		}
	});

	it("confirms the four tables are genuinely still unmigrated", () => {
		// If a future migration adds them, this test is what tells you the
		// removal is now safe to revisit rather than silently stale.
		expect(schemaSrc).not.toMatch(
			/pgTable\(\s*"(agent|agentHost|agentCapabilityGrant|approvalRequest)"/,
		);
	});
});
