import { describe, expect, it, vi, beforeEach } from "vitest";
import { getModelPricing, userFacingFor } from "../billing-service.js";

const mockGetModelById = vi.hoisted(() => vi.fn());
const mockReadModelPricingOverrides = vi.hoisted(() => vi.fn().mockReturnValue({}));

vi.mock("../models.js", () => ({
	getModelById: mockGetModelById,
}));

vi.mock("../../lib/model-overrides.js", () => ({
	readModelPricingOverrides: mockReadModelPricingOverrides,
}));

describe("getModelPricing", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockReadModelPricingOverrides.mockReturnValue({});
		// Force cache bypass for testing
		vi.setSystemTime(Date.now() + 10000); 
	});

	it("throws if model is not found in catalog", () => {
		mockGetModelById.mockReturnValue(null);
		expect(() => getModelPricing("missing-model")).toThrow("Model missing-model not found in catalog");
	});

	it("returns catalog pricing with markup if no override exists", () => {
		mockGetModelById.mockReturnValue({
			id: "base-model",
			inputPricePer1M: 10,
			outputPricePer1M: 20,
			markupPercent: 15,
		});

		const pricing = getModelPricing("base-model");
		expect(pricing).toEqual({
			inputPer1M: 10,
			outputPer1M: 20,
			markup: 15,
		});
	});

	it("charges a fixed retail price without fabricating an unknown provider cost", () => {
		mockGetModelById.mockReturnValue({
			id: "flat-price", inputPricePer1M: 0, outputPricePer1M: 0,
			markupPercent: 500, customerInputPricePer1M: 0.02,
			customerOutputPricePer1M: 0.02, upstreamCostKnown: false,
		});
		expect(userFacingFor("flat-price")).toEqual({ inputPer1M: 0.02, outputPer1M: 0.02 });
		expect(getModelPricing("flat-price")).toMatchObject({ costKnown: false });
	});

	it("applies the long-context rate only after its input threshold", () => {
		mockGetModelById.mockReturnValue({
			id: "long-context", inputPricePer1M: 5, outputPricePer1M: 25, markupPercent: 50,
			extendedPricing: { contextTokenThreshold: 272_000, inputPricePer1M: 10, outputPricePer1M: 37.5 },
		});
		expect(userFacingFor("long-context", 272_000)).toEqual({ inputPer1M: 7.5, outputPer1M: 37.5 });
		expect(userFacingFor("long-context", 272_001)).toEqual({ inputPer1M: 15, outputPer1M: 56.25 });
	});

	it("returns override pricing with 0 markup if override exists", () => {
		mockGetModelById.mockReturnValue({
			id: "override-model",
			inputPricePer1M: 10,
			outputPricePer1M: 20,
			markupPercent: 15,
		});

		mockReadModelPricingOverrides.mockReturnValue({
			"override-model": {
				inputPricePer1M: 5,
				outputPricePer1M: 10,
			},
		});

		const pricing = getModelPricing("override-model");
		expect(pricing).toMatchObject({
			inputPer1M: 5,
			outputPer1M: 10,
			markup: 0,
		});
		expect(pricing).toMatchObject({ costInputPer1M: 10, costOutputPer1M: 20 });
	});
	
	it("caches overrides (TTL logic)", () => {
	    vi.useFakeTimers();
	    mockGetModelById.mockReturnValue({
			id: "ttl-model",
			inputPricePer1M: 1,
			outputPricePer1M: 2,
			markupPercent: 0,
		});
		
		mockReadModelPricingOverrides.mockReturnValueOnce({
			"ttl-model": { inputPricePer1M: 100, outputPricePer1M: 200 },
		});
		
		const p1 = getModelPricing("ttl-model");
		expect(p1.inputPer1M).toBe(100);
		expect(mockReadModelPricingOverrides).toHaveBeenCalledTimes(1);
		
		// Advance time by 1s (within TTL)
		vi.advanceTimersByTime(1000);
		const p2 = getModelPricing("ttl-model");
		expect(p2.inputPer1M).toBe(100);
		expect(mockReadModelPricingOverrides).toHaveBeenCalledTimes(1); // Still 1, from cache
		
		// Advance time past TTL (5s)
		vi.advanceTimersByTime(5000);
		mockReadModelPricingOverrides.mockReturnValueOnce({
			"ttl-model": { inputPricePer1M: 300, outputPricePer1M: 400 },
		});
		const p3 = getModelPricing("ttl-model");
		expect(p3.inputPer1M).toBe(300);
		expect(mockReadModelPricingOverrides).toHaveBeenCalledTimes(2); // Fetched again
		
		vi.useRealTimers();
	});
});
