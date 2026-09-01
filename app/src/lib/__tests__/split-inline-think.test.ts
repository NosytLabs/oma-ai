import { describe, it, expect } from "vitest";
import { splitInlineThink } from "@/lib/split-inline-think";

const wrap = (inner: string, rest = "") =>
	"<" + "think>" + inner + "</" + "think>" + rest;

describe("splitInlineThink", () => {
	it("is a no-op when there are no think tags", () => {
		expect(splitInlineThink("hello")).toEqual({
			content: "hello",
			reasoning: "",
		});
	});

	it("extracts reasoning and leaves the visible answer", () => {
		const input = wrap("step one\nstep two", "\n\nThe answer is 42.");
		expect(splitInlineThink(input)).toEqual({
			content: "The answer is 42.",
			reasoning: "step one\nstep two",
		});
	});

	it("handles think-only payloads (empty visible answer)", () => {
		expect(splitInlineThink(wrap("just thinking"))).toEqual({
			content: "",
			reasoning: "just thinking",
		});
	});

	it("is case-insensitive on the tag name", () => {
		const input = "<" + "THINK>why</" + "THINK>because";
		const r = splitInlineThink(input);
		expect(r.reasoning).toBe("why");
		expect(r.content).toBe("because");
	});
});
