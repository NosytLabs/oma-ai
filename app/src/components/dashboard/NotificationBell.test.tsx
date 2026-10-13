import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LazyMotion, domAnimation } from "@/lib/framer-motion-client";
import { NotificationBell } from "./NotificationBell";

const auth = vi.hoisted(() => ({ id: "account-a" as string | null, ready: true }));
vi.mock("@/lib/hooks/useAuth", () => ({ useAuth: () => ({ user: auth.id ? { id: auth.id } : null,
	isReady: auth.ready, isAuthenticated: Boolean(auth.id), isDemo: false }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {} }) }));

const clients: QueryClient[] = [];
const depositRow = (id: string, amountUsd = "25.00") => ({ id, status: "completed", amountUsd, creditsIssued: "2500", txHash: null, createdAt: new Date().toISOString() });
function mountBell() {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } }); clients.push(client);
	const tree = () => <QueryClientProvider client={client}><LazyMotion features={domAnimation}><NotificationBell /></LazyMotion></QueryClientProvider>;
	const rendered = render(tree());
	return { ...rendered, refresh: () => rendered.rerender(tree()) };
}
beforeEach(() => { auth.id = "account-a"; auth.ready = true; localStorage.clear(); });
afterEach(() => { cleanup(); clients.forEach(client => client.clear()); clients.length = 0; vi.restoreAllMocks(); });

describe("account deposit notifications", () => {
	it("displays deposit dollars without converting them from cents again", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ deposits: [depositRow("deposit-a")] }));
		mountBell(); fireEvent.click(await screen.findByRole("button", { name: "Notifications (1 new)" }));
		const amount = await screen.findByText("$25.00");
		await waitFor(() => expect(amount).toBeVisible());
	});

	it("does not reuse one account's cached payments after an account switch", async () => {
		vi.spyOn(globalThis, "fetch").mockImplementation(async () => Response.json({ deposits: auth.id === "account-a" ? [depositRow("deposit-a")] : [] }));
		const view = mountBell(); await screen.findByRole("button", { name: "Notifications (1 new)" });
		auth.id = "account-b"; view.refresh();
		await waitFor(() => expect(screen.queryByRole("button", { name: "Notifications (1 new)" })).not.toBeInTheDocument());
		fireEvent.click(screen.getByRole("button", { name: "Notifications" }));
		const emptyMessage = await screen.findByText("No notifications");
		await waitFor(() => expect(emptyMessage).toBeVisible());
		expect(screen.queryByRole("button", { name: /deposit notification/ })).not.toBeInTheDocument();
	});

	it("does not fetch or render a payment menu while signed out", async () => {
		auth.id = null;
		vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ deposits: [] }));
		const view = mountBell();
		expect(view.container).toBeEmptyDOMElement();
		expect(globalThis.fetch).not.toHaveBeenCalled();
	});

	it("offers a retry when payment history is unavailable instead of claiming it is empty", async () => {
		let unavailable = true;
		vi.spyOn(globalThis, "fetch").mockImplementation(async () => unavailable ? Response.json({}, { status: 503 }) : Response.json({ deposits: [depositRow("deposit-a")] }));
		mountBell(); fireEvent.click(screen.getByRole("button", { name: "Notifications" }));
		const retry = await screen.findByRole("button", { name: "Retry notifications" });
		expect(screen.queryByText("No notifications")).not.toBeInTheDocument();
		unavailable = false; fireEvent.click(retry);
		const notification = await screen.findByRole("button", { name: /deposit notification/ });
		await waitFor(() => expect(notification).toBeVisible());
	});
});
