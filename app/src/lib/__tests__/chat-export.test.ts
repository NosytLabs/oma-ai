import { describe, expect, it } from "vitest";
import { parseImportedChat } from "../chat-export";

function file(name: string, value: unknown): File {
	return { name, text: async () => typeof value === "string" ? value : JSON.stringify(value) } as File;
}

describe("conversation import", () => {
	it("retains interactive replies, sources, and usage from a JSON export", async () => {
		const messages = [{ role: "assistant", content: 'root = Text("Hello")', timestamp: 123,
			format: "openui", tokens: 12, model: "zai-org-glm-5-3", viaFallback: true,
			searchResults: [{ title: "Source", url: "https://example.com", snippet: "Details" }],
		}];
		expect(await parseImportedChat(file("conversation.json", messages))).toMatchObject(messages);
	});

	it("normalizes old JSON messages without timestamps so they survive history reload", async () => {
		const result = await parseImportedChat(file("conversation.JSON", [{ role: "user", content: "Hello" }]));
		expect(result[0]).toMatchObject({ role: "user", content: "Hello" });
		expect(Number.isFinite(result[0].timestamp)).toBe(true);
	});

	it.each([
		{ messages: [{ role: "administrator", content: "bad", timestamp: 1 }] },
		{ messages: [{ role: "assistant", content: "bad", timestamp: 1, searchResults: "invalid" }] },
		{ messages: [{ role: "assistant", content: "bad", timestamp: "yesterday" }] },
		{ messages: [null] },
		{ messages: [] },
	])("rejects a malformed JSON conversation without changing the current chat", async ({ messages }) => {
		await expect(parseImportedChat(file("conversation.json", messages))).rejects.toThrow(/invalid|empty/i);
	});

	it("reads the Markdown export roles and multiline content", async () => {
		const result = await parseImportedChat(file("chat.md", "### User\n\nQuestion?\n\n---\n\n### Assistant\n\n**Answer**\n\nMore detail.\n"));
		expect(result.map(({ role, content }) => ({ role, content }))).toEqual([
			{ role: "user", content: "Question?" },
			{ role: "assistant", content: "**Answer**\n\nMore detail." },
		]);
	});
});
