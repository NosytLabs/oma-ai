import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChatErrorBanner } from "../ChatErrorBanner";

vi.mock("next/navigation", () => ({ usePathname: () => "/chat" }));

describe("chat authentication recovery", () => {
	it("returns to the selected model without requiring a separate API key", () => {
		render(<ChatErrorBanner error="Authentication required" onDismiss={() => {}} loginHref="/login?next=%2Fchat%3Fmodel%3Dclaude-opus-5" />);
		expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute("href", "/login?next=%2Fchat%3Fmodel%3Dclaude-opus-5");
		expect(screen.queryByRole("link", { name: /API key/i })).not.toBeInTheDocument();
		expect(screen.queryByText(/needs an API key/i)).not.toBeInTheDocument();
	});
});
