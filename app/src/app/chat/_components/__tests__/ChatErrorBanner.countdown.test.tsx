import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChatErrorBanner } from "../ChatErrorBanner";

vi.mock("next/navigation", () => ({ usePathname: () => "/chat" }));
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("chat rate-limit recovery", () => {
	it("finishes its countdown through timer ticks and parent re-renders", () => {
		vi.useFakeTimers();
		const retry = vi.fn();
		const error = "Rate limit exceeded. Retry-After: 3";
		const view = render(<ChatErrorBanner error={error} onDismiss={() => {}} onRetry={() => retry()} />);
		expect(screen.getByRole("button", { name: /^retry$/i })).toBeDisabled();
		act(() => { vi.advanceTimersByTime(1000); });
		expect(screen.getByText("RETRY IN 2s")).toBeInTheDocument();
		view.rerender(<ChatErrorBanner error={error} onDismiss={() => {}} onRetry={() => retry()} />);
		act(() => { vi.advanceTimersByTime(2000); });
		expect(screen.queryByText(/retry in/i)).not.toBeInTheDocument();
		const button = screen.getByRole("button", { name: /^retry$/i });
		expect(button).toBeEnabled();
		fireEvent.click(button);
		expect(retry).toHaveBeenCalledOnce();
	});
});
