/**
 * A spoofed audit trail is worse than no audit trail — it looks authoritative
 * while recording whatever an attacker typed.
 *
 * THE BUG CLASS: the Neon Function is publicly reachable, so reading
 * `x-forwarded-for` / `x-real-ip` directly records whatever the caller
 * asserted. Rate limiting was hardened to require the authenticated proxy hop
 * (see authenticated-proxy-ip.test.ts), but four security surfaces kept the old
 * direct read: the audit log (x2), the demo-mode guard, the account-delete
 * compliance record, and the account-export trail. This test pins that every
 * security surface resolves identity through extractClientIp.
 *
 * This is a SOURCE-level guard on purpose: the failure mode is a header being
 * read somewhere new, which no runtime test of the existing paths can catch.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const SRC = join(process.cwd(), "src");

/** Every .ts file under src, excluding tests. */
function sourceFiles(dir: string = SRC): string[] {
	const out: string[] = [];
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) {
			if (entry === "__tests__") continue;
			out.push(...sourceFiles(full));
			continue;
		}
		if (!entry.endsWith(".ts") || entry.endsWith(".test.ts")) continue;
		out.push(full);
	}
	return out;
}

describe("client identity is never read straight off a client-controlled header", () => {
	it("no non-test source reads x-forwarded-for / x-real-ip directly", () => {
		const offenders: string[] = [];
		for (const file of sourceFiles()) {
			const src = readFileSync(file, "utf8");
			// utils.ts is the single sanctioned home for this logic.
			if (file.endsWith(join("rate-limit", "utils.ts"))) continue;
			const readsHeader =
				/header\(\s*["']x-forwarded-for["']/.test(src) ||
				/header\(\s*["']x-real-ip["']/.test(src) ||
				/header\(\s*["']x-vercel-forwarded-for["']/.test(src);
			if (readsHeader) offenders.push(relative(process.cwd(), file));
		}
		expect(
			offenders,
			`These files read a client-controlled IP header directly. Use extractClientIp() / ` +
				`extractClientIpOrNull() from middleware/rate-limit/utils.ts instead, so the ` +
				`authenticated Vercel->Neon proxy hop is honoured and spoofing is rejected.`,
		).toEqual([]);
	});
});
