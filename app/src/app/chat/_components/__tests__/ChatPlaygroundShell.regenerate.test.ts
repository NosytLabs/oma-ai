import { describe, expect, it } from "vitest";
import type { Message } from "@/components/chat";
import { buildRegeneratePlan } from "../ChatPlaygroundShell";

const message = (
	id: string,
	role: Message["role"],
	content: string,
): Message => ({ id, role, content, timestamp: 1 });

describe("buildRegeneratePlan", () => {
	it("removes the latest shared user turn from both model histories", () => {
		const firstUser = message("user-1", "user", "First question");
		const retryUser = message("user-2", "user", "Retry this question");
		const primary = [
			firstUser,
			message("assistant-1", "assistant", "First primary answer"),
			retryUser,
			message("assistant-2", "assistant", "Primary answer to replace"),
		];
		const compare = [
			firstUser,
			message("compare-1", "assistant", "First comparison answer"),
			retryUser,
			message("compare-2", "assistant", "Comparison answer to replace"),
		];

		expect(buildRegeneratePlan(primary, compare)).toEqual({
			prompt: "Retry this question",
			primaryMessages: primary.slice(0, 2),
			compareMessages: compare.slice(0, 2),
		});
	});

	it("retries the latest user turn even when its assistant request failed", () => {
		const failedUser = message("user-failed", "user", "Try after failure");
		const primary = [
			message("user-1", "user", "Earlier"),
			message("assistant-1", "assistant", "Earlier answer"),
			failedUser,
		];
		const compare = [
			message("user-1", "user", "Earlier"),
			message("compare-1", "assistant", "Earlier compare answer"),
			failedUser,
		];

		expect(buildRegeneratePlan(primary, compare)).toEqual({
			prompt: "Try after failure",
			primaryMessages: primary.slice(0, 2),
			compareMessages: compare.slice(0, 2),
		});
	});
});
