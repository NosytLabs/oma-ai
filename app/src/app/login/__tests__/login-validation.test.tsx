import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import LoginPage from "../_components/LoginPageClient";

const magicLink = vi.hoisted(() => vi.fn());
const authState = vi.hoisted(() => ({ authenticated: false, replace: vi.fn(), params: new URLSearchParams() }));
vi.mock("@/lib/auth-client", () => ({ signIn: { magicLink } }));
vi.mock("next/dynamic", async () => {
	const { default: WalletSignInPanel } = await import("../_components/WalletSignInPanel");
	return { default: () => WalletSignInPanel };
});

beforeEach(() => {
	magicLink.mockReset();
	authState.authenticated = false;
	authState.replace.mockReset();
	authState.params = new URLSearchParams();
	window.history.replaceState({}, "", "/login");
});

function visit(query: Record<string, string>) {
	authState.params = new URLSearchParams(query);
	window.history.replaceState({}, "", `/login?${authState.params}`);
}

vi.mock("next/navigation", () => ({
	useRouter: () => ({ replace: authState.replace, push: vi.fn(), refresh: vi.fn() }),
	useSearchParams: () => authState.params,
}));
vi.mock("@/components/ui/Toast", () => ({
	useToast: () => ({ error: vi.fn(), success: vi.fn(), toast: vi.fn() }),
}));
vi.mock("@/components/api-status", () => ({
	useApiHealth: () => ({ status: "online" as const }),
}));
vi.mock("@/lib/hooks/useAuth", () => ({
	useAuth: () => ({ isAuthenticated: authState.authenticated, isDemo: false, isReady: true }),
}));

