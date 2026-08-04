import { describe, expect, it } from "vitest";
import { formatPriceRange } from "../page";

describe("formatPriceRange", () => {
	it("includes a single leading dollar sign", () => {
		expect(formatPriceRange(0)).toBe("$0.00");
		expect(formatPriceRange(1000)).toBe("$1000.00");
		expect(formatPriceRange(0.0001)).toBe("$0.0001");
		expect(formatPriceRange(0.5)).toBe("$0.500");
	});

	it("never returns a double dollar prefix", () => {
		for (const p of [0, 0.0001, 0.01, 0.5, 1, 10, 1000]) {
			const s = formatPriceRange(p);
			expect(s.startsWith("$$")).toBe(false);
			expect(s.startsWith("$")).toBe(true);
		}
	});
});
