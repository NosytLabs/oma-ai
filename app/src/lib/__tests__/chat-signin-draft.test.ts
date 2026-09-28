import { beforeEach, describe, expect, it } from "vitest";
import { consumeChatSignInDraft, registerChatSignInDraft, saveChatDraftForSignIn } from "../chat-signin-draft";

beforeEach(() => { sessionStorage.clear(); });

describe("sign-in draft handoff", () => {
	it("does not restore an existing account's draft into another account", () => {
		const unregister = registerChatSignInDraft(() => ({ model: "claude-opus-5", input: "Account A only", userId: "account-a" }));
		saveChatDraftForSignIn();
		unregister();
		expect(consumeChatSignInDraft("claude-opus-5", "account-b")).toBeNull();
		expect(consumeChatSignInDraft("claude-opus-5", "account-a")).toBeNull();
	});

	it("consumes an account's reauthentication draft only once", () => {
		const unregister = registerChatSignInDraft(() => ({ model: "claude-opus-5", input: "Same account", userId: "account-a" }));
		saveChatDraftForSignIn();
		unregister();
		expect(consumeChatSignInDraft("claude-opus-5", "account-a")).toBe("Same account");
		expect(consumeChatSignInDraft("claude-opus-5", "account-a")).toBeNull();
	});

	it("does not retain an unmounted chat as a source for unrelated sign-in links", () => {
		const unregister = registerChatSignInDraft(() => ({ model: "claude-opus-5", input: "Old page", userId: null }));
		unregister();
		saveChatDraftForSignIn();
		expect(sessionStorage.getItem("oma_chat_signin_draft")).toBeNull();
	});

	it("discards malformed handoffs without breaking the composer", () => {
		sessionStorage.setItem("oma_chat_signin_draft", "invalid json");
		expect(consumeChatSignInDraft("claude-opus-5", "account-a")).toBeNull();
		expect(sessionStorage.getItem("oma_chat_signin_draft")).toBeNull();
	});
});
