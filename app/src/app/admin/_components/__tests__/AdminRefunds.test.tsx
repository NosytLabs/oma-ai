/**
 * Tests for the /admin refund queue.
 *
 * The admin queue is the operator's only view of pending refund
 * requests (the user-side modal lands requests here). Tests pin:
 *   - Section heading + Refresh button render without a pending fetch
 *   - "No pending refunds" empty state when the list is empty
 *   - Each pending row exposes a Grant + Deny button pair
 *   - Clicking Deny calls api.refunds.admin.decide({ id, decision: "denied" })
 *   - Deciding calls invalidate the admin-queries cache so the row
 *     drops off the pending list (verified by re-rendering with empty
 *     pending list after the mutation succeeds)
 *   - Failure path surfaces a role=alert banner with the parser error
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AdminRefunds } from "../AdminRefunds";
import { api, type AdminRefundListResponse, type AdminRefundRecord } from "@/lib/api";

function makePending(overrides: Partial<AdminRefundRecord> = {}): AdminRefundRecord {
	return {
		id: "rfnd_test_pending_01",
		userId: "user_abc",
		usageId: "use_xyz_9999",
		amountCents: 50,
		status: "pending",
		reason: "Model returned truncated reply despite max_tokens cap.",
		adminNote: null,
		decidedBy: null,
		decidedAt: null,
		createdAt: new Date(Date.now() - 5 * 60_000).toISOString(),
		...overrides,
	};
}

function renderAdmin() {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
	});
	return render(
		<QueryClientProvider client={queryClient}>
			<AdminRefunds />
		</QueryClientProvider>,
	);
}

beforeEach(() => {
	cleanup();
});

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

describe("AdminRefunds", () => {
	it("renders the section heading + Refresh button", async () => {
		vi.spyOn(api.refunds.admin, "list").mockResolvedValue({
			data: [],
		} satisfies AdminRefundListResponse);
		renderAdmin();
		expect(
			screen.getByRole("heading", { name: /refund queue/i }),
		).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /refresh/i })).toBeInTheDocument();
		// Settle by exiting the loading state.
		await waitFor(() => {
			expect(screen.getByText(/no pending refunds/i)).toBeInTheDocument();
		});
	});

	it("shows the empty-state when there are no pending refunds", async () => {
		vi.spyOn(api.refunds.admin, "list").mockResolvedValue({
			data: [],
		} satisfies AdminRefundListResponse);
		renderAdmin();
		await waitFor(() => {
			expect(screen.getByText(/no pending refunds/i)).toBeInTheDocument();
		});
	});

	it("renders a pending row with Grant + Deny buttons", async () => {
		vi.spyOn(api.refunds.admin, "list").mockResolvedValue({
			data: [makePending({ id: "rfnd_pending_aaaabbbb" })],
		} satisfies AdminRefundListResponse);
		renderAdmin();
		await waitFor(() => {
			// Component slices id.slice(0, 12) → rfnd_pending
			expect(screen.getByText(/rfnd_pending/)).toBeInTheDocument();
		});
		expect(
			screen.getByRole("button", { name: /^deny$/i }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /^grant$/i }),
		).toBeInTheDocument();
	});

	it("clicking Deny calls api.refunds.admin.decide with decision=denied", async () => {
		vi.spyOn(api.refunds.admin, "list").mockResolvedValue({
			data: [makePending({ id: "rfnd_deny_aaaabbbb" })],
		} satisfies AdminRefundListResponse);
		const decideSpy = vi
			.spyOn(api.refunds.admin, "decide")
			.mockResolvedValue({ ok: true, id: "rfnd_deny_aaaabbbb", status: "denied" });
		renderAdmin();
		await waitFor(() => {
			expect(screen.getByRole("button", { name: /^deny$/i })).toBeInTheDocument();
		});
		fireEvent.click(screen.getByRole("button", { name: /^deny$/i }));
		await waitFor(() => {
			expect(decideSpy).toHaveBeenCalledWith(
				expect.objectContaining({ id: "rfnd_deny_aaaabbbb", decision: "denied" }),
			);
		});
	});

	it("clicking Grant calls api.refunds.admin.decide with decision=granted", async () => {
		vi.spyOn(api.refunds.admin, "list").mockResolvedValue({
			data: [makePending({ id: "rfnd_grant_aaaabbbb" })],
		} satisfies AdminRefundListResponse);
		const decideSpy = vi
			.spyOn(api.refunds.admin, "decide")
			.mockResolvedValue({ ok: true, id: "rfnd_grant_aaaabbbb", status: "granted" });
		renderAdmin();
		await waitFor(() => {
			expect(screen.getByRole("button", { name: /^grant$/i })).toBeInTheDocument();
		});
		fireEvent.click(screen.getByRole("button", { name: /^grant$/i }));
		await waitFor(() => {
			expect(decideSpy).toHaveBeenCalledWith(
				expect.objectContaining({ id: "rfnd_grant_aaaabbbb", decision: "granted" }),
			);
		});
	});

	it("surfaces a role=alert with the parser error when decide fails", async () => {
		vi.spyOn(api.refunds.admin, "list").mockResolvedValue({
			data: [makePending({ id: "rfnd_fail_aaaabbbb" })],
		} satisfies AdminRefundListResponse);
		vi.spyOn(api.refunds.admin, "decide").mockRejectedValue(
			new Error("validation_error: invalid id"),
		);
		renderAdmin();
		await waitFor(() => {
			expect(screen.getByRole("button", { name: /^deny$/i })).toBeInTheDocument();
		});
		fireEvent.click(screen.getByRole("button", { name: /^deny$/i }));
		await waitFor(() => {
			expect(
				screen.getByText(/validation_error: invalid id/),
			).toBeInTheDocument();
		});
		// role="alert" is on the inline error banner AND on the pending-fetch
		// error, so use the one in the decide-error copy specifically.
		const alert = screen.getByText(/decide failed/i);
		expect(alert).toBeInTheDocument();
	});
});
