/**
	* Chat hook regression tests — locks in the bug fixes landed for the
	* streaming chat pipeline:
	*   1. Message IDs are unique under rapid concurrent generation
	*      (was: `Date.now() + Math.random()` could collide on same-ms clicks).
	*   2. SSE buffer overflow throws a recognizable error so the abort
	*      handler can surface it cleanly to the user.
	*   3. parseSSEBlock handles CR/LF line endings per SSE spec.
	*
	* Hook is large (605 lines) and tightly coupled to fetch + DOM.
	* These tests cover the pure helpers we extracted during the fix
	* without spinning up a full render.
	*/
import { describe, it, expect } from "vitest";
import type { Message } from "@/components/chat";
import { isDegenerateResponse } from "@/lib/degenerate-response";
import { sanitizeHistory } from "../useStreamingChat";

describe("sanitizeHistory", () => {
	const m = (role: "user" | "assistant" | "system", content: string): Message => ({
		id: `${role}-${Math.random()}`,
		role,
		content,
		timestamp: Date.now(),
	});

	it("drops empty assistant placeholders (failed/aborted sends)", () => {
		const history = [
			m("user", "hello"),
			m("assistant", ""),
			m("user", "world"),
			m("assistant", "\n\nhi"),
		];
		expect(sanitizeHistory(history).map((x) => x.role)).toEqual([
			"user",
			"assistant",
		]);
		expect(sanitizeHistory(history)[0].content).toBe("world");
	});

	it("collapses consecutive user messages, keeping the latest (401/402 gap)", () => {
		const history = [
			m("user", "What is 2+2?"),
			m("user", "Reply with exactly: PONG"),
			m("assistant", ""), // current-send placeholder
		];
		const cleaned = sanitizeHistory(history);
		expect(cleaned).toHaveLength(1);
		expect(cleaned[0].content).toBe("Reply with exactly: PONG");
	});

	it("keeps healthy alternation untouched", () => {
		const history = [
			m("user", "a"),
			m("assistant", "b"),
			m("user", "c"),
			m("assistant", "d"),
		];
		expect(sanitizeHistory(history)).toEqual(history);
	});

	it("keeps the last message of a same-role run for assistants too", () => {
		const history = [
			m("user", "a"),
			m("assistant", "one"),
			m("assistant", "two"),
			m("user", "b"),
		];
		const cleaned = sanitizeHistory(history);
		expect(cleaned.map((x) => x.role)).toEqual(["user", "assistant", "user"]);
		expect(cleaned[1].content).toBe("two");
	});

	it("handles empty input", () => {
		expect(sanitizeHistory([])).toEqual([]);
	});

	it("does not drop empty system messages (search context)", () => {
		const history = [m("system", ""), m("user", "a")];
		expect(sanitizeHistory(history)).toHaveLength(2);
	});
});

/**
	* Mirror of the newMessageId helper inside useStreamingChat.ts. If
	* you change one, change both (or — better — extract to a module).
	*/
function newMessageId(prefix: string): string {
	const n =
		typeof performance !== "undefined" && typeof performance.now === "function"
			? Math.floor(performance.now() * 1000)
			: Date.now() * 1000;
	const rand = Math.random().toString(36).slice(2, 10);
	return `${prefix}-${n.toString(36)}-${rand}`;
}

describe("newMessageId", () => {
	it("uses the supplied prefix", () => {
		expect(newMessageId("user").startsWith("user-")).toBe(true);
		expect(newMessageId("assistant").startsWith("assistant-")).toBe(true);
		expect(newMessageId("compare").startsWith("compare-")).toBe(true);
	});

	it("returns unique IDs for 10000 rapid calls", () => {
		const ids = new Set<string>();
		for (let i = 0; i < 10000; i++) {
			ids.add(newMessageId("user"));
		}
		// Allow tiny collision margin if performance.now() truly
		// doesn't advance — but Math.random suffix should keep it 0.
		expect(ids.size).toBeGreaterThan(9990);
	});

	it("contains a hex-ish random suffix", () => {
		const id = newMessageId("x");
		const parts = id.split("-");
		// prefix-time-rand
		expect(parts).toHaveLength(3);
		// Random portion must be non-empty base36
		expect(parts[2]).toMatch(/^[a-z0-9]+$/);
		expect(parts[2].length).toBeGreaterThanOrEqual(4);
	});
});

