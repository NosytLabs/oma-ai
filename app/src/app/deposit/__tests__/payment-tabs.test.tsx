import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DepositPage from "../page";

vi.mock("@/lib/framer-motion-client", () => ({
	AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
	m: { div: ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={className}>{children}</div> },
}));

beforeEach(() => {
	// Keep live payment panels unavailable; exercise the actual page's tabs.
	vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 503 })));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("deposit payment method keyboard navigation", () => {
	it.each(["keyboard", "click"] as const)("preserves a visitor's %s selection when payment availability arrives late", async (input) => {
		let finishSettings!: (value: Response) => void;
		vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(resolve => { finishSettings = resolve; })));
		render(<DepositPage />);
		const [usdc, card] = screen.getAllByRole("tab");
		if (input === "keyboard") { usdc.focus(); fireEvent.keyDown(usdc, { key: "ArrowRight" }); }
		else fireEvent.click(card);
		expect(card).toHaveAttribute("aria-selected", "true");
		await act(async () => { finishSettings(new Response(JSON.stringify({ maintenanceMode: false, cardPaymentsEnabled: true, cryptoPaymentsEnabled: true, usdcDepositConfigured: false, polarConfigured: false, x402Configured: true }), { headers: { "content-type": "application/json" } })); });
		expect(card).toHaveAttribute("aria-selected", "true");
		expect(screen.getByRole("tabpanel")).toHaveAttribute("aria-labelledby", card.id);
	});

	it("selects and focuses methods with arrow keys, including wrapping", () => {
		render(<DepositPage />);
		const [usdc, card, x402] = screen.getAllByRole("tab");
		usdc.focus();
		fireEvent.keyDown(usdc, { key: "ArrowRight" });
		expect(card).toHaveFocus();
		expect(card).toHaveAttribute("aria-selected", "true");
		expect(screen.getByRole("tabpanel")).toHaveAttribute("aria-labelledby", card.id);
		fireEvent.keyDown(card, { key: "ArrowLeft" });
		expect(usdc).toHaveFocus();
		fireEvent.keyDown(usdc, { key: "ArrowLeft" });
		expect(x402).toHaveFocus();
		expect(x402).toHaveAttribute("tabindex", "0");
		expect(usdc).toHaveAttribute("tabindex", "-1");
	});

	it("jumps to the last and first methods with End and Home", () => {
		render(<DepositPage />);
		const [usdc, , x402] = screen.getAllByRole("tab");
		usdc.focus();
		fireEvent.keyDown(usdc, { key: "End" });
		expect(x402).toHaveFocus();
		expect(x402).toHaveAttribute("aria-selected", "true");
		fireEvent.keyDown(x402, { key: "Home" });
		expect(usdc).toHaveFocus();
		expect(usdc).toHaveAttribute("aria-selected", "true");
	});
});
