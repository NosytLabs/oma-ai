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

	it("keeps reasoning open when the final answer is empty but reasoning exists", () => {
		expect(
			shouldExpandReasoning({
				streaming: false,
				content: "",
				reasoning: "The answer is 4",
			}),
		).toBe(true);
		expect(
			shouldExpandReasoning({
				streaming: true,
				content: "",
				reasoning: "thinking…",
			}),
		).toBe(true);
		expect(
			shouldExpandReasoning({
				streaming: false,
				content: "4",
				reasoning: "math",
			}),
		).toBe(false);
	});
});
