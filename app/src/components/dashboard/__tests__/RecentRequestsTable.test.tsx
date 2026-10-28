import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LazyMotion, domAnimation } from "framer-motion";
import { RecentRequestsTable } from "../RecentRequestsTable";
import { api, type UsageRecord } from "@/lib/api";

const clients: QueryClient[] = [];
const usage: UsageRecord = {
	id: "11111111-1111-4111-8111-111111111111", requestId: "charged-request", apiKeyId: null,
	model: "minimax-m2-7", provider: "oma-ai", billedCents: "0.25", totalCents: "0.25",
	costCents: "0", markupCents: "0", promptTokens: 10, completionTokens: 5,
	latencyMs: 100, status: "completed", createdAt: new Date().toISOString(),
};
afterEach(() => { cleanup(); clients.forEach(client => client.clear()); clients.length = 0; vi.restoreAllMocks(); });

describe("refund release compatibility", () => {
	it("invalidates only the initiating account when a closed refund request succeeds", async () => {
		let finish!: (value: Awaited<ReturnType<typeof api.refunds.create>>) => void;
		vi.spyOn(api.refunds, "create").mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
		const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
		clients.push(client);
		for (const owner of ["buyer-a", "buyer-b"]) {
			client.setQueryData(["refunds", owner, "list"], { items: [], nextCursor: null, creditRefundsAvailable: true });
			client.setQueryData(["usage", owner, "7d"], { records: [usage] });
			client.setQueryData(["balance", owner], { balanceCents: "1000" });
		}
		const view = render(<QueryClientProvider client={client}><LazyMotion features={domAnimation}><RecentRequestsTable ownerId="buyer-a" usage={[usage]} loading={false} page={1} limit={25} onPageChange={() => {}} /></LazyMotion></QueryClientProvider>);
		fireEvent.click(screen.getByRole("button", { name: /request a refund/i }));
		fireEvent.change(screen.getByRole("textbox", { name: /why are you requesting/i }), { target: { value: "This response was incomplete" } });
		fireEvent.click(screen.getByRole("button", { name: "Submit refund request" }));
		view.unmount();
		await act(async () => { finish({ id: "synthetic-refund", status: "pending", createdAt: "2026-01-01T00:00:00Z" }); });
		for (const key of [["usage", "buyer-a", "7d"], ["balance", "buyer-a"], ["refunds", "buyer-a", "list"]]) expect(client.getQueryState(key)?.isInvalidated).toBe(true);
		for (const key of [["usage", "buyer-b", "7d"], ["balance", "buyer-b"], ["refunds", "buyer-b", "list"]]) expect(client.getQueryState(key)?.isInvalidated).toBe(false);
	});

	it.each([undefined, false, true])("only exposes credit-refund intake when the backend supports it: %j", (capability) => {
		vi.spyOn(api.refunds, "list").mockResolvedValue({ items: [], nextCursor: null, creditRefundsAvailable: capability });
		const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
		clients.push(client);
		client.setQueryData(["refunds", "buyer", "list"], { items: [], nextCursor: null, creditRefundsAvailable: capability });
		render(<QueryClientProvider client={client}><LazyMotion features={domAnimation}>
			<RecentRequestsTable ownerId="buyer" usage={[usage]} loading={false} page={1} limit={25} onPageChange={() => {}} />
		</LazyMotion></QueryClientProvider>);
		const button = screen.queryByRole("button", { name: /request a refund/i });
		if (capability === true) expect(button).toBeInTheDocument();
		else expect(button).not.toBeInTheDocument();
	});
});
