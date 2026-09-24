/**
 * The free playground was 100% down in production.
 *
 * LIVE BUG (2026-09-24): every `POST /v1/chat/completions` returned
 *   503 {"code":"service_unavailable"}  with `X-RateLimit-Policy: fail-closed`
 * for every visitor, because the chat limiter set
 *   `failClosed: process.env.NODE_ENV === "production"`
 * and production has no Redis configured.
 *
 * The line directly contradicted its own comment ("Guest playground traffic is
 * useless if Redis blips 503 every send") and contradicted the documented
 * policy in rate-limit/sliding-window.ts: "a missing cache dependency should
 * degrade enforcement, not availability." Every other limiter in the codebase
 * — auth, admin, polar — already used `failClosed: false`.
 *
 * The cost gate is NOT this limiter: it is `dailyUsageLimit()` (20 msgs/day
 * anonymous), which is independent and still applies. The per-minute limiter
 * is only a burst guard, so degrading it to the in-memory fallback keeps a
 * bound per instance without taking the whole product offline.
 *
 * Real Redis remains the correct long-term fix; this restores availability
 * using the degradation path the module was already designed around.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const CHAT_ROUTE = join(process.cwd(), "src", "routes", "chat", "index.ts");

/**
 * Strip comments before inspecting. The bug is already described in prose in
 * this file's own comment, and a naive regex over raw source would match the
 * explanation instead of (or as well as) the executable line.
 */
function executableSource(src: string): string {
	return src
		.replace(/\/\*[\s\S]*?\*\//g, "")
		.replace(/\/\/[^\n]*/g, "");
}

describe("chat completion rate limiter", () => {
	it("must not fail closed just because NODE_ENV is production", () => {
		const code = executableSource(readFileSync(CHAT_ROUTE, "utf8"));
		// The exact expression that took the whole playground offline.
		expect(code).not.toMatch(
			/failClosed:\s*process\.env\.NODE_ENV\s*===\s*["']production["']/,
		);
	});

	it("degrades to the in-memory bound instead of rejecting every send", () => {
		const code = executableSource(readFileSync(CHAT_ROUTE, "utf8"));
		expect(code).toMatch(/failClosed:\s*false/);
	});
});
