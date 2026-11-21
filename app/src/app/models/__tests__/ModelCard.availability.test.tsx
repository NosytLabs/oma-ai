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

		// The flag now appears in more than one element (badge + the
		// visible reason line), so match all of them.
		expect(screen.getAllByText(/unavailable/i).length).toBeGreaterThan(0);
		// No dead-end CTA into a chat that will 503.
		expect(screen.queryByText(/try in chat/i)).toBeNull();
	});

	it("shows the policy-block reason on the card, not only in a tooltip", () => {
		// The reason string existed in the data (and in the badge's title
		// attribute) but was never rendered as visible text.
		render(
			<ModelCard
				model={{ ...base, available: false, unavailableCause: "policy_blocked" }}
				index={0}
			/>,
		);

		expect(screen.getByText("Blocked by this deployment's provider policy")).toBeTruthy();
	});

	it("shows the operator's reason when the catalog carries one", () => {
		render(
			<ModelCard
				model={{
					...base,
					available: false,
					unavailableReason:
						"Temporarily paused after repeated upstream output. Please choose MiniMax M2.7.",
				}}
				index={0}
			/>,
		);

		expect(screen.getByText(/Temporarily paused after repeated upstream output/)).toBeTruthy();
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

	it("presents catalog features plainly, with no unverified notices", () => {
		render(
			<ModelCard
				model={{
					...base,
					metadataVerification: { status: "unverified", sourceUrl: "", verifiedAt: "", note: "" },
					inputModalities: ["text", "image"],
					outputModalities: ["text"],
					capabilities: ["reasoning"],
				}}
				index={0}
			/>,
		);

		// Mandate 2026-11-16: an entry badged "unverified" reads broken.
		// The card shows the catalog entry plainly; verification provenance
		// is rendered on the model detail page instead.
		expect(screen.queryByText(/unverified/i)).toBeNull();
		expect(screen.queryByText(/configured/i)).toBeNull();
		// The configured context value is shown, not hidden behind a status.
		expect(screen.getByText("1M ctx")).toBeTruthy();
		// Capability badges carry their plain labels.
		expect(screen.getByText("reasoning")).toBeTruthy();

		// The image modality badge renders with its plain title.
		expect(screen.getByTitle("Accepts image input")).toBeTruthy();
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
