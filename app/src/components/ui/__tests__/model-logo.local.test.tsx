import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { ModelLogo } from "../model-logo";

describe("ModelLogo — local provider tiles", () => {
	it("uses local openai.svg for GPT-family ids (no CDN)", () => {
		const { container } = render(<ModelLogo modelId="openai-gpt-54" size={24} />);
		const img = container.querySelector("img") as HTMLImageElement | null;
		expect(img?.getAttribute("src")).toBe("/logos/providers/openai.svg");
	});

	it("uses local anthropic tile for Claude models", () => {
		const { container } = render(<ModelLogo modelId="claude-sonnet-5" size={20} />);
		const img = container.querySelector("img") as HTMLImageElement | null;
		expect(img?.getAttribute("src")).toBe("/logos/providers/anthropic.svg");
	});

	it("uses local deepseek tile", () => {
		const { container } = render(<ModelLogo modelId="deepseek-v4-flash" />);
		const img = container.querySelector("img") as HTMLImageElement | null;
		expect(img?.getAttribute("src")).toBe("/logos/providers/deepseek.svg");
	});

	it("falls back to initials badge for unknown brands without crashing", () => {
		const { container } = render(<ModelLogo modelId="totally-unknown-model-xyz" />);
		expect(container.querySelector("img")).toBeNull();
		expect(container.textContent?.length).toBeGreaterThan(0);
	});
});
