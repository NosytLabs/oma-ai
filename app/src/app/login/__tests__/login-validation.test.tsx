import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import LoginPage from "../_components/LoginPageClient";

vi.mock("next/navigation", () => ({
	useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
	useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/components/ui/Toast", () => ({
	useToast: () => ({ error: vi.fn(), success: vi.fn(), toast: vi.fn() }),
}));
vi.mock("@/components/api-status", () => ({
	useApiHealth: () => ({ status: "online" }),
}));
vi.mock("@/lib/hooks/useAuth", () => ({
	useAuth: () => ({ isAuthenticated: false, isDemo: false, isReady: true }),
}));

describe("magic-link form validation", () => {
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
