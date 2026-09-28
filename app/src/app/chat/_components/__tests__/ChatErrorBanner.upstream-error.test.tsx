/**
 * Upstream timeout / network errors must render the banner with a Retry CTA,
 * not silently fail. Regression test for the real-world case where the chat
 * server returns 504 with `{"error":{"message":"Backend request timed out"}}`
 * (caught during the 2026-08-31 audit when the OMA-AI / Gonka.AI DeepSeek
 * V4 Flash upstream was at capacity and the user saw their message + nothing
 * else).
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChatErrorBanner } from "../ChatErrorBanner";

vi.mock("next/navigation", () => ({
	usePathname: () => "/chat",
}));

describe("ChatErrorBanner upstream timeout", () => {
	it.each([
		"Inference provider temporarily unavailable",
		"Model MiniMaxAI/MiniMax-M2.7 is temporarily unavailable",
	])("identifies provider unavailability honestly: %s", (error) => {
		const onRetry = vi.fn();
		render(<ChatErrorBanner error={error} onDismiss={vi.fn()} onRetry={onRetry} />);
		expect(screen.getByText("PROVIDER UNAVAILABLE")).toBeInTheDocument();
		expect(screen.getByText(/try again later or choose another model/i)).toBeInTheDocument();
		expect(screen.queryByText(/redis|rate-limit or/i)).not.toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: /try again/i }));
		expect(onRetry).toHaveBeenCalledOnce();
	});

	it("does not invent a cause for an unspecified service outage", () => {
		render(
			<ChatErrorBanner error="HTTP 503: Service Unavailable" onDismiss={vi.fn()} onRetry={vi.fn()} />,
		);
		expect(screen.getByText("GATEWAY UNAVAILABLE")).toBeInTheDocument();
		expect(screen.queryByText(/redis|rate-limit or/i)).not.toBeInTheDocument();
	});

	it("renders a network banner with Retry for 504 upstream timeout", () => {
		render(
			<ChatErrorBanner
				error="Backend request timed out"
				onDismiss={vi.fn()}
				onRetry={vi.fn()}
			/>,
		);
		// Must surface to the user — silent failure was the original bug
		expect(screen.getByRole("alert")).toBeInTheDocument();
		// Must classify as network (timeout → network bucket)
		expect(screen.getByText(/network error/i)).toBeInTheDocument();
		// Must offer retry for transient upstream failures (button reads "TRY AGAIN")
		expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
	});

	it("renders a rate-limit banner for 429 + 502 mixed failure", () => {
		render(
			<ChatErrorBanner
				error="All model providers failed: 502 (unavailable), 429 (rate-limited). Try another model or try again later."
				onDismiss={vi.fn()}
				onRetry={vi.fn()}
			/>,
		);
		expect(screen.getByRole("alert")).toBeInTheDocument();
		expect(screen.getByText(/rate limited/i)).toBeInTheDocument();
	});

	it("does NOT render the banner when error is null", () => {
		const { container } = render(
			<ChatErrorBanner
				error={null}
				onDismiss={vi.fn()}
				onRetry={vi.fn()}
			/>,
		);
		expect(container.querySelector('[role="alert"]')).toBeNull();
	});
});
