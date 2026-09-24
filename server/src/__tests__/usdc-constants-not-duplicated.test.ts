import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { USDC_BASE, USDC_DECIMALS } from "../constants.js";

/**
 * The Base USDC contract address and its decimals are money-critical: the
 * deposit instructions a user acts on, the Transfer-event filter used to detect
 * payment, and the settlement math must all agree or a correct deposit is
 * attributed to the wrong token/amount.
 *
 * They are declared once in src/constants.ts. This test fails if a second
 * literal copy appears anywhere in the server source, which is how the copies
 * in lib/deposit-recovery.ts and routes/deposit/index.ts got there.
 *
 * Test files are exempt: they legitimately assert on literal addresses.
 */
const SERVER_SRC = join(process.cwd(), "src");
const CANONICAL = join(SERVER_SRC, "constants.ts");

function walk(dir: string, acc: string[] = []): string[] {
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) {
			walk(full, acc);
		} else if (/\.ts$/.test(entry) && !/\.test\.ts$/.test(entry)) {
			acc.push(full);
		}
	}
	return acc;
}

describe("USDC constants are not duplicated", () => {
	it("declares the address and decimals in exactly one place", () => {
		const files = walk(SERVER_SRC);
		const offenders: string[] = [];
		for (const file of files) {
			if (file === CANONICAL) continue;
			const src = readFileSync(file, "utf8");
			if (src.includes(USDC_BASE)) offenders.push(relative(process.cwd(), file));
		}
		expect(offenders).toEqual([]);
	});

	it("does not re-declare a literal 6-decimal precision outside constants", () => {
		// Catches `const USDC_DECIMALS = 6` style copies, but allows comments
		// and unrelated numeric 6s.
		const files = walk(SERVER_SRC);
		const offenders: string[] = [];
		for (const file of files) {
			if (file === CANONICAL) continue;
			const src = readFileSync(file, "utf8");
			if (/USDC_DECIMALS\s*=\s*\d/.test(src)) {
				offenders.push(relative(process.cwd(), file));
			}
		}
		expect(offenders).toEqual([]);
	});

	it("keeps the canonical decimals at 6", () => {
		// Guards the assumption itself: USDC on Base is a 6-decimal token.
		expect(USDC_DECIMALS).toBe(6);
	});
});