describe("magic-link form validation", () => {
	it("keeps a pending email delivery separate from the wallet connect state", async () => {
		let finish!: (value: unknown) => void;
		magicLink.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
		render(<LoginPage />);
		fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: "pending@example.test" } });
		fireEvent.click(screen.getByRole("button", { name: "Send magic link" }));
		fireEvent.click(screen.getByRole("tab", { name: "Wallet" }));
		try {
			const wallet = screen.getByRole("button", { name: /Connect wallet|Check your wallet/ });
			expect(wallet).toHaveTextContent("Connect wallet");
			expect(wallet).toBeEnabled();
			fireEvent.click(screen.getByRole("tab", { name: "Magic link" }));
			expect(screen.getByRole("button", { name: "Sending…" })).toBeDisabled();
		} finally { await act(async () => { finish({ data: { status: true }, error: null }); }); }
		await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/check your inbox/i));
	});
	it.each(["/chat?model=example#conversation", "//evil.example/phishing"])("sets a same-origin error callback preserving only safe next %s", async next => {
		visit({ next });
		magicLink.mockResolvedValue({ data: { status: true }, error: null });
		render(<LoginPage />);
		fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: "user@example.com" } });
		fireEvent.click(screen.getByRole("button", { name: "Send magic link" }));
		await waitFor(() => expect(magicLink).toHaveBeenCalledOnce());
		const safeNext = next.startsWith("//") ? "/dashboard" : next;
		const request = magicLink.mock.calls[0][0];
		expect(request.callbackURL).toBe(`${window.location.origin}${safeNext}`);
		expect(request.errorCallbackURL).toEqual(expect.any(String));
		const errorCallback = new URL(request.errorCallbackURL);
		expect(errorCallback.origin).toBe(window.location.origin);
		expect(errorCallback.pathname).toBe("/login");
		expect(errorCallback.searchParams.get("method")).toBe("magic");
		expect(errorCallback.searchParams.get("next")).toBe(safeNext);
	});

	it("explains invalid, expired or reused verification links and allows a new delivery request", async () => {
		visit({ method: "magic", next: "/settings?tab=keys", error: "INVALID_TOKEN", error_description: "untrusted-token-description" });
		magicLink.mockResolvedValue({ data: { status: true }, error: null });
		render(<LoginPage />);
		expect(screen.getByRole("alert")).toHaveTextContent(/no longer valid/i);
		expect(screen.getByRole("alert")).toHaveTextContent(/expired.*already been used/i);
		expect(screen.queryByText(/untrusted-token-description/)).not.toBeInTheDocument();
		fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: "user@example.com" } });
		fireEvent.click(screen.getByRole("button", { name: "Send magic link" }));
		await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/check your inbox/i));
		expect(screen.queryByRole("alert")).not.toBeInTheDocument();
		expect(magicLink.mock.calls[0][0].callbackURL).toBe(`${window.location.origin}/settings?tab=keys`);
	});

	it.each(["INVALID_TOKEN", "failed_to_create_user", "new_user_signup_disabled", "user_not_found", "failed_to_create_session", "untrusted-code", ""])("keeps a previous session on the sign-in form when verification returns %s", error => {
		visit({ method: "magic", error, error_description: "untrusted-description" });
		authState.authenticated = true;
		render(<LoginPage />);
		expect(authState.replace).not.toHaveBeenCalled();
		expect(screen.getByRole("alert")).toBeVisible();
		expect(screen.getByLabelText(/email address/i)).toBeVisible();
		expect(screen.queryByText(/untrusted-description|untrusted-code/)).not.toBeInTheDocument();
	});

	it("moves selection and focus between sign-in tabs with arrow, Home and End keys", () => {
		render(<LoginPage />);
		const magic = screen.getByRole("tab", { name: "Magic link" });
		const wallet = screen.getByRole("tab", { name: "Wallet" });
		expect(magic).toHaveAttribute("tabindex", "0");
		expect(wallet).toHaveAttribute("tabindex", "-1");
		magic.focus();
		fireEvent.keyDown(magic, { key: "ArrowRight" });
		expect(wallet).toHaveFocus();
		expect(wallet).toHaveAttribute("aria-selected", "true");
		expect(wallet).toHaveAttribute("tabindex", "0");
		expect(magic).toHaveAttribute("tabindex", "-1");
		fireEvent.keyDown(wallet, { key: "Home" });
		expect(magic).toHaveFocus();
		expect(magic).toHaveAttribute("aria-selected", "true");
		fireEvent.keyDown(magic, { key: "End" });
		expect(wallet).toHaveFocus();
		fireEvent.keyDown(wallet, { key: "ArrowLeft" });
		expect(magic).toHaveFocus();
		fireEvent.click(wallet);
		expect(wallet).toHaveAttribute("aria-selected", "true");
		expect(wallet).toHaveAttribute("tabindex", "0");
	});
	it("shows a returned delivery error without telling the user to check their inbox", async () => {
		magicLink.mockResolvedValue({ data: null, error: { message: "Please wait before requesting another link", status: 429 } });
		render(<LoginPage />);
		fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: "user@example.com" } });
		fireEvent.click(screen.getByRole("button", { name: "Send magic link" }));
		await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Please wait before requesting another link"));
		expect(screen.queryByText(/check your inbox/i)).not.toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Send magic link" })).toBeEnabled();
	});

	it("shows confirmation after a successful delivery request", async () => {
		magicLink.mockResolvedValue({ data: { status: true }, error: null });
		render(<LoginPage />);
		fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: "user@example.com" } });
		fireEvent.click(screen.getByRole("button", { name: "Send magic link" }));
		await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/check your inbox/i));
		expect(screen.queryByRole("alert")).not.toBeInTheDocument();
	});

	it("shows the app validation message for an invalid email instead of relying on native constraint validation", async () => {
		render(<LoginPage />);
		const input = screen.getByLabelText(/email address/i);
		const form = input.closest("form");

		expect(form).toHaveAttribute("novalidate");
		fireEvent.change(input, { target: { value: "not-an-email" } });
		fireEvent.submit(form!);

		await waitFor(() => {
			expect(screen.getByRole("alert")).toHaveTextContent(
				"Enter a valid email address",
			);
		});
		expect(input).toHaveAttribute("aria-invalid", "true");
		expect(input).toHaveAttribute("aria-describedby", "email-error");
	});
});
