import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
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
