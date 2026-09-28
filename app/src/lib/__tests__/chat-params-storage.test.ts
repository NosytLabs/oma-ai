/**
 * BUG-I regression tests: the parameters panel must never show a value the
 * browser didn't actually store, and a failed write must be reported so the
 * caller can revert.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	CHAT_PARAMS_DEFAULTS,
	CHAT_PARAMS_STORAGE_KEY,
	normalizeChatParams,
	readChatParams,
	writeChatParams,
} from "@/lib/chat-params-storage";

describe("chat-params-storage", () => {
	beforeEach(() => {
		window.localStorage.clear();
	});

	afterEach(() => {
		vi.restoreAllMocks();
		window.localStorage.clear();
	});

	it("returns null when nothing has been stored", () => {
		expect(readChatParams()).toBeNull();
	});

	it("round-trips a write", () => {
		const params = {
			...CHAT_PARAMS_DEFAULTS,
			temperature: 1.4,
			maxTokens: 4096,
			stream: false,
		};
		expect(writeChatParams(params)).toBe(true);
		expect(readChatParams()).toEqual(params);
	});

	it("returns false (so the caller can revert) when the write throws", () => {
		// jsdom Storage is a named-property proxy: assigning an instance
		// method can become a stored key instead of replacing setItem. Node
		// 24 uses that implementation; the Node 26 fallback is a plain object.
		const storage = window.localStorage;
		const prototype = Object.getPrototypeOf(storage);
		const methodOwner = typeof prototype.setItem === "function" ? prototype : storage;
		vi.spyOn(methodOwner, "setItem").mockImplementation(() => {
			throw new Error("QuotaExceededError");
		});
		expect(writeChatParams(CHAT_PARAMS_DEFAULTS)).toBe(false);
	});

	it("treats corrupt JSON as nothing saved instead of throwing", () => {
		window.localStorage.setItem(CHAT_PARAMS_STORAGE_KEY, "{not json");
		expect(readChatParams()).toBeNull();
	});

	it("clamps out-of-range numbers and drops junk fields", () => {
		const result = normalizeChatParams({
			temperature: 99,
			topP: -5,
			maxTokens: Number.NaN,
			topK: "nope",
			stream: "yes",
			extraField: 1,
		});
		expect(result.temperature).toBe(2);
		expect(result.topP).toBe(0);
		expect(result.maxTokens).toBe(CHAT_PARAMS_DEFAULTS.maxTokens);
		expect(result.topK).toBe(CHAT_PARAMS_DEFAULTS.topK);
		expect(result.stream).toBe(CHAT_PARAMS_DEFAULTS.stream);
		expect("extraField" in result).toBe(false);
	});

	it("falls back to defaults for a non-object payload", () => {
		expect(normalizeChatParams(null)).toEqual(CHAT_PARAMS_DEFAULTS);
		expect(normalizeChatParams("nope")).toEqual(CHAT_PARAMS_DEFAULTS);
	});
});
