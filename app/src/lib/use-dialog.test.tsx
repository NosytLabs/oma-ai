import { fireEvent, render } from "@testing-library/react";
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
		document.body.style.overflow = originalOverflow;
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
