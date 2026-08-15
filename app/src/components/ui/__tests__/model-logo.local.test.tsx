import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { ModelLogo } from "../model-logo";

// Slugs here mirror the upstream homarr-labs/dashboard-icons repo names
// (renamed in app/public/logos/providers/README.md to match the canonical
// upstream slug — see https://github.com/homarr-labs/dashboard-icons).
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

	it("uses locally-vendored dashboard-icons tile for MiniMax", () => {
		const { container } = render(<ModelLogo modelId="minimax-m2-7" />);
		const img = container.querySelector("img") as HTMLImageElement | null;
		expect(img?.getAttribute("src")).toBe("/logos/providers/minimax.svg");
	});

	it("uses the real upstream google-gemini tile for Gemini", () => {
		const { container } = render(<ModelLogo modelId="gemini-3-flash-preview" />);
		const img = container.querySelector("img") as HTMLImageElement | null;
		expect(img?.getAttribute("src")).toBe("/logos/providers/google-gemini.svg");
	});

	it("uses the real upstream kimi-ai tile for Kimi / Moonshot", () => {
		const { container } = render(<ModelLogo modelId="kimi-k2-6" />);
		const img = container.querySelector("img") as HTMLImageElement | null;
		expect(img?.getAttribute("src")).toBe("/logos/providers/kimi-ai.svg");
	});

	it("uses the real upstream qwen tile for Qwen", () => {
		const { container } = render(<ModelLogo modelId="qwen-3-7-plus" />);
		const img = container.querySelector("img") as HTMLImageElement | null;
		expect(img?.getAttribute("src")).toBe("/logos/providers/qwen.svg");
	});

	it("uses the real upstream xiaomi-global tile for Xiaomi MiMo", () => {
		const { container } = render(<ModelLogo modelId="xiaomi-mimo-v2-5" />);
		const img = container.querySelector("img") as HTMLImageElement | null;
		expect(img?.getAttribute("src")).toBe("/logos/providers/xiaomi-global.svg");
	});

	it("uses the real upstream z-ai tile for Z.AI / GLM", () => {
		const { container } = render(<ModelLogo modelId="zai-org-glm-5-1" />);
		const img = container.querySelector("img") as HTMLImageElement | null;
		expect(img?.getAttribute("src")).toBe("/logos/providers/z-ai.svg");
	});

	it("uses locally-vendored dashboard-icons tile for Grok / xAI", () => {
		const { container } = render(<ModelLogo modelId="grok-4-5" />);
		const img = container.querySelector("img") as HTMLImageElement | null;
		expect(img?.getAttribute("src")).toBe("/logos/providers/grok.svg");
	});

	it("uses locally-vendored OpenAI tile for GPT-4o (real upstream is OpenAI)", () => {
		const { container } = render(<ModelLogo modelId="gpt-4o" />);
		const img = container.querySelector("img") as HTMLImageElement | null;
		expect(img?.getAttribute("src")).toBe("/logos/providers/openai.svg");
	});

	it("uses the real upstream qwen tile for Qwen3 235B (real upstream is Qwen)", () => {
		const { container } = render(<ModelLogo modelId="qwen3-235b-a22b-openbroker" />);
		const img = container.querySelector("img") as HTMLImageElement | null;
		expect(img?.getAttribute("src")).toBe("/logos/providers/qwen.svg");
	});

	it("falls back to local tile for providers not in dashboard-icons (Mercury)", () => {
		const { container } = render(<ModelLogo modelId="mercury-2" />);
		const img = container.querySelector("img") as HTMLImageElement | null;
		expect(img?.getAttribute("src")).toBe("/logos/providers/mercury.svg");
	});

	it("falls back to initials badge for unknown brands without crashing", () => {
		const { container } = render(<ModelLogo modelId="totally-unknown-model-xyz" />);
		expect(container.querySelector("img")).toBeNull();
		expect(container.textContent?.length).toBeGreaterThan(0);
	});
});