import { renderHook, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSystemPromptPersistence } from "../useSystemPromptPersistence";

function useHarness(systemPromptKey: string) {
	const [systemPrompt, setSystemPrompt] = useState("");
	const [systemPromptOpen, setSystemPromptOpen] = useState(false);
	useSystemPromptPersistence({
		systemPrompt,
		setSystemPrompt,
		setSystemPromptOpen,
		systemPromptKey,
	});
	return {
		systemPrompt,
		setSystemPrompt,
		systemPromptOpen,
	};
}

describe("useSystemPromptPersistence responsibilities", () => {
	beforeEach(() => localStorage.clear());
	afterEach(() => localStorage.clear());

	it("hydrates the next identity before allowing prompt writes to its key", async () => {
		localStorage.setItem("prompt:alice", "Alice instructions");
		localStorage.setItem("prompt:bob", "Bob instructions");
		const { result, rerender } = renderHook(
			({ promptKey }) => useHarness(promptKey),
			{ initialProps: { promptKey: "prompt:alice" } },
		);
		await waitFor(() =>
			expect(result.current.systemPrompt).toBe("Alice instructions"),
		);

		rerender({ promptKey: "prompt:bob" });
		await waitFor(() =>
			expect(result.current.systemPrompt).toBe("Bob instructions"),
		);

		expect(localStorage.getItem("prompt:bob")).toBe("Bob instructions");
	});

	it("clears the visible prompt when a readable identity bucket has none", async () => {
		localStorage.setItem("prompt:alice", "Alice instructions");
		const { result, rerender } = renderHook(
			({ promptKey }) => useHarness(promptKey),
			{ initialProps: { promptKey: "prompt:alice" } },
		);
		await waitFor(() =>
			expect(result.current.systemPrompt).toBe("Alice instructions"),
		);

		rerender({ promptKey: "prompt:bob" });

		await waitFor(() => expect(result.current.systemPrompt).toBe(""));
		expect(result.current.systemPromptOpen).toBe(false);
	});

	it("clears a previous identity prompt when the next bucket cannot be read", async () => {
		localStorage.setItem("prompt:alice", "Alice instructions");
		const originalGetItem = Storage.prototype.getItem;
		const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(function (this: Storage, key: string) {
			if (key === "prompt:bob") throw new DOMException("blocked", "SecurityError");
			return originalGetItem.call(this, key);
		});
		const { result, rerender } = renderHook(
			({ promptKey }) => useHarness(promptKey),
			{ initialProps: { promptKey: "prompt:alice" } },
		);
		await waitFor(() =>
			expect(result.current.systemPrompt).toBe("Alice instructions"),
		);

		rerender({ promptKey: "prompt:bob" });

		await waitFor(() => expect(result.current.systemPrompt).toBe(""));
		expect(result.current.systemPromptOpen).toBe(false);
		expect(getItem).toHaveBeenCalledWith("prompt:bob");
	});
});
