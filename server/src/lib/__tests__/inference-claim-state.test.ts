import { describe, expect, it } from "vitest";
import {
	canTransitionClaimState,
	CLAIM_RELEASED,
	CLAIM_STATE,
	CLAIM_STATES,
	isReplayBlockedClaimState,
	parseClaimState,
} from "../inference-claim-state.js";

describe("idempotency claim state vocabulary", () => {
	it("matches the CHECK constraint on the column", () => {
		expect([...CLAIM_STATES]).toEqual(["pending", "completed"]);
	});

	it("parses stored values only", () => {
		expect(parseClaimState("pending")).toBe(CLAIM_STATE.Pending);
		expect(parseClaimState("released")).toBeNull();
	});

	it("blocks replay only for a completed claim", () => {
		expect(isReplayBlockedClaimState(CLAIM_STATE.Completed)).toBe(true);
		expect(isReplayBlockedClaimState(CLAIM_STATE.Pending)).toBe(false);
	});

	it("allows pending to complete or be released, and nothing after", () => {
		expect(canTransitionClaimState(CLAIM_STATE.Pending, CLAIM_STATE.Completed)).toBe(true);
		expect(canTransitionClaimState(CLAIM_STATE.Pending, CLAIM_RELEASED)).toBe(true);
		expect(canTransitionClaimState(CLAIM_STATE.Completed, CLAIM_STATE.Pending)).toBe(false);
		expect(canTransitionClaimState(CLAIM_RELEASED, CLAIM_STATE.Pending)).toBe(false);
	});
});
