/**
 * Tests for the rate-limit countdown wiring in <AuthError>.
 *
 * The `useCountdown` hook has always been defined in `AuthSkeleton.tsx`;
 * the audit (2026-07-01) found that it was never *consumed*. These tests
 * pin the live-countdown behavior so we don't regress to a static "try again
 * in 30s" string.
 */

import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";
import { AuthError } from "../AuthError";

// Stub framer-motion to remove the m.* / useReducedMotion overhead —
// we don't need animations under test, and `useReducedMotion`'s
// window-matchMedia subscription is hostile to fake timers.
vi.mock("framer-motion", () => ({
	m: {
		div: ({ children, ...props }: { children: React.ReactNode } & Record<string, unknown>) => (
			<div {...(props as Record<string, unknown>)}>{children}</div>
		),
	},
	useReducedMotion: () => true,
}));

afterEach(() => {
	cleanup();
	vi.useRealTimers();
});

function rateLimitedError(retryAfter?: number) {
	const body = retryAfter !== undefined ? { retryAfter } : {};
	return new ApiError(429, "Too many attempts", body);
}

describe("AuthError rate-limit countdown", () => {
	it("renders the static message when retryAfter is absent", () => {
		render(<AuthError error={rateLimitedError()} />);
		// No countdown should be present.
		expect(screen.queryByText(/retry in \d+s/i)).toBeNull();
		// The static message must still appear (matched by the full sentence,
		// not just "Too many attempts" which also appears in the title).
		expect(
			screen.getByText(/Please slow down and try again in a moment/i),
		).toBeInTheDocument();
	});

	it("renders the initial countdown value when retryAfter is provided", () => {
		render(<AuthError error={rateLimitedError(30)} />);
		expect(screen.getByText(/retry in 30s/i)).toBeInTheDocument();
	});

	it("ticks down as time passes (1s interval)", async () => {
		vi.useFakeTimers();
		render(<AuthError error={rateLimitedError(30)} />);
		// Initial render shows 30.
		expect(screen.getByText(/retry in 30s/i)).toBeInTheDocument();

		// Advance 3 seconds inside an act() so React flushes the state
		// updates the countdown hook performs.
		await act(async () => {
			await vi.advanceTimersByTimeAsync(3000);
		});

		expect(screen.getByText(/retry in 27s/i)).toBeInTheDocument();
	});

	it("hides the countdown when it reaches zero", async () => {
		vi.useFakeTimers();
		render(<AuthError error={rateLimitedError(2)} />);
		expect(screen.getByText(/retry in 2s/i)).toBeInTheDocument();

		// Advance past the window.
		await act(async () => {
			await vi.advanceTimersByTimeAsync(3000);
		});

		expect(screen.queryByText(/retry in \d+s/i)).toBeNull();
	});

	it("does not show countdown for non-rate-limited errors", () => {
		render(<AuthError error={new ApiError(401, "Unauthorized")} />);
		expect(screen.queryByText(/retry in \d+s/i)).toBeNull();
	});

	it("disables the retry button while a countdown is active", () => {
		render(<AuthError error={rateLimitedError(10)} onRetry={() => {}} />);
		const retryBtn = screen.getByRole("button", { name: /wait 10s/i });
		expect(retryBtn).toBeDisabled();
	});

	it("does not show a countdown for non-numeric retryAfter", () => {
		// Defensive: shapeAuthError parses retryAfter via Number() — if a
		// server sends a string like "30s", retryAfterSec ends up NaN and
		// the countdown should not render at all.
		const body = { retryAfter: "soon" };
		render(<AuthError error={new ApiError(429, "Too many", body)} />);
		expect(screen.queryByText(/retry in \d+s/i)).toBeNull();
	});
});