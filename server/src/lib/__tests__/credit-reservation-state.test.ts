import { describe, expect, it } from "vitest";
import {
	canTransitionReservationState,
	isOpenReservationState,
	parseReservationState,
	RESERVATION_STATE,
	RESERVATION_STATES,
} from "../credit-reservation-state.js";

describe("credit reservation state vocabulary", () => {
	it("names every stored state", () => {
		expect([...RESERVATION_STATES]).toEqual([
			"held",
			"released",
			"reconciliation",
			"settled",
		]);
	});

	it("parses stored values only", () => {
		expect(parseReservationState("held")).toBe(RESERVATION_STATE.Held);
		expect(parseReservationState("refunded")).toBeNull();
		expect(parseReservationState(undefined)).toBeNull();
	});

	it("treats held and reconciliation as open claims on the balance", () => {
		expect(isOpenReservationState(RESERVATION_STATE.Held)).toBe(true);
		expect(isOpenReservationState(RESERVATION_STATE.Reconciliation)).toBe(true);
		expect(isOpenReservationState(RESERVATION_STATE.Released)).toBe(false);
		expect(isOpenReservationState(RESERVATION_STATE.Settled)).toBe(false);
	});

	it("never releases an ambiguous hold silently", () => {
		expect(canTransitionReservationState(RESERVATION_STATE.Held, RESERVATION_STATE.Released)).toBe(true);
		expect(canTransitionReservationState(RESERVATION_STATE.Held, RESERVATION_STATE.Reconciliation)).toBe(true);
		expect(canTransitionReservationState(RESERVATION_STATE.Held, RESERVATION_STATE.Settled)).toBe(true);
		expect(canTransitionReservationState(RESERVATION_STATE.Reconciliation, RESERVATION_STATE.Settled)).toBe(true);
		expect(canTransitionReservationState(RESERVATION_STATE.Reconciliation, RESERVATION_STATE.Released)).toBe(false);
		expect(canTransitionReservationState(RESERVATION_STATE.Settled, RESERVATION_STATE.Released)).toBe(false);
	});
});
