import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { MODELS, type Model } from "@/lib/models-data";
import PricingPage from "./PricingPageClient";

const { loadModels } = vi.hoisted(() => ({ loadModels: vi.fn() }));
vi.mock("@/lib/models-data", async (importOriginal) => ({
	...await importOriginal<typeof import("@/lib/models-data")>(),
	loadModels,
}));
vi.mock("@/components/motion/in-view-fade", () => ({ InViewFade: ({ children }: { children: ReactNode }) => children }));

beforeEach(() => {
	vi.clearAllMocks();
	vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("null", { status: 200 }));
});
afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

const model = (id: string, inputPricePer1M: number, available = true): Model => ({
	...MODELS[0]!, id, name: id, modelId: id, modality: "chat", inputPricePer1M, available,
});

describe("pricing availability and rates", () => {
	it("does not advertise the fallback count or entry price while checking", () => {
		loadModels.mockReturnValue(new Promise(() => {}));
		render(<PricingPage />);
		expect(screen.getByRole("status")).toHaveTextContent("Loading model catalog");
		expect(within(screen.getByText("Starts at").parentElement!).getByText("—")).toBeInTheDocument();
		expect(screen.getAllByText("Checking").length).toBeGreaterThan(0);
	});

	it("identifies the loader's static fallback as unverified after a failed request", async () => {
		loadModels.mockResolvedValue(MODELS);
		render(<PricingPage />);
		await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Live catalog unavailable"));
		expect(within(screen.getByText("Starts at").parentElement!).getByText("—")).toBeInTheDocument();
		expect(screen.getAllByText("Unverified").length).toBeGreaterThan(0);
		expect(screen.queryByText(/enabled models. Provider availability can vary/)).not.toBeInTheDocument();
	});

	it("uses the exact cheapest available chat rate, excluding unavailable and per-generation models", async () => {
		loadModels.mockResolvedValue([
			model("offline-cheap", 0.01, false), model("live", 0.6125),
			{ ...model("image-only", 0.001), modality: "image" },
		]);
		render(<PricingPage />);
		await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("1 enabled model"));
		expect(within(screen.getByText("Starts at").parentElement!).getByText("$0.6125")).toBeInTheDocument();
		expect(screen.queryByText("image-only")).not.toBeInTheDocument();
	});

	it("shows zero availability without inventing an entry price", async () => {
		loadModels.mockResolvedValue([model("offline", 0.01, false)]);
		render(<PricingPage />);
		await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("0 enabled models"));
		expect(screen.getByText("No chat models are currently enabled. Check again before adding credits.")).toBeInTheDocument();
		expect(within(screen.getByText("Starts at").parentElement!).getByText("—")).toBeInTheDocument();
	});

	it("does not promise a credit discount, a fixed free-model count, or a signup bonus", async () => {
		loadModels.mockResolvedValue([]);
		render(<PricingPage />);
		await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("0 enabled models"));
		expect(screen.getByText("High volume")).toBeInTheDocument();
		expect(screen.getByText(/Eligible models can be used free in website chat/)).toBeInTheDocument();
		expect(screen.queryByText(/best value per credit|3 OMA-AI models|\$1\.00 in trial credit/i)).not.toBeInTheDocument();
	});
});
