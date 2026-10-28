import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ProfileSection } from "./settings/ProfileSection";
import AccountSettings from "./AccountSettings";

const mocks = vi.hoisted(() => ({
	params: new URLSearchParams(),
	router: { replace: vi.fn() },
	listSessions: vi.fn(),
	revokeSession: vi.fn(),
	revokeOtherSessions: vi.fn(),
	balance: vi.fn(),
	deleteAccount: vi.fn(),
	clearHistory: vi.fn(),
	exportData: vi.fn(),
	updateUser: vi.fn(),
	signOut: vi.fn(),
	clearDemoSessionCookie: vi.fn(),
	navigate: vi.fn(),
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

let signedInUser = user;
const originalLocation = window.location;

vi.mock("next/navigation", () => ({
	useRouter: () => mocks.router,
	useSearchParams: () => mocks.params,
}));
vi.mock("@/lib/hooks/useAuth", () => ({
	useAuth: () => ({ isAuthenticated: true, isDemo: false, isReady: true, evmAddress: null, user: signedInUser, signOut: mocks.signOut }),
}));
vi.mock("@/components/shared/UnauthCallout", () => ({ UnauthCallout: () => null }));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => mocks.toast }));
vi.mock("@/lib/auth-client", () => ({ authClient: { updateUser: mocks.updateUser }, clearDemoSessionCookie: mocks.clearDemoSessionCookie }));
vi.mock("@/lib/api", () => ({
	api: {
		auth: { listSessions: mocks.listSessions, revokeSession: mocks.revokeSession, revokeOtherSessions: mocks.revokeOtherSessions, deleteAccount: mocks.deleteAccount, clearHistory: mocks.clearHistory },
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
	const element = () => <QueryClientProvider client={client}><ThemeProvider><AccountSettings /></ThemeProvider></QueryClientProvider>;
	const view = render(element());
	return { ...view, refreshSession: () => view.rerender(element()) };
}

beforeEach(() => {
	vi.clearAllMocks();
	signedInUser = user;
	mocks.params = new URLSearchParams("demo=1");
	mocks.listSessions.mockResolvedValue({ sessions: [] });
	mocks.balance.mockResolvedValue({ balanceCents: 100 });
	mocks.updateUser.mockResolvedValue({ error: null });
	mocks.deleteAccount.mockReset();
	mocks.signOut.mockReset();
	Object.defineProperty(window, "location", { configurable: true, value: { origin: originalLocation.origin, protocol: originalLocation.protocol, assign: mocks.navigate } });
	localStorage.clear();
});
afterEach(() => {
	cleanup();
	Object.defineProperty(window, "location", { configurable: true, value: originalLocation });
});

describe("settings demo isolation", () => {
	it("keeps account profile changes disabled even with a real session", () => {
		renderSettings();
		expect(screen.getByRole("textbox", { name: "Display name" })).toBeDisabled();
		expect(screen.getByRole("button", { name: "Save name" })).toBeDisabled();
		fireEvent.keyDown(screen.getByRole("textbox", { name: "Display name" }), { key: "Enter" });
		expect(mocks.updateUser).not.toHaveBeenCalled();
		expect(mocks.listSessions).not.toHaveBeenCalled();
		expect(screen.getByRole("link", { name: "Exit demo" })).toHaveAttribute("href", "/dashboard?tab=settings&section=profile");
	});

	it("disables data export, clear history, and account deletion without fetching real balance", async () => {
		mocks.params = new URLSearchParams("demo=1&tab=settings&section=danger");
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
		mocks.params = new URLSearchParams("demo=1&tab=settings&section=appearance");
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
		expect(mocks.router.replace).toHaveBeenLastCalledWith("/dashboard?demo=1&source=tour&tab=settings&section=sessions", { scroll: false });
		fireEvent.keyDown(screen.getByRole("tablist"), { key: "End" });
		expect(mocks.router.replace).toHaveBeenLastCalledWith("/dashboard?demo=1&source=tour&tab=settings&section=danger", { scroll: false });
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


describe("settings account boundaries", () => {
	it("navigates after confirmed deletion without waiting for a second sign-out request", async () => {
		mocks.params = new URLSearchParams("tab=settings&section=danger");
		let finishDeletion!: () => void;
		mocks.deleteAccount.mockReturnValueOnce(new Promise<void>(resolve => { finishDeletion = resolve; }));
		mocks.signOut.mockRejectedValueOnce(new Error("Auth service unavailable"));
		renderSettings();
		fireEvent.click(screen.getByRole("button", { name: "Delete account" }));
		const confirmation = screen.getByRole("textbox", { name: "Confirm by typing DELETE" });
		fireEvent.change(confirmation, { target: { value: "DELETE" } });
		fireEvent.keyDown(confirmation, { key: "Enter" });
		expect(mocks.deleteAccount).toHaveBeenCalledOnce();
		await act(async () => { finishDeletion(); });
		expect(mocks.navigate).toHaveBeenCalledWith("/");
		expect(mocks.signOut).not.toHaveBeenCalled();
		expect(mocks.clearDemoSessionCookie).toHaveBeenCalledOnce();
		expect(screen.getByRole("button", { name: "Deleting…" })).toBeDisabled();
	});

	it("does not submit account deletion twice before React commits its pending state", async () => {
		mocks.params = new URLSearchParams("tab=settings&section=danger");
		let finish!: () => void;
		mocks.deleteAccount.mockReturnValue(new Promise<void>(resolve => { finish = resolve; }));
		const view = renderSettings();
		fireEvent.click(screen.getByRole("button", { name: "Delete account" }));
		const confirmation = screen.getByRole("textbox", { name: "Confirm by typing DELETE" });
		fireEvent.change(confirmation, { target: { value: "DELETE" } });
		act(() => { fireEvent.keyDown(confirmation, { key: "Enter" }); fireEvent.keyDown(confirmation, { key: "Enter" }); });
		try { expect(mocks.deleteAccount).toHaveBeenCalledOnce(); }
		finally { view.unmount(); await act(async () => { finish(); }); }
	});

	it("keeps a failed deletion visible and retryable without navigating", async () => {
		mocks.params = new URLSearchParams("tab=settings&section=danger");
		mocks.deleteAccount.mockRejectedValueOnce(new Error("Deletion temporarily unavailable"));
		let finishRetry!: () => void;
		mocks.deleteAccount.mockReturnValueOnce(new Promise<void>(resolve => { finishRetry = resolve; }));
		const view = renderSettings();
		fireEvent.click(screen.getByRole("button", { name: "Delete account" }));
		fireEvent.change(screen.getByRole("textbox", { name: "Confirm by typing DELETE" }), { target: { value: "DELETE" } });
		fireEvent.click(screen.getByRole("button", { name: "Delete my account" }));
		expect(await screen.findByRole("alert")).toHaveTextContent("Deletion temporarily unavailable");
		expect(screen.getByRole("button", { name: "Delete my account" })).toBeEnabled();
		expect(mocks.signOut).not.toHaveBeenCalled();
		expect(mocks.navigate).not.toHaveBeenCalled();
		fireEvent.click(screen.getByRole("button", { name: "Delete my account" }));
		expect(mocks.deleteAccount).toHaveBeenCalledTimes(2);
		expect(screen.queryByRole("alert")).not.toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Deleting…" })).toBeDisabled();
		view.unmount();
		await act(async () => { finishRetry(); });
	});

	it("does not sign out a new account when an old account deletion finishes", async () => {
		mocks.params = new URLSearchParams("tab=settings&section=danger");
		let finishDeletion!: () => void;
		mocks.deleteAccount.mockReturnValueOnce(new Promise<void>((resolve) => { finishDeletion = resolve; }));
		const { refreshSession } = renderSettings();
		fireEvent.click(screen.getByRole("button", { name: "Delete account" }));
		fireEvent.change(screen.getByRole("textbox", { name: "Confirm by typing DELETE" }), { target: { value: "DELETE" } });
		fireEvent.click(screen.getByRole("button", { name: "Delete my account" }));
		expect(mocks.deleteAccount).toHaveBeenCalledTimes(1);

		signedInUser = { ...user, id: "another-user", email: "another@example.com" };
		refreshSession();
		await act(async () => { finishDeletion(); });
		expect(mocks.signOut).not.toHaveBeenCalled();
		expect(mocks.navigate).not.toHaveBeenCalled();
		expect(mocks.clearDemoSessionCookie).not.toHaveBeenCalled();
		expect(screen.getByRole("button", { name: "Delete account" })).toBeEnabled();
	});

	it("requires fresh destructive confirmations after switching accounts", async () => {
		mocks.params = new URLSearchParams("tab=settings&section=danger");
		const { refreshSession } = renderSettings();
		fireEvent.click(screen.getByRole("button", { name: "Clear usage history" }));
		fireEvent.click(screen.getByRole("button", { name: "Delete account" }));
		fireEvent.change(screen.getByRole("textbox", { name: "Confirm by typing DELETE" }), { target: { value: "DELETE" } });
		expect(screen.getByRole("button", { name: "Delete my account" })).toBeEnabled();

		signedInUser = { ...user, id: "another-user", email: "another@example.com" };
		refreshSession();
		expect(screen.queryByRole("button", { name: "Confirm wipe" })).not.toBeInTheDocument();
		expect(screen.queryByRole("textbox", { name: "Confirm by typing DELETE" })).not.toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Delete account" }));
		expect(screen.getByRole("textbox", { name: "Confirm by typing DELETE" })).toHaveValue("");
		expect(screen.getByRole("button", { name: "Delete my account" })).toBeDisabled();
		expect(mocks.deleteAccount).not.toHaveBeenCalled();
		expect(mocks.clearHistory).not.toHaveBeenCalled();
		await waitFor(() => expect(mocks.balance).toHaveBeenCalledTimes(2));
	});
});

describe("session revocation recovery", () => {
	it.each(["one", "others"] as const)("keeps the %s revocation confirmation retryable after failure and clears a recovered error", async (mode) => {
		mocks.params = new URLSearchParams("tab=settings&section=sessions");
		const current = { id: "current", isCurrent: true, userAgent: "Chrome/130", createdAt: "2026-01-01T00:00:00Z", expiresAt: "2099-01-01T00:00:00Z", ipAddress: null };
		mocks.listSessions.mockResolvedValue({ sessions: [current, { ...current, id: "remote", isCurrent: false }] });
		const revoke = mode === "one" ? mocks.revokeSession : mocks.revokeOtherSessions;
		revoke.mockRejectedValueOnce(new Error("Revocation temporarily unavailable"));
		revoke.mockImplementationOnce(async () => {
			mocks.listSessions.mockResolvedValue({ sessions: [current] });
			return { success: true };
		});
		renderSettings();
		fireEvent.click(await screen.findByRole("button", { name: mode === "one" ? "Revoke" : "Sign out 1 other device" }));
		fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
		expect(await screen.findByRole("alert")).toHaveTextContent("Revocation temporarily unavailable");
		const retry = screen.getByRole("button", { name: "Confirm" });
		expect(retry).toBeEnabled();
		fireEvent.click(retry);
		await waitFor(() => expect(screen.queryByRole("button", { name: "Confirm" })).not.toBeInTheDocument());
		expect(screen.queryByRole("alert")).not.toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "Revoke" })).not.toBeInTheDocument();
	});
});
