/**
 * The model-availability RULE is what decides how many models the product
 * claims to have. It was open-coded as `available !== false` in ten call sites
 * before being centralised here; these tests pin the semantics so a future
 * edit cannot quietly flip the whole site between "2 live models" and
 * "20 models available" — which is exactly the contradiction that shipped.
 *
 * (The adjacent `models-data` test covers the API CLIENT carrying the flag.
 * This file covers the pure rule itself.)
 */

import { describe, it, expect } from "vitest";
import {
	isModelAvailable,
	selectAvailableModels,
} from "@/lib/model-availability";

describe("isModelAvailable", () => {
	it("treats an explicit false as offline", () => {
		expect(isModelAvailable({ available: false })).toBe(false);
	});

	it("treats an explicit true as online", () => {
		expect(isModelAvailable({ available: true })).toBe(true);
	});

	it("treats an OMITTED flag as available (the API field is optional)", () => {
		expect(isModelAvailable({})).toBe(true);
	});
});

describe("selectAvailableModels", () => {
	it("keeps only models that are not explicitly offline", () => {
		const models = [
			{ id: "a", available: true },
			{ id: "b", available: false },
			{ id: "c" },
		];
		expect(selectAvailableModels(models).map((m) => m.id)).toEqual(["a", "c"]);
	});

	it("returns an empty list rather than throwing on no models", () => {
		expect(selectAvailableModels([])).toEqual([]);
	});
});
