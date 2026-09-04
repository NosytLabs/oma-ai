import { describe, expect, it } from "vitest";
import { playgroundHrefForModel } from "../playground-href";

describe("playgroundHrefForModel", () => {
	it("routes the catalog id into /chat?model=", () => {
		expect(playgroundHrefForModel("deepseek-v4-flash-0731-openbroker")).toBe(
			"/chat?model=deepseek-v4-flash-0731-openbroker",
		);
	});

	it("URL-encodes slashes and special chars", () => {
		expect(playgroundHrefForModel("a/b?c")).toBe("/chat?model=a%2Fb%3Fc");
	});
});
