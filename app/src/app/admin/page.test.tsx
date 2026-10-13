import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import AdminPage from "./page";

vi.mock("@/lib/hooks/useAuth", () => ({ useAuth: () => ({ isReady: true, isAuthenticated: true, isAdmin: true, user: { id: "operator", name: "Operator" } }) }));

const clients: QueryClient[] = [];
afterEach(() => { cleanup(); clients.forEach(client => client.clear()); clients.length = 0; vi.restoreAllMocks(); });
const user = (id: string) => ({ id, email: `${id}@example.test`, name: id, role: "user", suspended: false, suspendedReason: null,
	createdAt: "2026-10-13T00:00:00Z", balanceCents: "0", totalDepositedCents: "0", usage: { requests: 0, totalCents: "0" } });
function renderAdmin(fetchUsers: (url: URL) => Response) {
	vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
		const url = new URL(input instanceof Request ? input.url : String(input), "https://www.oma-ai.com");
		return url.pathname === "/api/v1/admin/users" ? fetchUsers(url) : Response.json({ error: "unavailable" }, { status: 503 });
	});
	const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } }); clients.push(client);
	render(<QueryClientProvider client={client}><ToastProvider><AdminPage /></ToastProvider></QueryClientProvider>);
	return within(screen.getByRole("region", { name: "User management" }));
}

describe("admin user list recovery", () => {
	it("can retry an initial failed page without reloading the console", async () => {
		let unavailable = true;
		const section = renderAdmin(() => unavailable ? Response.json({}, { status: 503 }) : Response.json({ items: [user("first-user")], nextCursor: null }));
		const retry = await section.findByRole("button", { name: "Retry users" });
		unavailable = false; fireEvent.click(retry);
		expect(await section.findByText("first-user@example.test")).toBeVisible();
	});

	it("keeps loaded users and can retry a failed next page", async () => {
		let unavailable = true;
		const section = renderAdmin(url => !url.searchParams.has("cursor") ? Response.json({ items: [user("first-user")], nextCursor: "first-user" })
			: unavailable ? Response.json({}, { status: 503 }) : Response.json({ items: [user("second-user")], nextCursor: null }));
		expect(await section.findByText("first-user@example.test")).toBeVisible();
		fireEvent.click(section.getByRole("button", { name: "Load more" }));
		const retry = await section.findByRole("button", { name: "Retry users" });
		expect(section.getByText("first-user@example.test")).toBeVisible();
		unavailable = false; fireEvent.click(retry);
		expect(await section.findByText("second-user@example.test")).toBeVisible();
		expect(section.getByText("first-user@example.test")).toBeVisible();
		expect(section.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument();
	});
});
