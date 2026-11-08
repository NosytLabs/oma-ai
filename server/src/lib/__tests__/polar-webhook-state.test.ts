/**
 * Contract for the Polar webhook processing vocabulary.
 *
 * `polar_webhook_events.processed` is an integer flag; the point of this
 * module is that the two values have names. These tests lock the numbers in
 * place so a future refactor cannot silently flip "claimed" and "handled".
 */
import { describe, expect, it } from "vitest";
import {
	POLAR_EVENT_PROCESSING,
	isPolarEventProcessed,
	type PolarEventProcessing,
} from "../polar-webhook-state.js";

describe("POLAR_EVENT_PROCESSING", () => {
	it("keeps the persisted integer values", () => {
		expect(POLAR_EVENT_PROCESSING.Pending).toBe(0);
		expect(POLAR_EVENT_PROCESSING.Processed).toBe(1);
	});

	it("exposes exactly the two states the column can hold", () => {
		const values: PolarEventProcessing[] = Object.values(POLAR_EVENT_PROCESSING);
		expect(values.sort()).toEqual([0, 1]);
	});
});

describe("isPolarEventProcessed", () => {
	it("is true only for the processed state", () => {
		expect(isPolarEventProcessed(POLAR_EVENT_PROCESSING.Processed)).toBe(true);
		expect(isPolarEventProcessed(POLAR_EVENT_PROCESSING.Pending)).toBe(false);
	});

	it("treats an unknown or missing value as not processed", () => {
		expect(isPolarEventProcessed(undefined)).toBe(false);
		expect(isPolarEventProcessed(null)).toBe(false);
		expect(isPolarEventProcessed(2)).toBe(false);
		expect(isPolarEventProcessed(-1)).toBe(false);
	});
});
