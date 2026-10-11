import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CreatedKeyModal } from "./CreatedKeyModal";

vi.mock("@/lib/framer-motion-client", () => ({
	m: { div: ({ children, initial: _i, animate: _a, exit: _e, transition: _t, ...props }: Record<string, unknown>) => React.createElement("div", props, children as React.ReactNode) },
	AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
}));
const key = { id: "one", name: "Temporary test", prefix: "oma_sk_prefix", createdAt: "2026-10-10T00:00:00Z", lastUsedAt: null, key: "oma_sk_test_secret" };
afterEach(() => { cleanup(); vi.useRealTimers(); });
describe("one-time key dialog", () => {
	it("requires reveal, copies the exact key and automatically hides it", () => {
		vi.useFakeTimers();
		const copy = vi.fn();
		render(<CreatedKeyModal createdKey={key} copied={null} onCopy={copy} onDismiss={vi.fn()} />);
		expect(screen.getByRole("dialog", { name: "API key created" })).toBeInTheDocument();
		expect(screen.queryByText(key.key)).not.toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Reveal API key" }));
		fireEvent.click(screen.getByRole("button", { name: "Copy full API key" }));
		expect(copy).toHaveBeenCalledExactlyOnceWith(key.key, "full-one");
		act(() => vi.advanceTimersByTime(10_000));
		expect(screen.queryByText(key.key)).not.toBeInTheDocument();
	});
	it("does not carry reveal permission to a different newly created key", () => {
		const props = { copied: null, onCopy: vi.fn(), onDismiss: vi.fn() };
		const { rerender } = render(<CreatedKeyModal createdKey={key} {...props} />);
		fireEvent.click(screen.getByRole("button", { name: "Reveal API key" }));
		rerender(<CreatedKeyModal createdKey={{ ...key, id: "two", key: "oma_sk_other_secret" }} {...props} />);
		expect(screen.queryByText("oma_sk_other_secret")).not.toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Reveal API key" })).toBeInTheDocument();
	});
	it("allows Escape to dismiss the dialog", () => {
		const dismiss = vi.fn();
		render(<CreatedKeyModal createdKey={key} copied={null} onCopy={vi.fn()} onDismiss={dismiss} />);
		fireEvent.keyDown(document, { key: "Escape" });
		expect(dismiss).toHaveBeenCalledOnce();
	});
});
