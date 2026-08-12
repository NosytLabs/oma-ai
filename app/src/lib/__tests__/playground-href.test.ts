import { describe, expect, it } from "vitest";
import { playgroundHrefForModel } from "../playground-href";

describe("playgroundHrefForModel", () => {
	it("routes chat models with model= id", () => {
		expect(
			playgroundHrefForModel({ id: "gemini-3-flash-preview", modality: "chat" }),
		).toBe("/chat?model=gemini-3-flash-preview");
	});

	it("routes image models into Create studio", () => {
		expect(
			playgroundHrefForModel({ id: "venice-sd35", modality: "image" }),
		).toBe("/chat?mode=image");
		expect(
			playgroundHrefForModel({
				id: "flux",
				outputModalities: ["image"],
			}),
		).toBe("/chat?mode=image");
	});

	it("routes video models into Create video", () => {
		expect(
			playgroundHrefForModel({ id: "ltx", modality: "video" }),
		).toBe("/chat?mode=video");
	});
});
