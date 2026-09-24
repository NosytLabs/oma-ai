import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import LoginPage from "../_components/LoginPageClient";

// The page is a client component wired to the app router, the toast
// provider, the API-health poller and the auth session. None of those
// participate in card-title typography, so they are stubbed.
vi.mock("next/navigation", () => ({
	useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
	useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/components/ui/Toast", () => ({
	useToast: () => ({ toast: vi.fn() }),
}));
vi.mock("@/components/api-status", () => ({
	useApiHealth: () => ({ status: "online" }),
}));
vi.mock("@/lib/hooks/useAuth", () => ({
	useAuth: () => ({ isAuthenticated: false, isDemo: false, isReady: true }),
}));

/**
 * The sign-in page renders two sibling cards: the auth card and the
 * x402 callout. Their titles are visually parallel, so they must not
 * disagree on typeface.
 *
 * Regression: the auth card's title was an <h2>, which picks up the
 * global display serif (Instrument Serif) at 19px, while the x402
 * callout's title was a <p> and stayed in the body sans (Geist) at
 * 14px. Two adjacent card titles rendered in different typefaces.
 *
 * Card-level titles belong to the BODY face; the editorial serif is
 * reserved for hero/section display type. This test pins that, and also
 * pins a real accessibility contract: the callout title must be a real
 * heading so the document outline runs h1 -> h2 -> h3.
 */
describe("sign-in card title typography", () => {
	it("renders both card titles in the body sans, not the display serif", () => {
		render(<LoginPage />);

		const authTitle = screen.getByRole("heading", {
			name: /choose how to sign in/i,
		});
		const x402Title = screen.getByRole("heading", {
			name: /fund with x402/i,
		});

		// `font-sans` opts out of the global display-serif heading rule.
		expect(authTitle.className).toContain("font-sans");
		expect(x402Title.className).toContain("font-sans");
	});

	it("gives the x402 callout a real heading for a valid document outline", () => {
		render(<LoginPage />);

		// Previously a <p>: no heading role, so the outline skipped it.
		const x402Title = screen.getByRole("heading", { name: /fund with x402/i });
		expect(x402Title.tagName).toBe("H3");
	});
});
