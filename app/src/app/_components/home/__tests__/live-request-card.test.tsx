import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LiveRequestCard } from "../LiveRequestCard";

/**
 * LiveRequestCard behaviour that a DOM-level test can actually pin down:
 *  - the phase badge follows the request lifecycle in order, and
 *  - the reduced-motion branch ROTATES rather than freezing.
 *
 * The second one matters because the old reduced-motion branch painted one
 * completed request and returned — the card was a dead static block for
 * exactly the users most likely to have motion sensitivity.
 */

function mockReducedMotion(reduce: boolean) {
	vi.stubGlobal("matchMedia", (query: string) => ({
		matches: reduce && query.includes("prefers-reduced-motion"),
		media: query,
		onchange: null,
		addEventListener: () => {},
		removeEventListener: () => {},
		addListener: () => {},
		removeListener: () => {},
		dispatchEvent: () => false,
	}));
}

const badge = () => screen.getByText(/example · /);

beforeEach(() => {
	vi.useFakeTimers();
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

describe("LiveRequestCard phase badge", () => {
	it("starts in the sending phase", () => {
		mockReducedMotion(false);
		render(<LiveRequestCard />);
		expect(badge()).toHaveTextContent(/sending/i);
	});

	it("advances sending -> streaming -> complete", () => {
		mockReducedMotion(false);
		render(<LiveRequestCard />);
		expect(badge()).toHaveTextContent(/sending/i);

		// Run past the typing phase (request is ~350 chars x 6ms).
		act(() => {
			vi.advanceTimersByTime(4000);
		});
		expect(badge()).toHaveTextContent(/streaming/i);

		// Past the stream + settle hold.
		act(() => {
			vi.advanceTimersByTime(2000);
		});
		expect(badge()).toHaveTextContent(/complete/i);
	});
});

describe("LiveRequestCard reduced motion", () => {
	it("rotates through all rounds instead of freezing", () => {
		mockReducedMotion(true);
		const { container } = render(<LiveRequestCard />);

		// First round is rendered immediately, fully settled.
		expect(badge()).toHaveTextContent(/complete/i);
		expect(container.textContent).toContain("claude-opus-5");
		const first = container.textContent;

		// Advance one reduced-motion tick: the next round takes over.
		act(() => {
			vi.advanceTimersByTime(3300);
		});
		expect(container.textContent).toContain("deepseek-v4-flash");
		expect(container.textContent).not.toBe(first);

		// And the third, wrapping back round 1 — all 3 rounds are reachable,
		// so the card is never a single frozen state.
		act(() => {
			vi.advanceTimersByTime(3300);
		});
		expect(container.textContent).toContain("llama-3.3-70b");

		act(() => {
			vi.advanceTimersByTime(3300);
		});
		expect(container.textContent).toContain("claude-opus-5");
	});

	it("clears its interval on unmount", () => {
		mockReducedMotion(true);
		const clearSpy = vi.spyOn(window, "clearInterval");
		const { unmount } = render(<LiveRequestCard />);
		expect(clearSpy).not.toHaveBeenCalled();
		unmount();
		// No leaked interval: cleanup ran clearInterval exactly once.
		expect(clearSpy).toHaveBeenCalledTimes(1);
		clearSpy.mockRestore();
	});
});