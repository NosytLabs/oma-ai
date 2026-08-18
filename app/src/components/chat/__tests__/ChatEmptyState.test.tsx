import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChatEmptyState } from "../ChatEmptyState";

describe("ChatEmptyState", () => {
	it("renders all four generic presets when no currentModel is provided", () => {
		render(<ChatEmptyState onPreset={() => {}} />);
		expect(screen.getByText("Explain code")).toBeInTheDocument();
		expect(screen.getByText("Fix a bug")).toBeInTheDocument();
		expect(screen.getByText("Summarize text")).toBeInTheDocument();
		expect(screen.getByText("Write SQL")).toBeInTheDocument();
	});

	it("filters presets by currentModel hints when a model id is provided", () => {
		render(
			<ChatEmptyState
				onPreset={() => {}}
				currentModel="claude-sonnet-4-20250514"
			/>,
		);
		// claude-sonnet-4 matches the "claude" hint for "Explain code".
		expect(screen.getByText("Explain code")).toBeInTheDocument();
		// Other Claude-friendly presets stay (Fix a bug has gpt/openai/codex hints,
		// so it's filtered out).
		expect(screen.queryByText("Fix a bug")).toBeNull();
		// "Write SQL" has no hints, so it always shows.
		expect(screen.getByText("Write SQL")).toBeInTheDocument();
	});

	it("falls back to all presets when no preset matches the current model", () => {
		render(
			<ChatEmptyState
				onPreset={() => {}}
				currentModel="zzzz-no-match-model"
			/>,
		);
		// No hint matches "zzzz-no-match-model", and "Write SQL" is universal,
		// so the filter would return an empty array — the fallback kicks in
		// and shows every preset so the grid never looks broken.
		expect(screen.getByText("Explain code")).toBeInTheDocument();
		expect(screen.getByText("Fix a bug")).toBeInTheDocument();
		expect(screen.getByText("Summarize text")).toBeInTheDocument();
		expect(screen.getByText("Write SQL")).toBeInTheDocument();
	});

	it("keeps only matched + universal presets when the model has partial hints", () => {
		render(
			<ChatEmptyState
				onPreset={() => {}}
				currentModel="some-gpt-4-turbo"
			/>,
		);
		// "Fix a bug" matches (gpt), "Write SQL" is universal. The other
		// three (Explain code / Summarize text) drop out.
		expect(screen.getByText("Fix a bug")).toBeInTheDocument();
		expect(screen.getByText("Write SQL")).toBeInTheDocument();
		expect(screen.queryByText("Explain code")).toBeNull();
		expect(screen.queryByText("Summarize text")).toBeNull();
	});

	it("passes the preset prompt to onPreset when a card is clicked", () => {
		const onPreset = vi.fn();
		render(<ChatEmptyState onPreset={onPreset} />);
		fireEvent.click(screen.getByText("Explain code"));
		expect(onPreset).toHaveBeenCalledTimes(1);
		expect(onPreset.mock.calls[0]?.[0]).toMatch(/merge_sort/);
	});

	it("hides guest quota copy when signed in", () => {
		render(<ChatEmptyState onPreset={() => {}} signedIn />);
		expect(screen.queryByText(/Guest chats are free/i)).toBeNull();
		expect(screen.queryByText(/20 requests\/day/i)).toBeNull();
		expect(screen.getByText("Pick a starter, or type below.")).toBeInTheDocument();
	});
});
