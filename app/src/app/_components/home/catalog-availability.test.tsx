import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { CodeExample } from "./code-example";
import { StatsStrip } from "./stats-strip";

const { loadEntries } = vi.hoisted(() => ({ loadEntries: vi.fn() }));
vi.mock("@/lib/models-data", async (importOriginal) => ({
	...await importOriginal<typeof import("@/lib/models-data")>(),
	loadRawModelEntries: loadEntries,
}));
vi.mock("./reveal", () => ({ Reveal: ({ children }: { children: ReactNode }) => children }));
beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("homepage catalog availability", () => {
	it("reports zero enabled chat models when every chat route is unavailable", async () => {
		loadEntries.mockResolvedValue([{ id: "offline", modality: "chat", available: false }, { id: "image", modality: "image", available: true }]);
		render(<StatsStrip />);
		const row = screen.getByText("Models enabled").closest("li")!;
		await waitFor(() => expect(within(row).getByText("0")).toBeInTheDocument());
	});

	it("does not claim a fallback catalog is live when the API cannot be read", async () => {
		loadEntries.mockResolvedValue([]);
		render(<StatsStrip />);
		const row = screen.getByText("Models enabled").closest("li")!;
		await waitFor(() => expect(loadEntries).toHaveBeenCalled());
		expect(within(row).getByText("—")).toBeInTheDocument();
	});

	it("chooses an available chat model for the copyable SDK example", async () => {
		loadEntries.mockResolvedValue([{ id: "offline", modality: "chat", available: false }, { id: "image-only", modality: "image", available: true }, { id: "live-chat", modality: "chat", available: true }]);
		render(<CodeExample />);
		await waitFor(() => expect(screen.getByLabelText("OpenAI-compatible OMA SDK client setup code example").textContent).toContain('model: "live-chat"'));
		expect(screen.getByLabelText("OpenAI-compatible OMA SDK client setup code example").textContent).not.toContain("offline");
	});

	it("uses an explicit placeholder when no chat model is currently available", async () => {
		loadEntries.mockResolvedValue([{ id: "offline", modality: "chat", available: false }]);
		render(<CodeExample />);
		await waitFor(() => expect(loadEntries).toHaveBeenCalled());
		expect(screen.getByLabelText("OpenAI-compatible OMA SDK client setup code example").textContent).toContain('model: "YOUR_AVAILABLE_MODEL_ID"');
	});
});
