import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FiatCheckoutPanel } from "../FiatCheckoutPanel";

const mocks = vi.hoisted(() => ({ userId: "first-account", request: vi.fn(), toast: { error: vi.fn() } }));
vi.mock("@/lib/hooks/useAuth", () => ({ useAuth: () => ({ isAuthenticated: true, isDemo: false, user: { id: mocks.userId } }) }));
vi.mock("@/lib/api", () => ({ request: mocks.request }));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => mocks.toast }));
vi.mock("@/lib/framer-motion-client", () => ({
	AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
	m: { div: ({ children, className, role }: { children: React.ReactNode; className?: string; role?: string }) => <div className={className} role={role}>{children}</div> },
}));

const originalLocation = window.location;
beforeEach(() => {
	vi.resetAllMocks();
	mocks.userId = "first-account";
	Object.defineProperty(window, "location", { configurable: true, writable: true, value: { origin: "https://oma-ai.com", href: "https://oma-ai.com/deposit" } });
});
afterEach(() => {
	cleanup();
	Object.defineProperty(window, "location", { configurable: true, writable: true, value: originalLocation });
});

describe("card checkout account boundaries", () => {
	it("opens the returned checkout while its account is still active", async () => {
		mocks.request.mockResolvedValueOnce({ id: "current-checkout", url: "https://checkout.polar.sh/current-checkout" });
		render(<FiatCheckoutPanel />);
		await act(async () => { fireEvent.click(screen.getByRole("button", { name: /Pay .* with card/ })); });
		expect(window.location.href).toBe("https://checkout.polar.sh/current-checkout");
	});

	it("does not redirect to an old account's checkout after the session changes", async () => {
		let finishCheckout!: (value: { id: string; url: string }) => void;
		mocks.request.mockReturnValueOnce(new Promise(resolve => { finishCheckout = resolve; }));
		const view = render(<FiatCheckoutPanel />);
		fireEvent.click(screen.getByRole("button", { name: /Pay .* with card/ }));
		expect(screen.getByRole("button", { name: "Opening checkout…" })).toBeDisabled();
		mocks.userId = "second-account";
		view.rerender(<FiatCheckoutPanel />);
		await act(async () => { finishCheckout({ id: "old-checkout", url: "https://checkout.polar.sh/old-checkout" }); });
		expect(window.location.href).toBe("https://oma-ai.com/deposit");
		expect(screen.getByRole("button", { name: /Pay .* with card/ })).toBeEnabled();
	});

	it("does not interrupt navigation with a checkout that finishes after the panel closes", async () => {
		let finishCheckout!: (value: { id: string; url: string }) => void;
		mocks.request.mockReturnValueOnce(new Promise(resolve => { finishCheckout = resolve; }));
		const view = render(<FiatCheckoutPanel />);
		fireEvent.click(screen.getByRole("button", { name: /Pay .* with card/ }));
		view.unmount();
		await act(async () => { finishCheckout({ id: "old-checkout", url: "https://checkout.polar.sh/old-checkout" }); });
		expect(window.location.href).toBe("https://oma-ai.com/deposit");
	});
});
