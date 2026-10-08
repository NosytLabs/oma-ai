import { describe, expect, it } from "vitest";
import { isValidOpenUIResponse } from "@/lib/openui";
import { classifyMessage } from "@/lib/openui-message-format";

/**
 * classifyMessage decides whether an assistant message is a plain-text reply
 * or an A2UI envelope that should render as an interactive surface. It has to
 * handle a real edge the live flow hit: web search prepends a "N SOURCES"
 * preamble to the model's reply, so the content does NOT start with `{` even
 * though the reply body is a valid A2UI envelope. Before the embedded-object
 * scan was added, that message was classified "plain" and the whole JSON spec
 * rendered as raw markdown (escaped quotes included).
 */

const A2UI_ENVELOPE = JSON.stringify({
	version: "v0.9.1",
	createSurface: { surfaceId: "app" },
	updateComponents: {
		surfaceId: "app",
		components: [
			{ id: "root", component: "Column", children: ["card"] },
			{ id: "card", component: "Card", title: "Counter", child: "content" },
		],
	},
	updateDataModel: { surfaceId: "app", path: "/", value: { count: 0 } },
});

describe("classifyMessage — A2UI detection", () => {
	it("classifies a plain message as plain", () => {
		expect(classifyMessage("Hello, how can I help you?")).toEqual({
			kind: "plain",
		});
	});

	it("classifies a message that starts with an A2UI envelope as a2ui", () => {
		const r = classifyMessage(A2UI_ENVELOPE);
		expect(r.kind).toBe("a2ui");
	});

	it("classifies A2UI JSON that follows a web-search sources preamble", () => {
		// Real shape from the bug: web search injects "N SOURCES" before the
		// model's A2UI reply, so the content doesn't start with `{`.
		const preamble = [
			"6 SOURCES",
			"Design a counter - www.geeksforgeeks.org",
			"Simple counter - github.com",
			"",
			A2UI_ENVELOPE,
		].join("\n");
		const r = classifyMessage(preamble);
		expect(r.kind).toBe("a2ui");
	});

	it("classifies A2UI JSON embedded after arbitrary assistant prose", () => {
		const content = `Here is a settings form for you:\n\n${A2UI_ENVELOPE}`;
		const r = classifyMessage(content);
		expect(r.kind).toBe("a2ui");
	});

	it("keeps plain text that merely contains a brace as plain", () => {
		// A normal reply that mentions JSON must not be hijacked.
		const content = "Use a {map} or a {list} — either works fine.";
		expect(classifyMessage(content)).toEqual({ kind: "plain" });
	});

	it("keeps prose + unrelated JSON as plain", () => {
		const content = 'Config loaded: {"a":1,"b":2}. All good.';
		expect(classifyMessage(content)).toEqual({ kind: "plain" });
	});
});

describe("classifyMessage — OpenUI streaming detection", () => {
	it("streams ordinary prose normally even when UI mode requested OpenUI", () => {
		expect(
			classifyMessage("Here is a normal text answer.", {
				format: "openui",
				isStreaming: true,
			}),
		).toEqual({ kind: "plain" });
	});

	it("suppresses a partial root assignment while OpenUI is streaming", () => {
		expect(
			classifyMessage("roo", {
				format: "openui",
				isStreaming: true,
			}),
		).toEqual({ kind: "openui", response: "roo" });
	});

	it("uses an explicit message format before the first OpenUI statement is complete", () => {
		expect(
			classifyMessage("root = Stack([", {
				format: "openui",
				isStreaming: true,
			}),
		).toEqual({ kind: "openui", response: "root = Stack([" });
	});

	it("extracts an OpenUI fence while it is still streaming", () => {
		expect(
			classifyMessage("```openui\nroot = Stack([title", {
				isStreaming: true,
			}),
		).toEqual({ kind: "openui", response: "root = Stack([title" });
	});

	it("falls back to plain text when an explicitly formatted response is invalid at completion", () => {
		expect(
			classifyMessage("This model ignored the OpenUI instructions.", {
				format: "openui",
				isStreaming: false,
				isValidOpenUI: () => false,
			}),
		).toEqual({ kind: "plain" });
	});

	it("keeps a completed, valid explicitly formatted OpenUI response", () => {
		expect(
			classifyMessage('root = Text({ content: "Ready" })', {
				format: "openui",
				isStreaming: false,
				isValidOpenUI: () => true,
			}),
		).toEqual({
			kind: "openui",
			response: 'root = Text({ content: "Ready" })',
		});
	});

	it("recognizes a completed valid OpenUI response from saved history without a format stamp", () => {
		expect(
			classifyMessage('root = Text({ content: "Saved" })', {
				isStreaming: false,
				isValidOpenUI: () => true,
			}),
		).toEqual({
			kind: "openui",
			response: 'root = Text({ content: "Saved" })',
		});
	});

	it("accepts parser-supported leading comments only for a requested, validated response", () => {
		const response = [
			"// generated interface",
			'root = Card("Ready", [body])',
			'body = Text("Catalog-backed content")',
		].join("\n");
		expect(isValidOpenUIResponse(response)).toBe(true);
		expect(
			classifyMessage(response, {
				format: "openui",
				isStreaming: false,
				isValidOpenUI: isValidOpenUIResponse,
			}),
		).toEqual({ kind: "openui", response });
		expect(
			classifyMessage(response, {
				isStreaming: false,
				isValidOpenUI: isValidOpenUIResponse,
			}),
		).toEqual({ kind: "plain" });
	});

	it.each([
		"# generated interface\nroo",
		'// generated interface\nroot = Card("Ready", [',
	])("finds a requested OpenUI stream after a leading comment: %s", (response) => {
		expect(
			classifyMessage(response, {
				format: "openui",
				isStreaming: true,
			}),
		).toEqual({ kind: "openui", response });
	});
});
