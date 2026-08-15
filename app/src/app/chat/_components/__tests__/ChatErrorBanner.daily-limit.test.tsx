/**
	* Daily free-limit banner must offer Sign in / Buy credits, not a useless Retry.
	*/
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChatErrorBanner } from "../ChatErrorBanner";

vi.mock("next/navigation", () => ({
	usePathname: () => "/chat",
}));

describe("ChatErrorBanner daily free limit", () => {
	it("classifies daily free limit and shows Sign in CTA", () => {
		render(
			<ChatErrorBanner
				error="Daily free limit reached (20 requests/day). Sign in for 100 requests/day, or upgrade for unlimited API access. Resets in ~21h."
				onDismiss={vi.fn()}
				onRetry={vi.fn()}
			/>,
		);
		expect(screen.getByText(/daily limit reached/i)).toBeInTheDocument();
		const signIn = screen.getByRole("link", { name: /sign in/i });
		expect(signIn).toHaveAttribute("href", "/login?next=%2Fchat");
		expect(screen.getByRole("link", { name: /buy credits/i })).toHaveAttribute(
			"href",
			"/deposit",
		);
		// Must not offer Retry for a daily quota (nothing to retry until reset/sign-in)
		expect(screen.queryByRole("button", { name: /^retry$/i })).toBeNull();
	});
});
