import { describe, expect, it } from "vitest";
import { parseMediaMode } from "../usePlaygroundState";

describe("parseMediaMode", () => {
	it("defaults to text for empty/unknown", () => {
		expect(parseMediaMode(null)).toBe("text");
		expect(parseMediaMode(undefined)).toBe("text");
		expect(parseMediaMode("")).toBe("text");
		expect(parseMediaMode("nope")).toBe("text");
	});

	it("accepts image aliases for legacy redirects", () => {
		expect(parseMediaMode("image")).toBe("image");
		expect(parseMediaMode("IMG")).toBe("image");
	});

	it("accepts video aliases", () => {
		expect(parseMediaMode("video")).toBe("video");
		expect(parseMediaMode("vid")).toBe("video");
	});

	it("accepts chat as text alias", () => {
		expect(parseMediaMode("chat")).toBe("text");
		expect(parseMediaMode("text")).toBe("text");
	});
});
