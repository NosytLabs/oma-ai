import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DashboardPage from "../page";

const mocks = vi.hoisted(() => ({
	userId: "account-a", createKey: vi.fn(), deleteKey: vi.fn(),
	toast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams("tab=api-keys") }));
vi.mock("next/dynamic", () => ({ default: (loader: () => Promise<{ default: React.ComponentType }>) => React.lazy(loader) }));
vi.mock("@/lib/hooks/useAuth", () => ({ useAuth: () => ({ isAuthenticated: true, isDemo: false, isReady: true, evmAddress: null, user: { id: mocks.userId } }) }));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => mocks.toast }));
vi.mock("@/lib/api", () => ({ api: { auth: { createKey: mocks.createKey, deleteKey: mocks.deleteKey } } }));
vi.mock("../_components/DashboardHeader", () => ({ DashboardHeader: () => null }));
vi.mock("../_hooks/useDashboardKeyboard", () => ({ useDashboardKeyboard: () => {} }));
vi.mock("../_hooks/useUsageExport", () => ({ useUsageExport: () => ({ exporting: false, exportUsage: vi.fn() }) }));
vi.mock("../_hooks/useDashboardData", () => ({ useDashboardData: () => ({ balance: null, apiKeys: [], usage: [], models: [], transactions: [], loading: false, error: null, summary: null, refresh: vi.fn() }) }));
// Keep the real key forms and secret modal. Replace only the broad dashboard
// widget composition so unrelated analytics do not obscure the page boundary.
vi.mock("../_components/DashboardGrid", async () => {
	const { ApiKeyManager } = await import("@/components/dashboard/ApiKeyManager");
	const { CreatedKeyModal } = await import("@/components/dashboard/CreatedKeyModal");
	return { DashboardGrid: (props: React.ComponentProps<typeof ApiKeyManager> & React.ComponentProps<typeof CreatedKeyModal> & { apiKeys: React.ComponentProps<typeof ApiKeyManager>["keys"]; onDismissCreatedKey: () => void }) => <><ApiKeyManager {...props} keys={props.apiKeys} /><CreatedKeyModal {...props} onDismiss={props.onDismissCreatedKey} /></> };
});
vi.mock("@/lib/framer-motion-client", () => ({
	AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
	m: { div: ({ children, initial: _initial, animate: _animate, exit: _exit, transition: _transition, ...props }: Record<string, unknown>) => React.createElement("div", props, children as React.ReactNode) },
}));

const created = { id: "a-key", name: "A private key", prefix: "oma_sk_test", key: "oma_sk_synthetic_account_a_secret", createdAt: "2026-01-01T00:00:00Z", lastUsedAt: null };

function renderDashboard() {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	const content = () => <QueryClientProvider client={client}><DashboardPage /></QueryClientProvider>;
	const view = render(content());
	return { ...view, client, switchAccount: () => { mocks.userId = "account-b"; view.rerender(content()); } };
}
async function startCreation() {
	fireEvent.click(await screen.findByRole("button", { name: "Create your first key" }));
	fireEvent.change(screen.getByRole("textbox", { name: "API key name" }), { target: { value: "A private key" } });
	fireEvent.click(screen.getByRole("button", { name: "Create key" }));
}
beforeEach(() => { vi.clearAllMocks(); mocks.userId = "account-a"; mocks.createKey.mockResolvedValue(created); });
afterEach(cleanup);

describe("dashboard API key account boundary", () => {
	it("does not expose an already-created account A secret after switching to B", async () => {
		const view = renderDashboard();
		await startCreation();
		await screen.findByRole("dialog", { name: "API key created" });
		view.switchAccount();
		expect(screen.queryByRole("dialog", { name: "API key created" })).not.toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "Reveal API key" })).not.toBeInTheDocument();
	});

	it("does not publish a late account A key into account B's modal", async () => {
		let finish!: (key: typeof created) => void;
		mocks.createKey.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
		const view = renderDashboard();
		await startCreation();
		view.switchAccount();
		await act(async () => { finish(created); });
		expect(screen.queryByRole("dialog", { name: "API key created" })).not.toBeInTheDocument();
		expect(view.client.getQueryData(["apiKeys", "account-b"])).toBeUndefined();
		expect(screen.getByRole("button", { name: "Create your first key" })).toBeEnabled();
	});

	it("resets the account A key creation draft when switching to B", async () => {
		const view = renderDashboard();
		fireEvent.click(await screen.findByRole("button", { name: "Create your first key" }));
		fireEvent.change(screen.getByRole("textbox", { name: "API key name" }), { target: { value: "A confidential workload" } });
		view.switchAccount();
		expect(screen.queryByRole("textbox", { name: "API key name" })).not.toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Create your first key" }));
		expect(screen.getByRole("textbox", { name: "API key name" })).toHaveValue("");
	});
});
