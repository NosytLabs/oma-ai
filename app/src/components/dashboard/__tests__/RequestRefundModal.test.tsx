/**
 * Tests for the user-facing refund submission modal.
 *
 * Contracts locked in here:
 *   - 10..1000 char reason window matches the server's createRefundSchema
 *   - submit disabled when reason is empty or over 1000 chars
 *   - submit enabled once reason reaches 10 chars
 *   - cancel button + close (×) button both call onDismiss
 *   - reason counter updates as the user types
 *
 * The async submit + error-banner + query-invalidation paths need a
 * full QueryClient + module mock harness — covered by the
 * refunds.test.ts unit at the api-call layer; here we lock in the
 * form-level contract that gates whether submit fires at all.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RequestRefundModal } from "../RequestRefundModal";
import type { UsageRecord } from "@/lib/api";

const baseRecord: UsageRecord = {
	id: "use-1",
	requestId: "req-1",
	apiKeyId: null,
	model: "minimax-m2-7",
	provider: "openai",
	requestedModel: null,
	billedCents: "3.2",
	refundedAt: null,
	promptTokens: 18,
	completionTokens: 12,
	costCents: "2.5",
	markupCents: "0.7",
	totalCents: "3.2",
	latencyMs: 80,
	status: "completed",
	createdAt: "2026-10-19T12:00:00Z",
};

function renderModal(
	overrides: Partial<{
		record: UsageRecord | null;
		onDismiss: () => void;
		onSubmitted: () => void;
	}> = {},
) {
	const onDismiss = overrides.onDismiss ?? vi.fn();
	const onSubmitted = overrides.onSubmitted ?? vi.fn();
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	const utils = render(
		<QueryClientProvider client={queryClient}>
			<RequestRefundModal
				record={overrides.record ?? baseRecord}
				onDismiss={onDismiss}
				onSubmitted={onSubmitted}
			/>
		</QueryClientProvider>,
	);
	return { ...utils, onDismiss, onSubmitted };
}

// RTL doesn't auto-clean in this setup.ts (no @testing-library/react
// afterEach import); wire it ourselves so per-test renders don't pollute
// each other through AnimatePresence's exit-transition trees.
beforeEach(() => {
	cleanup();
});

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

describe("RequestRefundModal", () => {
	it("renders the dialog with model, charge, request id, and form when record is provided", () => {
		renderModal();
		const dialog = screen.getByRole("dialog");
		expect(dialog).toHaveAttribute("aria-modal", "true");
		expect(dialog).toHaveAccessibleName(/request a refund/i);
		// Description text is rendered for the aria-describedby wiring.
		expect(dialog.textContent).toMatch(/this one request only/i);
		// Request id appears in the summary dl.
		expect(dialog.textContent).toContain("req-1");
		// Form is present.
		expect(
			screen.getByRole("textbox", { name: /why are you requesting/i }),
		).toBeInTheDocument();
		// Both footer buttons render.
		expect(screen.getByRole("button", { name: /^cancel$/i })).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /submit refund request/i }),
		).toBeInTheDocument();
	});

	it("Submit is disabled while reason is empty", () => {
		renderModal();
		const submit = screen.getByRole("button", { name: /submit refund request/i });
		expect(submit).toBeDisabled();
	});

	it("Submit is disabled when reason is below the 10-char minimum", () => {
		renderModal();
		const textarea = screen.getByRole("textbox", { name: /why are you requesting/i });
		fireEvent.change(textarea, { target: { value: "short" } });
		const submit = screen.getByRole("button", { name: /submit refund request/i });
		expect(submit).toBeDisabled();
	});

	it("Submit enables once reason reaches exactly 10 characters", () => {
		renderModal();
		const textarea = screen.getByRole("textbox", { name: /why are you requesting/i });
		fireEvent.change(textarea, { target: { value: "abcdefghij" } });
		const submit = screen.getByRole("button", { name: /submit refund request/i });
		expect(submit).not.toBeDisabled();
	});

	it("Submit disables when reason crosses 1000 chars", () => {
		renderModal();
		const textarea = screen.getByRole("textbox", { name: /why are you requesting/i });
		const tooLong = "x".repeat(1001);
		fireEvent.change(textarea, { target: { value: tooLong } });
		const submit = screen.getByRole("button", { name: /submit refund request/i });
		expect(submit).toBeDisabled();
	});

	it("reason counter shows character count as the user types", () => {
		renderModal();
		const textarea = screen.getByRole("textbox", { name: /why are you requesting/i });
		fireEvent.change(textarea, { target: { value: "abcde" } });
		expect(screen.getByText(/5\s*\/\s*1000/)).toBeInTheDocument();
	});

	it("Cancel button calls onDismiss", () => {
		const onDismiss = vi.fn();
		renderModal({ onDismiss });
		fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));
		expect(onDismiss).toHaveBeenCalledTimes(1);
	});

	it("Close (×) button calls onDismiss", () => {
		const onDismiss = vi.fn();
		renderModal({ onDismiss });
		fireEvent.click(screen.getByRole("button", { name: /close refund dialog/i }));
		expect(onDismiss).toHaveBeenCalledTimes(1);
	});
});
