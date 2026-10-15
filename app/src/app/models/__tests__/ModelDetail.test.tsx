import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ModelDetailPage, { generateMetadata } from "../[slug]/page";
import { ModelDetail } from "../[slug]/_components/ModelDetail";
import { MODELS } from "@/lib/models-data";

const originalFetch = globalThis.fetch;
const model = MODELS.find((entry) => entry.id === "claude-opus-5")!;

afterEach(() => { globalThis.fetch = originalFetch; });

describe("model detail", () => {
	it("keeps unavailable models useful without an unusable chat link", async () => {
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [{ id: model.id, available: false, pricing: { prompt: 1.171875, completion: 5.859375 }, context_length: 200000, supports_tools: true }] }) }));
		const { container } = render(await ModelDetailPage({ params: Promise.resolve({ slug: model.id }) }));

		expect(screen.getByText("Currently unavailable")).toBeInTheDocument();
		expect(screen.queryByRole("link", { name: /try in chat/i })).not.toBeInTheDocument();
		expect(screen.getByText("$1.171875")).toBeInTheDocument();
		expect(screen.getByText("$5.859375")).toBeInTheDocument();
		expect(screen.getByText("200K")).toBeInTheDocument();
		expect(screen.getByText("Tool calling")).toBeInTheDocument();
		const schemas = Array.from(container.querySelectorAll('script[type="application/ld+json"]')).map((script) => JSON.parse(script.textContent!));
		// A per-million input rate is not a flat offer to buy this model.
		for (const schema of schemas) expect(schema.offers).toBeUndefined();
	});

	it("shows an honest fallback during a catalog outage and retains the selected model link", async () => {
		vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
		render(await ModelDetailPage({ params: Promise.resolve({ slug: model.id }) }));
		expect(screen.getByRole("status")).toHaveTextContent("Live availability could not be confirmed");
		expect(screen.getByRole("link", { name: "Try in chat" })).toHaveAttribute("href", `/chat?model=${model.id}`);
		expect(screen.queryByText("Currently unavailable")).not.toBeInTheDocument();
		expect(screen.queryByRole("heading", { name: "Supported parameters" })).not.toBeInTheDocument();
	});

	it("rejects unknown model slugs before making a live request", async () => {
		const fetch = vi.fn();
		vi.stubGlobal("fetch", fetch);
		const params = Promise.resolve({ slug: "not-a-catalog-model" });
		await expect(ModelDetailPage({ params })).rejects.toThrow();
		await expect(generateMetadata({ params })).rejects.toThrow();
		expect(fetch).not.toHaveBeenCalled();
	});

	it.each([{ data: [] }, { data: null }, {}])("keeps catalog pages available when the response is missing the model: %j", async (response) => {
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => response }));
		render(await ModelDetailPage({ params: Promise.resolve({ slug: model.id }) }));
		expect(screen.getByRole("heading", { name: model.name })).toBeInTheDocument();
		expect(screen.getByRole("status")).toHaveTextContent("Live availability could not be confirmed");
	});

	it("uses the public model ID in every example, with accessible keyboard tabs", () => {
		const publicModel = { ...model, id: "public-model", modelId: "upstream/private-model" };
		render(<ModelDetail model={publicModel} availability={true} />);
		expect(screen.getByText("public-model")).toBeInTheDocument();
		const overview = screen.getByRole("tab", { name: "Overview" });
		overview.focus();
		fireEvent.keyDown(overview, { key: "ArrowRight" });
		const apiTab = screen.getByRole("tab", { name: "API examples" });
		expect(apiTab).toHaveFocus();
		expect(apiTab).toHaveAttribute("aria-selected", "true");
		const apiPanel = screen.getByRole("tabpanel", { name: "API examples" });
		expect(within(apiPanel).getByLabelText(`${model.name} cURL example`)).toHaveTextContent('"model": "public-model"');
		fireEvent.click(screen.getByRole("tab", { name: "Python" }));
		expect(screen.getByLabelText(`${model.name} Python example`)).toHaveTextContent('model="public-model"');
		fireEvent.keyDown(screen.getByRole("tab", { name: "Python" }), { key: "End" });
		expect(screen.getByRole("tab", { name: "JavaScript" })).toHaveFocus();
		expect(screen.getByLabelText(`${model.name} JavaScript example`)).toHaveTextContent('model: "public-model"');
		expect(within(apiPanel).getAllByRole("button", { name: "Copy code" })).toHaveLength(1);
	});

	it("shows only parameters returned by the catalog", () => {
		render(<ModelDetail model={model} availability={true} supportedParameters={["max_tokens", "stream"]} supportsTools={false} />);
		expect(screen.getByRole("heading", { name: "Supported parameters" })).toBeInTheDocument();
		expect(screen.getByText("stream")).toBeInTheDocument();
		expect(screen.queryByText("tool_choice")).not.toBeInTheDocument();
		expect(screen.queryByText("Tool calling")).not.toBeInTheDocument();
	});
});
