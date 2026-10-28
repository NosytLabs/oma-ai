import { describe, expect, it } from "vitest";
import { isSiweOriginValid } from "../siwe-origin.js";

describe("SIWE URI and scheme origin binding", () => {
	it.each([
		["https://www.oma-ai.com", "https", "https://www.oma-ai.com/login?next=%2Fchat#account"],
		["https://www.oma-ai.com", null, "https://www.oma-ai.com"],
		["https://www.preview.example:8443", "https", "https://www.preview.example:8443/resources"],
		["http://127.0.0.1:3123", "http", "http://127.0.0.1:3123/login"],
		["http://[::1]:3123", "http", "http://[::1]:3123/login"],
	])("accepts expected %s with scheme %s and URI %s", (expected, scheme, uri) => {
		expect(isSiweOriginValid({ scheme, uri }, expected!)).toBe(true);
	});
	it.each([
		["https://www.oma-ai.com", "https", "https://oma-ai.com"],
		["https://www.oma-ai.com", "http", "https://www.oma-ai.com"],
		["https://www.oma-ai.com", "https", "http://www.oma-ai.com"],
		["https://www.oma-ai.com", "https", "https://user:pass@www.oma-ai.com"],
		["https://www.oma-ai.com", "https", "https://www.oma-ai.com:8443"],
		["http://127.0.0.1:3123", null, "http://127.0.0.1:3123"],
		["https://www.oma-ai.com", "ftp", "https://www.oma-ai.com"],
		["ftp://www.oma-ai.com", "ftp", "ftp://www.oma-ai.com"],
		["https://user:pass@www.oma-ai.com", "https", "https://www.oma-ai.com"],
		["https://www.oma-ai.com", "https", "not a URI"],
		["https://www.oma-ai.com", "https", " https://www.oma-ai.com"],
		["https://www.oma-ai.com", "https", "https://www.oma-ai.com/with space"],
		["https://www.oma-ai.com", "https", "https:\\www.oma-ai.com"],
		["https://www.oma-ai.com", "https", null],
		["https://www.oma-ai.com", "https", "//www.oma-ai.com"],
	])("rejects expected %s with scheme %s and URI %s", (expected, scheme, uri) => {
		expect(isSiweOriginValid({ scheme, uri }, expected!)).toBe(false);
	});
});
