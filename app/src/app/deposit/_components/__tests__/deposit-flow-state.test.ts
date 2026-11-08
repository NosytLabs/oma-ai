import { describe, expect, it } from "vitest";
import {
	canTransitionDepositFlow,
	DEPOSIT_FLOW_STEP,
	depositFlowStepFor,
	depositFlowStepIndex,
	isDepositFlowBusy,
} from "../deposit-flow-state.js";

describe("deposit flow state machine", () => {
	it("maps every event to a step", () => {
		expect(depositFlowStepFor("submit")).toBe(DEPOSIT_FLOW_STEP.Processing);
		expect(depositFlowStepFor("registered")).toBe(DEPOSIT_FLOW_STEP.Complete);
		expect(depositFlowStepFor("wallet-rejected")).toBe(DEPOSIT_FLOW_STEP.Select);
		expect(depositFlowStepFor("failed")).toBe(DEPOSIT_FLOW_STEP.Error);
		expect(depositFlowStepFor("retry")).toBe(DEPOSIT_FLOW_STEP.Processing);
		expect(depositFlowStepFor("reset")).toBe(DEPOSIT_FLOW_STEP.Select);
		expect(depositFlowStepFor("sync-pending")).toBe(DEPOSIT_FLOW_STEP.Error);
		expect(depositFlowStepFor("sync-in-flight")).toBe(DEPOSIT_FLOW_STEP.Processing);
		expect(depositFlowStepFor("sync-none")).toBe(DEPOSIT_FLOW_STEP.Select);
	});

	it("allows the legal moves only", () => {
		expect(canTransitionDepositFlow(DEPOSIT_FLOW_STEP.Select, DEPOSIT_FLOW_STEP.Processing)).toBe(true);
		expect(canTransitionDepositFlow(DEPOSIT_FLOW_STEP.Processing, DEPOSIT_FLOW_STEP.Complete)).toBe(true);
		expect(canTransitionDepositFlow(DEPOSIT_FLOW_STEP.Processing, DEPOSIT_FLOW_STEP.Error)).toBe(true);
		expect(canTransitionDepositFlow(DEPOSIT_FLOW_STEP.Processing, DEPOSIT_FLOW_STEP.Select)).toBe(true);
		expect(canTransitionDepositFlow(DEPOSIT_FLOW_STEP.Select, DEPOSIT_FLOW_STEP.Complete)).toBe(false);
		expect(canTransitionDepositFlow(DEPOSIT_FLOW_STEP.Complete, DEPOSIT_FLOW_STEP.Error)).toBe(false);
	});

	it("knows which step is busy and where the stepper sits", () => {
		expect(isDepositFlowBusy(DEPOSIT_FLOW_STEP.Processing)).toBe(true);
		expect(isDepositFlowBusy(DEPOSIT_FLOW_STEP.Complete)).toBe(false);
		expect(depositFlowStepIndex(DEPOSIT_FLOW_STEP.Select)).toBe(0);
		expect(depositFlowStepIndex(DEPOSIT_FLOW_STEP.Processing)).toBe(1);
		expect(depositFlowStepIndex(DEPOSIT_FLOW_STEP.Complete)).toBe(2);
		expect(depositFlowStepIndex(DEPOSIT_FLOW_STEP.Error)).toBe(1);
	});
});
