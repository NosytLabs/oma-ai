import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChatMessageed } from "../ChatMessage";
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

describe("ChatMessageed", () => {
	it("renders completed assistant messages at full visibility", () => {
		render(
			<ChatMessageed
				msg={assistantMessage}
				loading={false}
				onCopy={vi.fn()}
			/>,
		);

		expect(
			screen.getByText("A completed response should be readable immediately."),
		).toBeVisible();
	});
});
