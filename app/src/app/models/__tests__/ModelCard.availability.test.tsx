import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ModelCard } from "../_components/ModelCard";
import type { Model } from "@/lib/models-data";

const base: Model = {
	id: "claude-opus-5",
	name: "Claude Opus 5",
	provider: "Venice",
	tier: "frontier",
	modality: "chat",
	description: "d",
	contextLength: "1M",
	contextTokens: 1_000_000,
	inputPricePer1M: 7.5,
	outputPricePer1M: 30,
	capabilities: ["chat"],
	modelId: "claude-opus-5",
};

/**
 * The catalog reports `available: false` when the backing provider's key is
 * missing or a placeholder, so the model 503s. Before this the card rendered
 * identically to a working model and still pushed a "Try in chat" link —
 * verified live: /models showed 20 cards, 0 flagged, 0 dimmed, while the API
 * reported 18 of 20 unavailable.
 */
describe("ModelCard availability", () => {
	it("flags an unavailable model instead of advertising it as usable", () => {
		render(<ModelCard model={{ ...base, available: false }} index={0} />);

		expect(screen.getByText(/unavailable/i)).toBeTruthy();
		// No dead-end CTA into a chat that will 503.
		expect(screen.queryByText(/try in chat/i)).toBeNull();
	});

	it("keeps the chat CTA for an available model", () => {
		render(<ModelCard model={{ ...base, available: true }} index={0} />);

		expect(screen.queryByText(/unavailable/i)).toBeNull();
		expect(screen.getByText(/try in chat/i)).toBeTruthy();
	});

	it("treats an omitted availability flag as available", () => {
		// The static fallback catalog has no flag; absence must not grey out
		// a working model.
		render(<ModelCard model={{ ...base }} index={0} />);

		expect(screen.queryByText(/unavailable/i)).toBeNull();
		expect(screen.getByText(/try in chat/i)).toBeTruthy();
	});

	/**
	 * The badge and the CTA were honest, but the PRICE was not. Measured live
	 * on a real 1440px render: the unavailable Claude Opus 5 card painted its
	 * input price rgb(70,211,154) text-accent and its output price
	 * rgb(184,195,209) text-text-secondary -- byte-identical to the live
	 * MiniMax M2.7 card. Price is what a visitor commits on, so a badge alone
	 * does not carry the message; the accent colour is the buy signal.
	 */
	describe("price presentation", () => {
		function inputPriceSpan(container: HTMLElement): HTMLElement | undefined {
			return Array.from(container.querySelectorAll<HTMLElement>('span[aria-hidden="true"]')).find(
				(s) => (s.textContent ?? "").indexOf("$7.50") === 0,
			);
		}

		it("mutes and strikes the input price on an unavailable model", () => {
			const { container } = render(<ModelCard model={{ ...base, available: false }} index={0} />);
			const inputSpan = inputPriceSpan(container);
			expect(inputSpan, "input price span not found").toBeTruthy();
			expect(inputSpan!.className).toMatch(/line-through/);
			expect(inputSpan!.className).toMatch(/text-text-muted/);
			expect(inputSpan!.className).not.toMatch(/text-accent/);
		});

		it("keeps the accent price on an available model", () => {
			const { container } = render(<ModelCard model={{ ...base, available: true }} index={0} />);
			const inputSpan = inputPriceSpan(container);
			expect(inputSpan, "input price span not found").toBeTruthy();
			expect(inputSpan!.className).toMatch(/text-accent/);
			expect(inputSpan!.className).not.toMatch(/line-through/);
		});
	});
});
