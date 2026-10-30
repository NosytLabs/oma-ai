import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LoginPage from "../_components/LoginPageClient";

const state = vi.hoisted(() => ({ authenticated: false, replace: vi.fn(), params: new URLSearchParams() }));
vi.mock("next/navigation", () => ({
	useRouter: () => ({ replace: state.replace }),
	useSearchParams: () => state.params,
}));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ error: vi.fn(), success: vi.fn() }) }));
vi.mock("@/components/api-status", () => ({ useApiHealth: () => ({ status: "online" }) }));
vi.mock("@/lib/hooks/useAuth", () => ({
	useAuth: () => ({ isAuthenticated: state.authenticated, isDemo: false, isReady: true }),
}));
vi.mock("next/dynamic", () => ({
	default: () => function WalletPanel({ setSubmitting }: { setSubmitting: (value: boolean) => void }) {
		return <><button onClick={() => setSubmitting(true)}>Start wallet</button><button onClick={() => setSubmitting(false)}>Wallet failed</button></>;
	},
}));

beforeEach(() => { state.authenticated = false; state.replace.mockReset(); });

describe("wallet session redirect", () => {
	it("does not redirect a refreshed unrelated session during or after failed wallet verification", () => {
		const { rerender } = render(<LoginPage />);
		fireEvent.click(screen.getByRole("tab", { name: "Wallet" }));
		fireEvent.click(screen.getByRole("button", { name: "Start wallet" }));
		state.authenticated = true;
		rerender(<LoginPage />);
		expect(state.replace).not.toHaveBeenCalled();
		fireEvent.click(screen.getByRole("button", { name: "Wallet failed" }));
		expect(state.replace).not.toHaveBeenCalled();
	});

	it("still redirects an already signed-in visitor on page load", () => {
		state.authenticated = true;
		render(<LoginPage />);
		expect(state.replace).toHaveBeenCalledWith("/dashboard");
	});
});
