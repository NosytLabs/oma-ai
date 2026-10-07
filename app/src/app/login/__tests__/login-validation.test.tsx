import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import LoginPage from "../_components/LoginPageClient";

const magicLink = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth-client", () => ({ signIn: { magicLink } }));

beforeEach(() => magicLink.mockReset());

vi.mock("next/navigation", () => ({
	useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
	useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/components/ui/Toast", () => ({
	useToast: () => ({ error: vi.fn(), success: vi.fn(), toast: vi.fn() }),
}));
vi.mock("@/components/api-status", () => ({
	useApiHealth: () => ({ status: "online" as const }),
}));
vi.mock("@/lib/hooks/useAuth", () => ({
	useAuth: () => ({ isAuthenticated: false, isDemo: false, isReady: true }),
}));

describe("magic-link form validation", () => {
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
