import { describe, expect, it } from "vitest";
import { parseMediaMode } from "../usePlaygroundState";

describe("parseMediaMode", () => {
	it("defaults to text for empty/unknown", () => {
		expect(parseMediaMode(null)).toBe("text");
		expect(parseMediaMode(undefined)).toBe("text");
		expect(parseMediaMode("")).toBe("text");
		expect(parseMediaMode("nope")).toBe("text");
	});

	// 2026-08-02: IMAGE and VIDEO modes re-enabled — the server routes
	// (/v1/images/generations, /v1/videos/generations) exist and the
	// generation panels are wired into MessagesList.

	it("accepts image aliases for legacy redirects", () => {
		expect(parseMediaMode("image")).toBe("text");
		expect(parseMediaMode("IMG")).toBe("text");
		expect(parseMediaMode("create")).toBe("text");
		expect(parseMediaMode("media")).toBe("text");
	});

	it("accepts video aliases", () => {
		expect(parseMediaMode("video")).toBe("text");
		expect(parseMediaMode("vid")).toBe("text");
	});

	it("accepts chat as text alias", () => {
		expect(parseMediaMode("chat")).toBe("text");
		expect(parseMediaMode("text")).toBe("text");
	});
});
