import { describe, expect, it } from "vitest";
import { parseStreamData } from "../stream-parser";

/**
 * `parseStreamData` is the frame-level half of the chat SSE reader. It was
 * previously an inline closure inside a 300-line useCallback, which meant the
 * only way to exercise any of it was to mount the hook and drive a real
 * stream through it. These are the cases that actually broke things.
 */
describe("parseStreamData", () => {
	it("returns null for the DONE sentinel and blank frames", () => {
		expect(parseStreamData("[DONE]")).toBeNull();
		expect(parseStreamData("")).toBeNull();
		expect(parseStreamData("   \n  ")).toBeNull();
	});

	it("returns null rather than throwing on malformed JSON", () => {
		// A truncated frame at a chunk boundary is normal on a flaky network.
		// It must not take the whole message down.
		expect(parseStreamData('{"choices":[{"delta":{"con')).toBeNull();
		expect(parseStreamData("not json at all")).toBeNull();
	});

	it("extracts a content delta", () => {
		const d = parseStreamData(
			'{"choices":[{"delta":{"content":"hello"}}]}',
		);
		expect(d).toEqual({ content: "hello" });
	});

	it("extracts reasoning_content, which reasoning models emit separately", () => {
		const d = parseStreamData(
			'{"choices":[{"delta":{"reasoning_content":"thinking..."}}]}',
		);
		expect(d).toEqual({ reasoning: "thinking..." });
	});

	it("falls back to the `reasoning` field name", () => {
		const d = parseStreamData('{"choices":[{"delta":{"reasoning":"hmm"}}]}');
		expect(d).toEqual({ reasoning: "hmm" });
	});

	it("prefers reasoning_content when both are present", () => {
		const d = parseStreamData(
			'{"choices":[{"delta":{"reasoning_content":"a","reasoning":"b"}}]}',
		);
		expect(d).toEqual({ reasoning: "a" });
	});

	it("returns both content and reasoning from a single frame", () => {
		// Real streams interleave these; dropping one loses visible output.
		const d = parseStreamData(
			'{"choices":[{"delta":{"content":"ans","reasoning_content":"why"}}]}',
		);
		expect(d).toEqual({ content: "ans", reasoning: "why" });
	});

	it("captures usage.total_tokens for the final frame", () => {
		const d = parseStreamData(
			'{"choices":[],"usage":{"total_tokens":123}}',
		);
		expect(d).toEqual({ totalTokens: 123 });
	});

	it("captures finish_reason so truncation can be flagged", () => {
		const d = parseStreamData(
			'{"choices":[{"delta":{},"finish_reason":"length"}]}',
		);
		expect(d).toEqual({ finishReason: "length" });
	});

	it("keeps input and output counts separate from total tokens, including a real zero", () => {
		expect(parseStreamData('{"choices":[],"usage":{"prompt_tokens":21,"completion_tokens":80,"total_tokens":101}}')).toEqual({ inputTokens: 21, outputTokens: 80, totalTokens: 101 });
		expect(parseStreamData('{"choices":[],"usage":{"prompt_tokens":21,"completion_tokens":0,"total_tokens":21}}')).toEqual({ inputTokens: 21, outputTokens: 0, totalTokens: 21 });
	});

	it("ignores invalid token counts and non-string provider deltas", () => {
		expect(parseStreamData('{"choices":[{"delta":{"content":{},"reasoning":[]}}],"usage":{"total_tokens":-2,"completion_tokens":1.5,"prompt_tokens":"20"}}')).toBeNull();
	});

	it("ignores a null finish_reason on intermediate frames", () => {
		const d = parseStreamData(
			'{"choices":[{"delta":{"content":"x"},"finish_reason":null}]}',
		);
		expect(d).toEqual({ content: "x" });
	});

	it("returns null for a frame carrying no usable delta", () => {
		// Providers send keepalive and role-only frames. They are not errors,
		// but applying them must be a no-op.
		expect(
			parseStreamData('{"choices":[{"delta":{"role":"assistant"}}]}'),
		).toBeNull();
		expect(parseStreamData('{"choices":[]}')).toBeNull();
		expect(parseStreamData("{}")).toBeNull();
	});

	it("does not treat a zero usage count as a real count", () => {
		// The old code used a truthy check, so 0 was ignored -- keep that,
		// since a zero here means "not reported", not "no tokens used".
		expect(
			parseStreamData('{"choices":[],"usage":{"total_tokens":0}}'),
		).toBeNull();
	});

	it("preserves unicode and emoji without mangling", () => {
		const d = parseStreamData(
			'{"choices":[{"delta":{"content":"héllo 🌍 \\u0041"}}]}',
		);
		expect(d).toEqual({ content: "héllo 🌍 A" });
	});
});
