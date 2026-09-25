import { describe, expect, it } from "vitest";
import { formatPrice } from "../model-utils";

describe("formatPrice", () => {
	it("renders two decimals for prices >= $0.01", () => {
		expect(formatPrice(1)).toBe("$1.00");
		expect(formatPrice(7.8125)).toBe("$7.81");
		expect(formatPrice(0.6)).toBe("$0.60");
		expect(formatPrice(2.375)).toBe("$2.38");
	});

	it("renders three decimals for sub-cent prices so they don't round to $0.00", () => {
		expect(formatPrice(0.001)).toBe("$0.001");
		// FP rounding: 0.0055.toFixed(3) is "0.005", not "0.006" -- assert the
		// actual behaviour, which is what the detail pages have always shown.
		expect(formatPrice(0.0055)).toBe("$0.005");
	});
});
