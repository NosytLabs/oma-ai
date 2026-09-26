import { describe, expect, it } from "vitest";
import { classifyMessage } from "../MessagesList";

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
