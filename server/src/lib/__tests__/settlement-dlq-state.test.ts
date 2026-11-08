/**
 * Contract for the settlement DLQ retry vocabulary.
 *
 * A queued settlement has no status column: its state is derived from the
 * attempt count. These tests pin the derivation so the drain loop, the ops
 * surfaces and the retry ceiling cannot drift apart.
 */
import { describe, expect, it } from "vitest";
import {
	SETTLEMENT_DLQ_MAX_ATTEMPTS,
	SETTLEMENT_DLQ_STATE,
	isSettlementDlqAbandoned,
	settlementDlqBackoffMs,
	settlementDlqState,
} from "../settlement-dlq-state.js";

describe("settlement DLQ state", () => {
	it("names exactly two states", () => {
		expect(Object.values(SETTLEMENT_DLQ_STATE).sort()).toEqual([
			"abandoned",
			"pending",
		]);
	});

	it("keeps an entry pending until the retry ceiling is reached", () => {
		expect(settlementDlqState(1)).toBe(SETTLEMENT_DLQ_STATE.Pending);
		expect(settlementDlqState(SETTLEMENT_DLQ_MAX_ATTEMPTS - 1)).toBe(
			SETTLEMENT_DLQ_STATE.Pending,
		);
	});

	it("abandons an entry exactly at the retry ceiling", () => {
		expect(settlementDlqState(SETTLEMENT_DLQ_MAX_ATTEMPTS)).toBe(
			SETTLEMENT_DLQ_STATE.Abandoned,
		);
		expect(settlementDlqState(SETTLEMENT_DLQ_MAX_ATTEMPTS + 5)).toBe(
			SETTLEMENT_DLQ_STATE.Abandoned,
		);
	});

	it("agrees with the abandoned predicate", () => {
		for (let attempts = 0; attempts <= SETTLEMENT_DLQ_MAX_ATTEMPTS + 2; attempts++) {
			expect(isSettlementDlqAbandoned(attempts)).toBe(
				settlementDlqState(attempts) === SETTLEMENT_DLQ_STATE.Abandoned,
			);
		}
	});
});

describe("settlementDlqBackoffMs", () => {
	it("grows exponentially from the base delay", () => {
		expect(settlementDlqBackoffMs(1)).toBe(1_000);
		expect(settlementDlqBackoffMs(2)).toBe(2_000);
		expect(settlementDlqBackoffMs(3)).toBe(4_000);
	});

	it("caps the delay", () => {
		expect(settlementDlqBackoffMs(20)).toBe(5 * 60_000);
		expect(settlementDlqBackoffMs(SETTLEMENT_DLQ_MAX_ATTEMPTS)).toBe(5 * 60_000);
	});
});
