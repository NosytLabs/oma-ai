import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChatMessage } from "../ChatMessage";
import type { Message } from "../chat-message-shared";

vi.mock("thinking-orbs", () => ({
	ThinkingOrb: () => null,
}));

const assistantMessage: Message = {
	id: "message_1",
	role: "assistant",
	content: "A completed response should be readable immediately.",
	timestamp: Date.now(),
};

describe("ChatMessage", () => {
	it("renders completed assistant messages at full visibility", () => {
		render(
			<ChatMessage
				msg={assistantMessage}
				loading={false}
				onCopy={vi.fn()}
			/>,
		);

		expect(
			screen.getByText("A completed response should be readable immediately."),
		).toBeVisible();
	});

	it("keeps the standard message frame around structured assistant content", () => {
		const onRegenerate = vi.fn();
		render(
			<ChatMessage
				msg={{
					...assistantMessage,
					content: [
						'root = Card("Interactive UI", [body])',
						'body = Text("Catalog-backed content")',
					].join("\n"),
					format: "openui",
					model: "claude-opus-5",
					outputTokens: 42,
					searchResults: [
						{
							title: "OpenUI documentation",
							url: "https://www.openui.com/docs",
							snippet: "Official documentation",
						},
					],
				}}
				loading={false}
				onCopy={vi.fn()}
				onRegenerate={onRegenerate}
				isLastAssistant
			/>,
		);

		expect(screen.getByText("Interactive UI")).toBeVisible();
		expect(screen.getByText("Catalog-backed content")).toBeVisible();
		expect(screen.getByText("1 SOURCE")).toBeVisible();
		expect(screen.getByText("TK:42")).toBeVisible();
		expect(screen.getByRole("button", { name: "Copy message" })).toBeVisible();
		expect(
			screen.getByRole("button", { name: "Regenerate response" }),
		).toBeVisible();
	});

	it("renders one code frame per fence while keeping inline code inline", () => {
		const { container } = render(
			<ChatMessage
				msg={{
					...assistantMessage,
					content: [
						"Use `inline()` in prose.",
						"",
						"```",
						"unlabelled()",
						"```",
						"",
						"```ts",
						"typed()",
						"```",
					].join("\n"),
				}}
				loading={false}
				onCopy={vi.fn()}
			/>,
		);

		const inlineCode = screen.getByText("inline()", { selector: "code" });
		expect(inlineCode.closest("pre")).toBeNull();
		expect(container.querySelectorAll("pre")).toHaveLength(2);
		expect(container.querySelector("pre pre")).toBeNull();
		expect(screen.getByText("unlabelled()", { selector: "code" })).toBeVisible();
		expect(screen.getByText("typed()", { selector: "code" })).toBeVisible();
	});
});
