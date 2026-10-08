import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ConversationThread } from "@/lib/chat-storage";
import { ConversationHistory } from "../ConversationHistory";

const threads: ConversationThread[] = [
	{
		id: "one",
		title: "Sparse attention",
		createdAt: 1,
		updatedAt: 10,
		pinned: true,
		customTitle: false,
		messages: [{ role: "user", content: "Explain transformers", timestamp: 1 }],
		draft: "",
		model: "model-a",
	},
	{
		id: "two",
		title: "Pricing notes",
		createdAt: 2,
		updatedAt: 20,
		pinned: false,
		customTitle: true,
		messages: [{ role: "user", content: "Compare inference costs", timestamp: 2 }],
		draft: "unfinished",
		model: "model-b",
	},
];

function renderHistory(overrides: Partial<React.ComponentProps<typeof ConversationHistory>> = {}) {
	const props: React.ComponentProps<typeof ConversationHistory> = {
		threads,
		activeThreadId: "one",
		disabled: false,
		persistenceStatus: "saved",
		persistenceError: null,
		onNew: vi.fn(),
		onSelect: vi.fn(),
		onRename: vi.fn(),
		onTogglePinned: vi.fn(),
		onDelete: vi.fn(),
		onExport: vi.fn(),
		...overrides,
	};
	return { ...render(<ConversationHistory {...props} />), props };
}

describe("ConversationHistory", () => {
	it("explains device-only storage and searches message content", () => {
		renderHistory();
		expect(screen.getByText(/saved only in this browser on this device/i)).toBeVisible();

		fireEvent.change(screen.getByRole("searchbox", { name: /search chats/i }), {
			target: { value: "inference" },
		});

		expect(screen.getByText("Pricing notes")).toBeVisible();
		expect(screen.queryByText("Sparse attention")).not.toBeInTheDocument();
	});

	it("supports selecting, renaming, pinning, exporting, and deleting a thread", () => {
		const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
		const { props } = renderHistory();

		fireEvent.click(screen.getByRole("button", { name: /open pricing notes/i }));
		expect(props.onSelect).toHaveBeenCalledWith("two");

		fireEvent.click(screen.getByRole("button", { name: /rename pricing notes/i }));
		const editor = screen.getByRole("textbox", { name: /rename conversation/i });
		fireEvent.change(editor, { target: { value: "Cost comparison" } });
		fireEvent.keyDown(editor, { key: "Enter" });
		expect(props.onRename).toHaveBeenCalledWith("two", "Cost comparison");

		fireEvent.click(screen.getByRole("button", { name: /pin pricing notes/i }));
		expect(props.onTogglePinned).toHaveBeenCalledWith("two");
		fireEvent.click(screen.getByRole("button", { name: /export pricing notes/i }));
		expect(props.onExport).toHaveBeenCalledWith("two");
		fireEvent.click(screen.getByRole("button", { name: /delete pricing notes/i }));
		expect(confirm).toHaveBeenCalled();
		expect(props.onDelete).toHaveBeenCalledWith("two");
	});

	it("disables every mutation and switch while a response is streaming", () => {
		const { props } = renderHistory({ disabled: true });

		expect(screen.getByRole("button", { name: /new chat/i })).toBeDisabled();
		expect(screen.getByRole("button", { name: /open pricing notes/i })).toBeDisabled();
		expect(screen.getByRole("button", { name: /rename pricing notes/i })).toBeDisabled();
		expect(screen.getByRole("button", { name: /pin pricing notes/i })).toBeDisabled();
		expect(screen.getByRole("button", { name: /delete pricing notes/i })).toBeDisabled();
		expect(props.onSelect).not.toHaveBeenCalled();
	});

	it("shows a persistence error with an export instruction", () => {
		renderHistory({
			persistenceStatus: "error",
			persistenceError:
				"Could not save on this device. Export this conversation before closing the page.",
		});

		expect(screen.getByRole("alert")).toHaveTextContent(/could not save/i);
		expect(screen.getByRole("alert")).toHaveTextContent(/export/i);
	});
});
