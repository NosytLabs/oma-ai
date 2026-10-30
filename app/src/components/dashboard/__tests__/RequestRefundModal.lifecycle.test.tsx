import React, { useState } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UsageRecord } from "@/lib/api";
import { RequestRefundModal } from "../RequestRefundModal";

const mocks = vi.hoisted(() => ({ create: vi.fn(), submitted: vi.fn(), toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/api", () => ({ api: { refunds: { create: mocks.create } } }));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => mocks.toast }));
vi.mock("@/lib/framer-motion-client", () => ({
	AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
	m: { div: ({ children, initial: _initial, animate: _animate, exit: _exit, transition: _transition, ...props }: Record<string, unknown>) => React.createElement("div", props, children as React.ReactNode) },
}));
const record: UsageRecord = { id: "usage-a", requestId: "request-a", apiKeyId: null, model: "minimax-m2-7", provider: "oma-ai", requestedModel: null, billedCents: "25", refundedAt: null, promptTokens: 10, completionTokens: 5, costCents: "20", markupCents: "5", totalCents: "25", latencyMs: 100, status: "completed", createdAt: "2026-01-01T00:00:00Z" };
function Harness() {
	const [target, setTarget] = useState<UsageRecord | null>(record);
	return <><button onClick={() => setTarget({ ...record, id: "usage-b", requestId: "request-b" })}>Open second row</button><RequestRefundModal record={target} onDismiss={() => setTarget(null)} onSubmitted={mocks.submitted} /></>;
}
function submit(reason: string) {
	fireEvent.change(screen.getByRole("textbox", { name: /why are you requesting/i }), { target: { value: reason } });
	fireEvent.click(screen.getByRole("button", { name: "Submit refund request" }));
}
beforeEach(() => { vi.clearAllMocks(); });
afterEach(cleanup);

describe("refund request view lifetime", () => {
	it("does not dismiss a newly opened row when a closed row's submission succeeds", async () => {
		let finish!: () => void;
		mocks.create.mockReturnValueOnce(new Promise<void>(resolve => { finish = resolve; }));
		render(<Harness />);
		submit("The first row was incomplete");
		fireEvent.click(screen.getByRole("button", { name: "Close refund dialog" }));
		fireEvent.click(screen.getByRole("button", { name: "Open second row" }));
		fireEvent.change(screen.getByRole("textbox", { name: /why are you requesting/i }), { target: { value: "Keep the second row's draft" } });
		await act(async () => { finish(); });
		expect(screen.getByRole("dialog", { name: "Request a refund" })).toHaveTextContent("request-b");
		expect(screen.getByRole("textbox", { name: /why are you requesting/i })).toHaveValue("Keep the second row's draft");
		expect(mocks.submitted).toHaveBeenCalledOnce();
		expect(mocks.toast.success).not.toHaveBeenCalled();
	});

	it("does not show an old error or reset the new row's pending state", async () => {
		let failFirst!: (error: Error) => void;
		let finishSecond!: () => void;
		mocks.create.mockReturnValueOnce(new Promise<void>((_resolve, reject) => { failFirst = reject; }))
			.mockReturnValueOnce(new Promise<void>(resolve => { finishSecond = resolve; }));
		render(<Harness />);
		submit("The first request was incomplete");
		fireEvent.click(screen.getByRole("button", { name: "Close refund dialog" }));
		fireEvent.click(screen.getByRole("button", { name: "Open second row" }));
		submit("The second request was incomplete");
		await act(async () => { failFirst(new Error("Old row failure")); });
		expect(screen.queryByRole("alert")).not.toBeInTheDocument();
		expect(screen.getByRole("textbox", { name: /why are you requesting/i })).toBeDisabled();
		expect(mocks.toast.error).not.toHaveBeenCalled();
		await act(async () => { finishSecond(); });
	});
});
