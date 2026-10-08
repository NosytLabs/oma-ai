import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OpenUIRenderer } from "../OpenUIRenderer";

vi.mock("../chat-message-shared", async () => {
	const actual =
		await vi.importActual<typeof import("../chat-message-shared")>(
			"../chat-message-shared",
		);
	return {
		...actual,
		useSharedLiveModelCatalog: () => ({
			status: "live",
			models: [
				{
					id: "model-a",
					name: "Model Alpha",
					category: "budget",
					provider: "oma-ai",
					inputPer1M: 0.2,
					outputPer1M: 0.4,
					ctx: "128K",
					pricingAvailable: true,
				},
				{
					id: "model-b",
					name: "Model Beta",
					category: "reasoning",
					provider: "venice",
					inputPer1M: 1.5,
					outputPer1M: 4,
					ctx: "256K",
					pricingAvailable: true,
				},
			],
		}),
	};
});

const comparisonResponse = [
	'root = Card("Live model comparison", [comparison])',
	'comparison = ModelComparison(["model-a", "model-b"])',
].join("\n");

const settingsResponse = [
	'root = Card("Request settings", [settings])',
	'settings = SettingsForm("model-a", 0.7, 0.9, 2048)',
].join("\n");

const followupResponse = [
	'root = Card("Next step", [followup])',
	'followup = Button("Compare again", "Compare these models with a larger context window")',
].join("\n");

describe("OpenUIRenderer", () => {
	it("renders a comparison from OMA's live model catalog", () => {
		render(
			<OpenUIRenderer
				response={comparisonResponse}
				isStreaming={false}
			/>,
		);

		expect(screen.getByText("Model Alpha")).toBeVisible();
		expect(screen.getByText("Model Beta")).toBeVisible();
		expect(screen.getByText("$0.20 / $0.40")).toBeVisible();
		expect(screen.getByText("Live catalog")).toBeVisible();
	});

	it("preserves edited form state when the streamed response grows", () => {
		const { rerender } = render(
			<OpenUIRenderer response={settingsResponse} isStreaming={false} />,
		);
		const temperature = screen.getByLabelText("Temperature");
		fireEvent.change(temperature, { target: { value: "1.2" } });
		expect(temperature).toHaveValue(1.2);

		rerender(
			<OpenUIRenderer
				response={`${settingsResponse}\nextra = Text("still streaming")`}
				isStreaming
			/>,
		);
		expect(screen.getByLabelText("Temperature")).toHaveValue(1.2);
		expect(screen.getByRole("button", { name: "Apply settings" })).toBeDisabled();
	});

	it("shows pending and rejected typed actions", async () => {
		let rejectAction: ((error: Error) => void) | undefined;
		const onAction = vi.fn(
			() =>
				new Promise<void>((_resolve, reject) => {
					rejectAction = reject;
				}),
		);
		render(
			<OpenUIRenderer
				response={settingsResponse}
				isStreaming={false}
				onAction={onAction}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: "Apply settings" }));
		await waitFor(() => expect(onAction).toHaveBeenCalledTimes(1));
		expect(screen.getByRole("button", { name: "Apply settings" })).toBeDisabled();
		expect(onAction).toHaveBeenCalledWith({
			type: "apply-settings",
			settings: {
				model: "model-a",
				temperature: 0.7,
				topP: 0.9,
				maxTokens: 2048,
			},
		});
		expect(screen.getByRole("status")).toHaveTextContent("Applying settings");

		rejectAction?.(new Error("That model is unavailable"));
		expect(await screen.findByRole("alert")).toHaveTextContent(
			"That model is unavailable",
		);
	});

	it("surfaces a synchronous action-handler rejection", async () => {
		render(
			<OpenUIRenderer
				response={settingsResponse}
				isStreaming={false}
				onAction={() => {
					throw new Error("Settings are not allowed for this model");
				}}
			/>,
		);
		fireEvent.click(screen.getByRole("button", { name: "Apply settings" }));
		expect(await screen.findByRole("alert")).toHaveTextContent(
			"Settings are not allowed for this model",
		);
	});

	it("emits only a typed conversational follow-up from generated buttons", async () => {
		const onAction = vi.fn();
		render(
			<OpenUIRenderer
				response={followupResponse}
				isStreaming={false}
				onAction={onAction}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: "Compare again" }));
		await waitFor(() =>
			expect(onAction).toHaveBeenCalledWith({
				type: "followup",
				prompt: "Compare these models with a larger context window",
			}),
		);
	});
});
