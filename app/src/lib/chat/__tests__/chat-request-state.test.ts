import { describe, expect, it } from "vitest";
import {
	CHAT_REQUEST_EVENT,
	CHAT_REQUEST_PHASE,
	INITIAL_CHAT_REQUEST_STATE,
	applyChatRequestEvent,
	canSendChatRequest,
	chatRequestPhaseLabel,
	isChatRequestInFlight,
	nextChatRequestPhase,
	type ChatRequestState,
} from "../chat-request-state";

describe("chat request machine", () => {
	it("starts idle and can send", () => {
		expect(INITIAL_CHAT_REQUEST_STATE.phase).toBe(CHAT_REQUEST_PHASE.Idle);
		expect(canSendChatRequest(INITIAL_CHAT_REQUEST_STATE)).toBe(true);
		expect(isChatRequestInFlight(INITIAL_CHAT_REQUEST_STATE)).toBe(false);
	});

	it("walks idle → sending → streaming → idle", () => {
		let state: ChatRequestState = INITIAL_CHAT_REQUEST_STATE;
		state = applyChatRequestEvent(state, CHAT_REQUEST_EVENT.Send);
		expect(state.phase).toBe(CHAT_REQUEST_PHASE.Sending);
		expect(isChatRequestInFlight(state)).toBe(true);
		expect(canSendChatRequest(state)).toBe(false);

		state = applyChatRequestEvent(state, CHAT_REQUEST_EVENT.FirstToken);
		expect(state.phase).toBe(CHAT_REQUEST_PHASE.Streaming);

		state = applyChatRequestEvent(state, CHAT_REQUEST_EVENT.Settled);
		expect(state.phase).toBe(CHAT_REQUEST_PHASE.Idle);
		expect(canSendChatRequest(state)).toBe(true);
	});

	it("keeps a failure terminal until the next send", () => {
		let state = applyChatRequestEvent(INITIAL_CHAT_REQUEST_STATE, CHAT_REQUEST_EVENT.Send);
		state = applyChatRequestEvent(state, CHAT_REQUEST_EVENT.Fail, "boom");
		expect(state.phase).toBe(CHAT_REQUEST_PHASE.Failed);
		expect(state.error).toBe("boom");
		expect(isChatRequestInFlight(state)).toBe(false);

		// A stray event cannot resurrect a finished request.
		state = applyChatRequestEvent(state, CHAT_REQUEST_EVENT.FirstToken);
		expect(state.phase).toBe(CHAT_REQUEST_PHASE.Failed);

		// The next send starts clean and clears the error.
		state = applyChatRequestEvent(state, CHAT_REQUEST_EVENT.Send);
		expect(state.phase).toBe(CHAT_REQUEST_PHASE.Sending);
		expect(state.error).toBeNull();
	});

	it("records a cancel as canceled, not failed", () => {
		let state = applyChatRequestEvent(INITIAL_CHAT_REQUEST_STATE, CHAT_REQUEST_EVENT.Send);
		state = applyChatRequestEvent(state, CHAT_REQUEST_EVENT.Cancel);
		expect(state.phase).toBe(CHAT_REQUEST_PHASE.Canceled);
		expect(state.error).toBeNull();
		expect(isChatRequestInFlight(state)).toBe(false);
	});

	it("preserves the original failure when late events are ignored", () => {
		const failed = applyChatRequestEvent(
			applyChatRequestEvent(INITIAL_CHAT_REQUEST_STATE, CHAT_REQUEST_EVENT.Send),
			CHAT_REQUEST_EVENT.Fail,
			"Provider unavailable; retry this message.",
		);
		for (const event of [
			CHAT_REQUEST_EVENT.FirstToken,
			CHAT_REQUEST_EVENT.Settled,
			CHAT_REQUEST_EVENT.Cancel,
			CHAT_REQUEST_EVENT.Fail,
		]) {
			expect(applyChatRequestEvent(failed, event)).toBe(failed);
			expect(applyChatRequestEvent(failed, event, "late error")).toBe(failed);
		}
	});

	it("accepts a cancel that lands after the in-flight flag was cleared", () => {
		// The Stop button clears `loading` before the aborted fetch rejects.
		const state = applyChatRequestEvent(INITIAL_CHAT_REQUEST_STATE, CHAT_REQUEST_EVENT.Cancel);
		expect(state.phase).toBe(CHAT_REQUEST_PHASE.Canceled);
	});

	it("ignores transitions that do not apply", () => {
		expect(nextChatRequestPhase(CHAT_REQUEST_PHASE.Idle, CHAT_REQUEST_EVENT.FirstToken)).toBe(
			CHAT_REQUEST_PHASE.Idle,
		);
		expect(nextChatRequestPhase(CHAT_REQUEST_PHASE.Streaming, CHAT_REQUEST_EVENT.Send)).toBe(
			CHAT_REQUEST_PHASE.Streaming,
		);
	});

	it("labels every phase", () => {
		for (const phase of Object.values(CHAT_REQUEST_PHASE)) {
			expect(chatRequestPhaseLabel({ phase, error: null }).length).toBeGreaterThan(0);
		}
	});
});
