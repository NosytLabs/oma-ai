import { describe, expect, it } from "vitest";
import { formatPriceRange } from "../page";

describe("formatPriceRange", () => {
	it("includes a single leading dollar sign", () => {
		expect(formatPriceRange(0)).toBe("$0.00");
		expect(formatPriceRange(1000)).toBe("$1000.00");
		expect(formatPriceRange(0.0001)).toBe("$0.05");
		expect(formatPriceRange(0.5)).toBe("$0.50");
	});

	it("rounds up to the nearest $0.05 increment", () => {
		expect(formatPriceRange(0.53)).toBe("$0.55");
		expect(formatPriceRange(0.61)).toBe("$0.65");
		expect(formatPriceRange(9.94)).toBe("$9.95");
		expect(formatPriceRange(0.001)).toBe("$0.05");
	});

	it("never returns a double dollar prefix", () => {
		for (const p of [0, 0.0001, 0.01, 0.5, 1, 10, 1000]) {
			const s = formatPriceRange(p);
			expect(s.startsWith("$$")).toBe(false);
			expect(s.startsWith("$")).toBe(true);
		}
	});
});