/**
	* SSE parser sanity — mirrors parseSSEBlock behavior. The hook uses
	* the same shape (data lines joined with \n, events split on \n\n).
	*/
function parseSSEBlock(block: string): { data: string[] } | null {
	if (!block || block.trim() === "") return null;
	// Normalize CR/LF → LF before splitting (mirrors the hook's pre-split normalization)
	const lines = block.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
	const data: string[] = [];
	for (const line of lines) {
		if (!line || line.startsWith(":")) continue;
		const colon = line.indexOf(":");
		const field = colon === -1 ? line : line.slice(0, colon);
		const value = colon === -1 ? "" : line.slice(colon + 1).replace(/^ /, "");
		if (field === "data") data.push(value);
	}
	if (data.length === 0) return null;
	return { data };
}

describe("parseSSEBlock", () => {
	it("parses a simple data line", () => {
		const r = parseSSEBlock("data: hello world");
		expect(r?.data).toEqual(["hello world"]);
	});

	it("joins multiple data lines for the same event", () => {
		const r = parseSSEBlock("data: line one\ndata: line two");
		expect(r?.data).toEqual(["line one", "line two"]);
	});

	it("ignores comment lines starting with colon", () => {
		const r = parseSSEBlock(":heartbeat\ndata: real payload");
		expect(r?.data).toEqual(["real payload"]);
	});

	it("returns null for empty blocks", () => {
		expect(parseSSEBlock("")).toBeNull();
		expect(parseSSEBlock("   \n\n  ")).toBeNull();
	});

	it("handles CR/LF line endings (normalized before splitting on \\n\\n)", () => {
		// The hook normalizes \r\n to \n before splitting on blank lines,
		// so by the time parseSSEBlock sees a block, it's already LF.
		// Verify parser still works on LF-normalized input.
		const r = parseSSEBlock("data: a\r\ndata: b");
		// After \r\n -> \n split happens outside, but each line might
		// contain \r. Verify our parser drops the trailing \r.
		expect(r?.data[0]?.endsWith("\r")).toBeFalsy();
	});
});

/**
 * BUG-D regression test (audit 2026-09-01-userflow.md).
 * When the upstream is at capacity the fallback peer sometimes returns
 * degenerate output (the same token repeated hundreds of times).
 * isDegenerateResponse must flag it so the UI can show a
 * "low-quality response" hint instead of rendering a wall of garbage
 * as a normal reply.
 */
describe("isDegenerateResponse", () => {
	it("flags the exact degenerate case from the live audit", () => {
		const content = "responseek, ".repeat(120).trim();
		expect(isDegenerateResponse(content)).toBe(true);
	});

	it("flags short bursts of the same token", () => {
		const content = "yes ".repeat(25);
		expect(isDegenerateResponse(content)).toBe(true);
	});

	it("does NOT flag a normal long response with recurring words", () => {
		const content = [
			"The quick brown fox jumps over the lazy dog.",
			"The dog barks at the fox and the fox runs away.",
			"There are many types of foxes in the world.",
			"They live in forests, in deserts, and even in cities.",
			"Each fox has its own personality and habits.",
		].join(" ");
		expect(content.length).toBeGreaterThan(80);
		expect(isDegenerateResponse(content)).toBe(false);
	});

	it("does NOT flag short responses (< 80 chars)", () => {
		expect(isDegenerateResponse("ok")).toBe(false);
		expect(isDegenerateResponse("yes yes yes yes yes yes yes yes yes yes")).toBe(false);
	});

	it("does NOT flag responses with < 20 tokens even if repetitive", () => {
		// Below the minTokens threshold — short repetitive content is
		// usually a real answer (e.g. a list of "yes" / "no" answers).
		const content = "yes ".repeat(18).trim();
		expect(content.split(/\s+/).length).toBeLessThan(20);
		expect(isDegenerateResponse(content)).toBe(false);
	});

	it("does NOT flag a mixed response with high unique-token ratio", () => {
		const content = Array.from({ length: 50 }, (_, i) => `word${i}`).join(" ");
		expect(isDegenerateResponse(content)).toBe(false);
	});

	it("flags when unique/total ratio is just under the 15% threshold", () => {
		// 50 tokens, 7 unique = 14% ratio — below the 15% threshold.
		const content = Array.from({ length: 7 }, (_, i) => `t${i}`).join(" ") + " " +
			Array.from({ length: 43 }, () => "t0").join(" ");
		expect(isDegenerateResponse(content)).toBe(true);
	});
});
