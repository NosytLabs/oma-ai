import { describe, expect, it } from "vitest";
import { playgroundHrefForModel } from "../playground-href";

describe("playgroundHrefForModel", () => {
	it("routes chat models with model= id", () => {
		expect(
			playgroundHrefForModel({ id: "deepseek-v4-flash-0731-openbroker", modality: "chat" }),
		).toBe("/chat?model=deepseek-v4-flash-0731-openbroker");
	});

	it("routes multimodal models into text chat with model= id", () => {
		// OMA only ships text/multimodal LLM inference; image/video models
		// would have routed to the Create studio, but the studio is gone.
		expect(
			playgroundHrefForModel({ id: "flux", modality: "image" }),
		).toBe("/chat?model=flux");
	});

	it("ignores outputModalities (legacy fall-through)", () => {
		expect(
			playgroundHrefForModel({
				id: "ltx",
				outputModalities: ["video"],
			}),
		).toBe("/chat?model=ltx");
	});
});
