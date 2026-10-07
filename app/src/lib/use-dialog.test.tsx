import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDialog } from "./use-dialog";

function Harness({ open, onClose }: { open: boolean; onClose: () => void }) {
	const { panelRef } = useDialog({ open, onClose });
	return (
		<div data-testid="root">
			<input data-testid="external" />
			<div ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true">
				<button data-testid="a" type="button">
					A
				</button>
				<button data-testid="b" type="button">
					B
				</button>
			</div>
		</div>
	);
}

describe("useDialog", () => {
	let originalOverflow: string;
	beforeEach(() => {
		originalOverflow = document.body.style.overflow;
	});
	afterEach(() => {
		cleanup();
		vi.useRealTimers();
		document.body.style.overflow = originalOverflow;
	});

	it("keeps keyboard focus when the close callback changes during a render", () => {
		vi.useFakeTimers();
		const firstClose = vi.fn();
		const latestClose = vi.fn();
		const { getByTestId, rerender } = render(<Harness open onClose={firstClose} />);
		act(() => vi.runAllTimers());
		getByTestId("b").focus();
		rerender(<Harness open onClose={latestClose} />);
		act(() => vi.runAllTimers());
		expect(document.activeElement).toBe(getByTestId("b"));
		fireEvent.keyDown(document, { key: "Escape" });
		expect(latestClose).toHaveBeenCalledOnce();
		expect(firstClose).not.toHaveBeenCalled();
	});

	it("locks body scroll while open and restores on close", () => {
		const onClose = vi.fn();
		const { rerender } = render(<Harness open={true} onClose={onClose} />);
		expect(document.body.style.overflow).toBe("hidden");
		rerender(<Harness open={false} onClose={onClose} />);
		expect(document.body.style.overflow).toBe(originalOverflow);
	});

	it("closes on Escape", () => {
		const onClose = vi.fn();
		render(<Harness open={true} onClose={onClose} />);
		fireEvent.keyDown(document, { key: "Escape" });
		expect(onClose).toHaveBeenCalled();
	});

	it("does not close on Escape when closed", () => {
		const onClose = vi.fn();
		render(<Harness open={false} onClose={onClose} />);
		fireEvent.keyDown(document, { key: "Escape" });
		expect(onClose).not.toHaveBeenCalled();
	});
});
