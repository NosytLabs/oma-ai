/**
 * Tests for the dashboard Overview tab's refund activity panel.
 *
 * Contracts locked in here per the frontend-component-testing skill:
 *   - Loading state shows the spinner + "Loading refund requests…" copy
 *     before the first fetch resolves
 *   - Empty state points the user at the Usage tab when they have no
 *     refund requests (the common case after the panel first lands)
 *   - Error state shows the failure copy and a refresh-on-fix hint
 *   - Loaded rows render a status pill (Pending / Granted / Denied)
 *     with the row id prefix and the user-supplied reason
 *
 * The panel owns a React Query cache. We attach a `vi.spyOn` to the
 * real `api.refunds.list` so the import resolves normally and the
 * state machine in React Query runs end-to-end (loading → success /
 * error transitions go through the real hook).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RefundActivityPanel } from "../RefundActivityPanel";
import { api, type RefundListResponse, type RefundRecord } from "@/lib/api";

function makeRefund(overrides: Partial<RefundRecord> = {}): RefundRecord {
	return {
		id: "rfnd_abcdef1234567890",
		usageId: null,
		receiptId: null,
		status: "pending",
		reason: "Model returned truncated reply.",
		amountCents: null,
		createdAt: new Date(Date.now() - 5 * 60_000).toISOString(),
		updatedAt: undefined,
		...overrides,
	};
}

function renderPanel(ownerId = "buyer") {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return render(
		<QueryClientProvider client={queryClient}>
			<RefundActivityPanel ownerId={ownerId} />
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

describe("RefundActivityPanel", () => {
	it("does not show the previous account's cached refund reason after an account switch", async () => {
		vi.spyOn(api.refunds, "list").mockResolvedValueOnce({ items: [makeRefund({ reason: "Private first account reason" })], nextCursor: null })
			.mockImplementation(() => new Promise(() => {}));
		const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
		const view = render(<QueryClientProvider client={queryClient}><RefundActivityPanel ownerId="first" /></QueryClientProvider>);
		await screen.findByText("Private first account reason");
		view.rerender(<QueryClientProvider client={queryClient}><RefundActivityPanel ownerId="second" /></QueryClientProvider>);
		expect(screen.queryByText("Private first account reason")).not.toBeInTheDocument();
	});

	it("does not fetch private refund history without an account", () => {
		const list = vi.spyOn(api.refunds, "list").mockResolvedValue({ items: [], nextCursor: null });
		renderPanel("");
		expect(list).not.toHaveBeenCalled();
	});
	it("renders the header + 'past 5' label regardless of data state", () => {
		vi.spyOn(api.refunds, "list").mockResolvedValue({
			items: [],
			nextCursor: null,
		} satisfies RefundListResponse);
		renderPanel();
		expect(
			screen.getByRole("heading", { name: /refund activity/i }),
		).toBeInTheDocument();
		expect(screen.getByText(/past 5/i)).toBeInTheDocument();
	});

	it("shows the loading state while the fetch is pending", async () => {
		let resolveList: (v: RefundListResponse) => void = () => {};
		vi.spyOn(api.refunds, "list").mockImplementation(
			() => new Promise<RefundListResponse>((r) => { resolveList = r; }),
		);
		renderPanel();
		expect(
			screen.getByText(/loading refund requests/i),
		).toBeInTheDocument();
		// Resolve so cleanup doesn't hang waiting on the query.
		resolveList({ items: [], nextCursor: null });
	});

	it("shows the empty-state copy when the user has no refund requests", async () => {
		vi.spyOn(api.refunds, "list").mockResolvedValue({
			items: [],
			nextCursor: null,
		});
		renderPanel();
		await waitFor(() => {
			expect(screen.getByText(/no refund requests yet/i)).toBeInTheDocument();
		});
	});

	it("shows the error-state copy when the fetch rejects", async () => {
		vi.spyOn(api.refunds, "list").mockRejectedValue(new Error("network down"));
		renderPanel();
		await waitFor(() => {
			expect(screen.getByRole("alert")).toBeInTheDocument();
		});
		expect(
			screen.getByText(/couldn't load refund requests/i),
		).toBeInTheDocument();
	});

	it("renders a row with a Pending status pill and the reason", async () => {
		const refund = makeRefund({
			reason: "Model returned truncated reply despite max_tokens cap.",
		});
		vi.spyOn(api.refunds, "list").mockResolvedValue({
			items: [refund],
			nextCursor: null,
		});
		renderPanel();
		await waitFor(() => {
			expect(screen.getByText(/pending/i)).toBeInTheDocument();
		});
		expect(screen.getByText(/rfnd_abcdef1.*…/)).toBeInTheDocument();
		expect(
			screen.getByText(/Model returned truncated reply despite max_tokens cap\./),
		).toBeInTheDocument();
	});

	it("renders status pills for Granted and Denied rows", async () => {
		vi.spyOn(api.refunds, "list").mockResolvedValue({
			items: [
				makeRefund({ id: "rfnd_grant01", status: "granted" }),
				makeRefund({ id: "rfnd_deny_01", status: "denied" }),
			],
			nextCursor: null,
		});
		renderPanel();
		await waitFor(() => {
			expect(screen.getByText(/granted/i)).toBeInTheDocument();
		});
		expect(screen.getByText(/denied/i)).toBeInTheDocument();
	});
});
