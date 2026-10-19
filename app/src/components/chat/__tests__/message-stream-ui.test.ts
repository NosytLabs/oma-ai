/**
	* Locks the shipped stream-UI contract in message-stream-ui.ts
	* (used by ChatMessage): no infinite THINKING… while reasoning
	* tokens are already flowing; expand reasoning when answer body is empty.
	*/
import { describe, expect, it } from "vitest";
import {
	isWaitingForFirstToken,
	shouldExpandReasoning,
} from "../message-stream-ui";

describe("message-stream-ui (shipped ChatMessage helpers)", () => {
	it("shows Thinking… only when streaming with no content and no reasoning", () => {
		expect(
			isWaitingForFirstToken({ streaming: true, content: "", reasoning: "" }),
		).toBe(true);
		expect(
			isWaitingForFirstToken({
				streaming: true,
				content: "",
				reasoning: "step 1…",
			}),
		).toBe(false);
		expect(
			isWaitingForFirstToken({ streaming: true, content: "Hi", reasoning: "" }),
		).toBe(false);
		expect(
			isWaitingForFirstToken({ streaming: false, content: "", reasoning: "" }),
		).toBe(false);
	});

	it("keeps reasoning closed during streaming (post-stream rule still auto-expands)", () => {
		// During streaming, we deliberately do NOT auto-expand the chain-of-
		// thought. Word-by-word token dumps on a slow-reasoning model
		// (observed in production on MiniMax M2.7 free chat: 471 reasoning
		// tokens streamed live before a 4-word answer) make the surface
		// look broken. The ThinkingOrb in the avatar column already gives a
		// progress signal. To verify the post-stream fallback works: streaming
		// ends with no content + reasoning present → auto-expand.
		expect(
			shouldExpandReasoning({
				streaming: true,
				content: "",
				reasoning: "thinking…",
			}),
		).toBe(false);
		expect(
			shouldExpandReasoning({
				streaming: false,
				content: "",
				reasoning: "The answer is 4",
			}),
		).toBe(true);
		expect(
			shouldExpandReasoning({
				streaming: false,
				content: "4",
				reasoning: "math",
			}),
		).toBe(false);
		// And the user-toggle override must always win:
		expect(
			shouldExpandReasoning({
				streaming: true,
				content: "",
				reasoning: "thinking…",
				userExpanded: true,
			}),
		).toBe(true);
	});
});
