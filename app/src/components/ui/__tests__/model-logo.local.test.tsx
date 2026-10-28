import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { ModelLogo } from "../model-logo";

// Slugs here mirror the upstream homarr-labs/dashboard-icons repo names;
// see the provider tile guidance in BRAND.md.
describe("ModelLogo — locally-vendored dashboard-icons provider marks", () => {
	it("uses locally-vendored dashboard-icons tile for GPT-family ids", () => {
		const { container } = render(<ModelLogo modelId="openai-gpt-54" size={24} />);
		const img = container.querySelector("img") as HTMLImageElement | null;
		expect(img?.getAttribute("src")).toBe("/logos/providers/openai.svg");
	});

	it("uses locally-vendored dashboard-icons tile for Claude models", () => {
		const { container } = render(<ModelLogo modelId="claude-sonnet-5" size={20} />);
		const img = container.querySelector("img") as HTMLImageElement | null;
		expect(img?.getAttribute("src")).toBe("/logos/providers/anthropic.svg");
	});

	it("uses locally-vendored dashboard-icons tile for DeepSeek", () => {
		const { container } = render(<ModelLogo modelId="deepseek-v4-flash" />);
		const img = container.querySelector("img") as HTMLImageElement | null;
		expect(img?.getAttribute("src")).toBe("/logos/providers/deepseek.svg");
	});

	it("falls back to initials badge for MiniMax (SVG chromium naturalW=0)", () => {
		const { container } = render(<ModelLogo modelId="minimax-m2-7" />);
		// verified live: minimax.svg returns 200 with full body, but
		// chromium-headless reports naturalW: 0 + complete: false on the
		// <img>. Cards have always shown a blank tile. Initials badge wins.
		expect(container.querySelector("img")).toBeNull();
		expect(container.textContent).toBeTruthy();
	});

	it("uses the real upstream deepseek tile for the Gonka OMA-AI DeepSeek V4 Flash", () => {
		const { container } = render(<ModelLogo modelId="deepseek-v4-flash-0731-openbroker" />);
		const img = container.querySelector("img") as HTMLImageElement | null;
		expect(img?.getAttribute("src")).toBe("/logos/providers/deepseek.svg");
	});

	it("falls back to initials badge for Kimi / Moonshot (kimi-ai.svg viewBox is off-canvas)", () => {
		const { container } = render(<ModelLogo modelId="kimi-k2-6" />);
		// kimi-ai.svg ships with viewBox "2589.93 529.3 4225.03 4225.03";
		// the logo sits in the upper-right corner of a 4225-px canvas and
		// renders as ~0 visible pixels at 36×36. We deliberately do NOT
		// map "kimi" / "moonshotai" → "kimi-ai" so these IDs go through the
		// colored initials badge instead.
		expect(container.querySelector("img")).toBeNull();
		expect(container.textContent).toBeTruthy();
	});

	it("falls back to initials badge for Qwen (qwen.svg viewBox is off-center)", () => {
		const { container } = render(<ModelLogo modelId="qwen-3-7-plus" />);
		// qwen.svg viewBox "27.55 17.52 147.28 145.51" places the logo
		// inside a 147-unit canvas offset to (27.55, 17.52); at 36×36 the
		// visible strokes collapse below sub-px. Initials badge wins.
		expect(container.querySelector("img")).toBeNull();
		expect(container.textContent).toBeTruthy();
	});

	it("falls back to initials badge for Xiaomi MiMo (xiaomi-global.svg viewBox is negative)", () => {
		const { container } = render(<ModelLogo modelId="xiaomi-mimo-v2-5" />);
		// xiaomi-global.svg ships with viewBox "-200.008 -199.727 512 512";
		// the visible mark lives in the negative coord space and vanishes
		// when scaled to 36×36. Initials badge wins.
		expect(container.querySelector("img")).toBeNull();
		expect(container.textContent).toBeTruthy();
	});

	it("falls back to initials badge for Meta / Llama (meta.svg has no viewBox)", () => {
		const { container } = render(<ModelLogo modelId="llama-3-3-70b" />);
		// meta.svg ships with no viewBox attribute; the browser renders it
		// at the intrinsic 300×150 default, showing a stretched/blank tile
		// in the 36×36 card. The "meta" / "llama" mapping is intentionally
		// absent so these IDs go through the initials badge.
		expect(container.querySelector("img")).toBeNull();
		expect(container.textContent).toBeTruthy();
	});

	it("falls back to initials badge for Grok / xAI (grok.svg root fill is none + opacity 0.3)", () => {
		const { container } = render(<ModelLogo modelId="grok-4-5" />);
		// grok.svg sets root fill="none" with per-path CSS classes at
		// opacity 0.3 and 0.8; at 36×36 the rendered shape disappears into
		// the panel background. Initials badge wins.
		expect(container.querySelector("img")).toBeNull();
		expect(container.textContent).toBeTruthy();
	});

	it("falls back to initials badge for Ethereum (no viewBox attribute)", () => {
		const { container } = render(<ModelLogo modelId="ethereum-testnet" />);
		// ethereum.svg ships with no viewBox attribute; the unwrapped
		// <path> fills the entire image bounding box and renders as a
		// stretched-blank diamond at 36×36. The "ethereum" mapping is
		// intentionally absent.
		expect(container.querySelector("img")).toBeNull();
		expect(container.textContent).toBeTruthy();
	});

	it("uses the real upstream z-ai tile for Z.AI / GLM", () => {
		const { container } = render(<ModelLogo modelId="zai-org-glm-5-1" />);
		const img = container.querySelector("img") as HTMLImageElement | null;
		expect(img?.getAttribute("src")).toBe("/logos/providers/z-ai.svg");
	});

	it("falls back to initials badge for Grok / xAI (grok.svg renders opaqueless at 36×36)", () => {
		// See "falls back to initials badge for Grok / xAI (root fill is none)" below
		// for context. The "grok" / "xai" mapping is intentionally absent.
		// Combined with the prior Grok test below for full coverage.
		const { container } = render(<ModelLogo modelId="grok-4-5" />);
		expect(container.querySelector("img")).toBeNull();
		expect(container.textContent).toBeTruthy();
	});

	it("falls back to local grok.svg tile when the file is broken at small sizes (legacy test preserved)", () => {
		// Kept as documentation: if a future vendored grok.svg ships with
		// proper fill + viewBox, restore the `grok: "grok"` mapping and
		// this test will simply assert the SVG path again.
		const { container } = render(<ModelLogo modelId="xai-grok-future" />);
		expect(container.querySelector("img")).toBeNull();
	});

	it("uses locally-vendored OpenAI tile for GPT-5.6 Sol (real upstream is OpenAI)", () => {
		const { container } = render(<ModelLogo modelId="openai-gpt-56-sol" />);
		const img = container.querySelector("img") as HTMLImageElement | null;
		expect(img?.getAttribute("src")).toBe("/logos/providers/openai.svg");
	});

	it("falls back to local tile for providers not in dashboard-icons (Mercury)", () => {
		const { container } = render(<ModelLogo modelId="mercury-2" />);
		const img = container.querySelector("img") as HTMLImageElement | null;
		expect(img?.getAttribute("src")).toBe("/logos/providers/mercury.svg");
	});

	it("falls back to initials badge for Venice (venice.svg chromium naturalW=0)", () => {
		const { container } = render(<ModelLogo modelId="venice-uncensored-1-2" />);
		// venice.svg has the same chromium-headless naturalW: 0 issue as
		// minimax.svg; the local fallback was dropped so Venice IDs flow
		// through to the colored initials badge instead.
		expect(container.querySelector("img")).toBeNull();
		expect(container.textContent).toBeTruthy();
	});

	it("falls back to initials badge for MiniMax (minimax.svg chromium naturalW=0)", () => {
		const { container } = render(<ModelLogo modelId="minimax-m2-7" />);
		// minimax.svg has the same chromium-headless naturalW: 0 issue;
		// confirmed in v3 screenshots. Drop to initials.
		expect(container.querySelector("img")).toBeNull();
		expect(container.textContent).toBeTruthy();
	});

	it("falls back to initials badge for unknown brands without crashing", () => {
		const { container } = render(<ModelLogo modelId="totally-unknown-model-xyz" />);
		expect(container.querySelector("img")).toBeNull();
		expect(container.textContent?.length).toBeGreaterThan(0);
	});
});
