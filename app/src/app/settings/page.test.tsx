import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ProfileSection } from "./_components/ProfileSection";
import SettingsPage from "./page";

const mocks = vi.hoisted(() => ({
	params: new URLSearchParams(),
	router: { replace: vi.fn() },
	listSessions: vi.fn(),
	balance: vi.fn(),
	deleteAccount: vi.fn(),
	clearHistory: vi.fn(),
	exportData: vi.fn(),
	updateUser: vi.fn(),
	signOut: vi.fn(),
	toast: { success: vi.fn(), error: vi.fn() },
}));

const user = {
	id: "real-user",
	name: "Original name",
	email: "person@example.com",
	emailVerified: true,
	createdAt: "2026-01-01T00:00:00Z",
	updatedAt: "2026-01-01T00:00:00Z",
};

vi.mock("next/navigation", () => ({
	useRouter: () => mocks.router,
	useSearchParams: () => mocks.params,
}));
vi.mock("@/lib/hooks/useAuth", () => ({
	useAuth: () => ({ isAuthenticated: true, isDemo: false, isReady: true, evmAddress: null, user, signOut: mocks.signOut }),
}));
vi.mock("@/components/shared/UnauthCallout", () => ({ UnauthCallout: () => null }));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => mocks.toast }));
vi.mock("@/lib/auth-client", () => ({ authClient: { updateUser: mocks.updateUser } }));
vi.mock("@/lib/api", () => ({
	api: {
		auth: { listSessions: mocks.listSessions, deleteAccount: mocks.deleteAccount, clearHistory: mocks.clearHistory },
		balance: { get: mocks.balance },
		exportData: { accountBundle: mocks.exportData },
	},
}));
vi.mock("@/lib/framer-motion-client", () => {
	const component = (tag: string) => ({ children, initial: _initial, animate: _animate, exit: _exit, transition: _transition, whileTap: _whileTap, ...props }: Record<string, unknown>) =>
		React.createElement(tag, props, children as React.ReactNode);
	return { m: { div: component("div"), button: component("button") }, AnimatePresence: ({ children }: { children: React.ReactNode }) => children };
});

function renderSettings(cachedBalanceCents?: number) {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	if (cachedBalanceCents !== undefined) client.setQueryData(["balance"], { balanceCents: cachedBalanceCents });
	return render(<QueryClientProvider client={client}><ThemeProvider><SettingsPage /></ThemeProvider></QueryClientProvider>);
}

beforeEach(() => {
	vi.clearAllMocks();
	mocks.params = new URLSearchParams("demo=1");
	mocks.listSessions.mockResolvedValue({ sessions: [] });
	mocks.balance.mockResolvedValue({ balanceCents: 100 });
	mocks.updateUser.mockResolvedValue({ error: null });
	localStorage.clear();
});
afterEach(cleanup);

describe("settings demo isolation", () => {
	it("keeps account profile changes disabled even with a real session", () => {
		renderSettings();
		expect(screen.getByRole("textbox", { name: "Display name" })).toBeDisabled();
		expect(screen.getByRole("button", { name: "Save name" })).toBeDisabled();
		fireEvent.keyDown(screen.getByRole("textbox", { name: "Display name" }), { key: "Enter" });
		expect(mocks.updateUser).not.toHaveBeenCalled();
		expect(mocks.listSessions).not.toHaveBeenCalled();
		expect(screen.getByRole("link", { name: "Exit demo" })).toHaveAttribute("href", "/settings");
	});

	it("disables data export, clear history, and account deletion without fetching real balance", async () => {
		mocks.params = new URLSearchParams("demo=1&tab=danger");
		renderSettings(12345);
		for (const name of ["Download JSON", "Clear usage history", "Delete account"]) {
			const button = await screen.findByRole("button", { name });
			expect(button).toBeDisabled();
			fireEvent.click(button);
		}
		expect(mocks.exportData).not.toHaveBeenCalled();
		expect(mocks.clearHistory).not.toHaveBeenCalled();
		expect(mocks.deleteAccount).not.toHaveBeenCalled();
		expect(mocks.balance).not.toHaveBeenCalled();
		expect(screen.queryByText(/123.45/)).not.toBeInTheDocument();
	});

	it("keeps appearance preferences read-only in the demo", async () => {
		mocks.params = new URLSearchParams("demo=1&tab=appearance");
		renderSettings();
		for (const radio of await screen.findAllByRole("radio")) expect(radio).toBeDisabled();
		expect(screen.getByRole("checkbox")).toBeDisabled();
		fireEvent.keyDown(screen.getByRole("radiogroup"), { key: "ArrowRight" });
		expect(localStorage.getItem("oma-theme")).toBeNull();
	});

	it("preserves demo and other query parameters for click and keyboard navigation", () => {
		mocks.params = new URLSearchParams("demo=1&source=tour");
		renderSettings();
		fireEvent.click(screen.getByRole("tab", { name: /Sessions/ }));
		expect(mocks.router.replace).toHaveBeenLastCalledWith("/settings?demo=1&source=tour&tab=sessions", { scroll: false });
		fireEvent.keyDown(screen.getByRole("tablist"), { key: "End" });
		expect(mocks.router.replace).toHaveBeenLastCalledWith("/settings?demo=1&source=tour&tab=danger", { scroll: false });
	});

	it.each([["privacy", "/settings?demo=1&tab=danger"], ["keys", "/dashboard?demo=1&tab=api-keys"]])("preserves demo for the legacy %s link", async (tab, expected) => {
		mocks.params = new URLSearchParams(`demo=1&tab=${tab}`);
		renderSettings();
		await waitFor(() => expect(mocks.router.replace.mock.calls[0][0]).toBe(expected));
	});
});

describe("profile name state", () => {
	it("updates the displayed name when the session refreshes", () => {
		const { rerender } = render(<ProfileSection user={user} />);
		rerender(<ProfileSection user={{ ...user, name: "Refreshed name" }} />);
		expect(screen.getByRole("textbox", { name: "Display name" })).toHaveValue("Refreshed name");
		expect(screen.getByRole("button", { name: "Save name" })).toBeDisabled();
	});

	it("marks a successful save clean before the session prop refreshes", async () => {
		render(<ProfileSection user={user} />);
		fireEvent.change(screen.getByRole("textbox", { name: "Display name" }), { target: { value: "  Updated name  " } });
		fireEvent.click(screen.getByRole("button", { name: "Save name" }));
		await waitFor(() => expect(mocks.toast.success).toHaveBeenCalledWith("Display name saved"));
		expect(mocks.updateUser).toHaveBeenCalledWith({ name: "Updated name" });
		expect(screen.getByRole("textbox", { name: "Display name" })).toHaveValue("Updated name");
		expect(screen.getByRole("button", { name: "Save name" })).toBeDisabled();
	});
});
