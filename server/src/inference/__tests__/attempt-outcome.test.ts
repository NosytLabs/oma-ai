/**
 * Contract for the inference failure vocabulary.
 *
 * The release rule decides whether a user's held credits come back after a
 * failed request, so it must be identical everywhere it is applied. These
 * tests pin the classification and the rule.
 */
import { describe, expect, it } from "vitest";
import {
	INFERENCE_FAILURE_OUTCOME,
	inferenceFailureOutcome,
	shouldReleaseInferenceReservation,
} from "../attempt-outcome.js";

describe("inferenceFailureOutcome", () => {
	it("names an attempt that never reached the provider", () => {
		expect(
			inferenceFailureOutcome({
				providerStarted: false,
				executionRejected: false,
				billingUncertain: false,
			}),
		).toBe(INFERENCE_FAILURE_OUTCOME.NotStarted);
	});

	it("names an explicit rejection", () => {
		expect(
			inferenceFailureOutcome({
				providerStarted: true,
				executionRejected: true,
				billingUncertain: false,
			}),
		).toBe(INFERENCE_FAILURE_OUTCOME.Rejected);
	});

	it("prefers billing uncertainty over an explicit rejection", () => {
		expect(
			inferenceFailureOutcome({
				providerStarted: true,
				executionRejected: true,
				billingUncertain: true,
			}),
		).toBe(INFERENCE_FAILURE_OUTCOME.BillingUncertain);
	});

	it("names a failure after work started", () => {
		expect(
			inferenceFailureOutcome({
				providerStarted: true,
				executionRejected: false,
				billingUncertain: false,
			}),
		).toBe(INFERENCE_FAILURE_OUTCOME.Failed);
	});
});

describe("shouldReleaseInferenceReservation", () => {
	it("releases only the outcomes that provably did not charge", () => {
		expect(
			shouldReleaseInferenceReservation(INFERENCE_FAILURE_OUTCOME.NotStarted),
		).toBe(true);
		expect(shouldReleaseInferenceReservation(INFERENCE_FAILURE_OUTCOME.Rejected)).toBe(
			true,
		);
		expect(
			shouldReleaseInferenceReservation(INFERENCE_FAILURE_OUTCOME.BillingUncertain),
		).toBe(false);
		expect(shouldReleaseInferenceReservation(INFERENCE_FAILURE_OUTCOME.Failed)).toBe(
			false,
		);
	});
});
