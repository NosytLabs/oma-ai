import { describe, expect, it } from "vitest";
import { parseMediaMode } from "../usePlaygroundState";

describe("parseMediaMode", () => {
	it("defaults to text for empty/unknown", () => {
		expect(parseMediaMode(null)).toBe("text");
		expect(parseMediaMode(undefined)).toBe("text");
		expect(parseMediaMode("")).toBe("text");
		expect(parseMediaMode("nope")).toBe("text");
	});

	// 2026-07-30: IMAGE and VIDEO modes are no longer accepted — the
	// playground is chat-only until image/video endpoints ship. The
	// legacy /chat?mode=image and /chat?mode=video URLs from the
	// /image-generation and /video-generation page redirects now
	// silently fall through to chat. Re-enable the alias tests when
	// the corresponding endpoints land.

	it("accepts chat as text alias", () => {
		expect(parseMediaMode("chat")).toBe("text");
		expect(parseMediaMode("text")).toBe("text");
	});

	it("ignores legacy image/video modes (endpoints not yet shipped)", () => {
		expect(parseMediaMode("image")).toBe("text");
		expect(parseMediaMode("IMG")).toBe("text");
		expect(parseMediaMode("video")).toBe("text");
		expect(parseMediaMode("vid")).toBe("text");
	});
});
