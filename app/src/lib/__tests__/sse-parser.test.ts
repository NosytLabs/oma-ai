import { describe, it, expect } from "vitest";
import { parseSSEBlock } from "../sse-parser";

describe("parseSSEBlock", () => {
	it("returns null for empty strings or whitespace", () => {
		expect(parseSSEBlock("")).toBeNull();
		expect(parseSSEBlock("   \n  ")).toBeNull();
	});

	it("parses a single data line without event or id", () => {
		const block = "data: hello world";
		const parsed = parseSSEBlock(block);
		expect(parsed).toEqual({
			event: undefined,
			id: undefined,
			data: ["hello world"],
		});
	});

	it("strips leading space from data values", () => {
		const block = "data:  spaced out \ndata:no leading space";
		const parsed = parseSSEBlock(block);
		expect(parsed?.data).toEqual([" spaced out ", "no leading space"]);
	});

	it("parses event type and id", () => {
		const block = "event: start\nid: msg123\ndata: payload";
		const parsed = parseSSEBlock(block);
		expect(parsed).toEqual({
			event: "start",
			id: "msg123",
			data: ["payload"],
		});
	});

	it("combines multiple data lines", () => {
		const block = "data: line1\ndata: line2\ndata: line3";
		const parsed = parseSSEBlock(block);
		expect(parsed?.data).toEqual(["line1", "line2", "line3"]);
	});

	it("ignores comment lines starting with colon", () => {
		const block = ": keepalive\ndata: actual data\n: another comment";
		const parsed = parseSSEBlock(block);
		expect(parsed?.data).toEqual(["actual data"]);
		// No event should be falsely extracted
		expect(parsed?.event).toBeUndefined();
	});

	it("handles data lines with colons in the payload", () => {
		const block = 'data: {"key":"value", "nested":{"a":1}}';
		const parsed = parseSSEBlock(block);
		expect(parsed?.data).toEqual(['{"key":"value", "nested":{"a":1}}']);
	});

	it("handles empty data values", () => {
		const block = "data:\ndata: \n"; // One with no space, one with space
		const parsed = parseSSEBlock(block);
		expect(parsed?.data).toEqual(["", ""]);
	});

	it("handles bare field without a colon as empty string value", () => {
		const block = "data\nevent\nid";
		const parsed = parseSSEBlock(block);
		expect(parsed).toEqual({
			event: "",
			id: "",
			data: [""],
		});
	});

	it("returns null if no known fields are present", () => {
		const block = "unknown: field\nanother: field";
		const parsed = parseSSEBlock(block);
		expect(parsed).toBeNull();
	});

	it("tolerates unknown fields alongside valid ones", () => {
		const block = "event: test\nunknown: ignore me\ndata: payload";
		const parsed = parseSSEBlock(block);
		expect(parsed).toEqual({
			event: "test",
			id: undefined,
			data: ["payload"],
		});
	});
});
