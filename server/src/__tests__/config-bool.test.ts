/**
 * Unit tests for `parseBooleanEnv` in server/src/config.ts.
 *
 * `z.coerce.boolean()` is a trap: `Boolean("false")` is true (any non-empty
 * string is truthy). The explicit parser handles the common spellings of
 * "true" / "false" used in process.env so operators don't get surprised
 * by a misconfigured `OMMA_ALLOW_NON_PRIVATE_VENICE=false` enabling
 * non-private traffic. The function must also pass through unknown values
 * to zod so the downstream schema can reject them with a clear error.
 */
import { describe, expect, it } from "vitest";
import { parseBooleanEnv } from "../config.js";

describe("parseBooleanEnv", () => {
	it("treats truthy spellings as true", () => {
		for (const value of ["true", "TRUE", "True", "  yes  ", "1", "on", "ON"]) {
			expect(parseBooleanEnv(value), `expected ${value} to be true`).toBe(true);
		}
	});

	it("treats falsy spellings as false (the z.coerce.boolean trap)", () => {
		for (const value of ["false", "False", "0", "no", "off", "  ", ""]) {
			expect(parseBooleanEnv(value), `expected ${value} to be false`).toBe(false);
		}
	});

	it("passes unknown values through unchanged for zod to reject", () => {
		expect(parseBooleanEnv("maybe")).toBe("maybe");
		expect(parseBooleanEnv("truthy")).toBe("truthy");
	});

	it("returns non-string inputs untouched", () => {
		expect(parseBooleanEnv(undefined)).toBeUndefined();
		expect(parseBooleanEnv(42)).toBe(42);
		expect(parseBooleanEnv(true)).toBe(true);
	});
});
