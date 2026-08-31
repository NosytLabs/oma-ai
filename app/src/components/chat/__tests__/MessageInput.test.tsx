import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MessageInputed as MessageInput } from "../MessageInput";

const noop = () => {};

const renderInput = (
	overrides: Partial<{
		input: string;
		setInput: (v: string) => void;
		onSubmit: () => void;
		onStop: () => void;
		loading: boolean;
	}> = {},
) => {
	const setInput = overrides.setInput ?? vi.fn();
	return render(
		<MessageInput
			input={overrides.input ?? ""}
			setInput={setInput}
			onSubmit={overrides.onSubmit ?? noop}
			onStop={overrides.onStop ?? noop}
			loading={overrides.loading ?? false}
		/>,
	);
};

describe("MessageInput", () => {
	it("renders a textarea and a send button", () => {
		renderInput();
		expect(screen.getByRole("textbox")).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /send message/i }),
		).toBeInTheDocument();
	});

	it("calls setInput as the user types into the textarea", () => {
		const setInput = vi.fn();
		renderInput({ setInput });
		fireEvent.change(screen.getByRole("textbox"), {
			target: { value: "Hello" },
		});
		expect(setInput).toHaveBeenCalledWith("Hello");
	});

	it("calls onSubmit when the send button is clicked with non-empty content", () => {
		const onSubmit = vi.fn();
		renderInput({ input: "Hello", onSubmit });
		fireEvent.click(screen.getByRole("button", { name: /send message/i }));
		expect(onSubmit).toHaveBeenCalledTimes(1);
	});

	it("submits on plain Enter but inserts a newline on Shift+Enter", () => {
		const onSubmit = vi.fn();
		renderInput({ input: "Hello", onSubmit });
		const textarea = screen.getByRole("textbox");
		fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });
		expect(onSubmit).toHaveBeenCalledTimes(1);
		onSubmit.mockClear();
		fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("disables the send button when input is empty or whitespace-only", () => {
		const { rerender } = renderInput({ input: "" });
		expect(
			screen.getByRole("button", { name: /send message/i }),
		).toBeDisabled();

		rerender(
			<MessageInput
				input=" "
				setInput={noop}
				onSubmit={noop}
				onStop={noop}
				loading={false}
			/>,
		);
		expect(
			screen.getByRole("button", { name: /send message/i }),
		).toBeDisabled();
	});

	it("swaps the send button for a stop button while loading and calls onStop when clicked", () => {
		const onStop = vi.fn();
		renderInput({ loading: true, onStop });
		expect(screen.queryByRole("button", { name: /send message/i })).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: /stop generation/i }));
		expect(onStop).toHaveBeenCalledTimes(1);
	});

	it("disables the textarea while loading", () => {
		renderInput({ loading: true });
		expect(screen.getByRole("textbox")).toBeDisabled();
	});

	it("toggles web search when setWebSearchEnabled is provided", () => {
		const setWebSearchEnabled = vi.fn();
		render(
			<MessageInput
				input=""
				setInput={noop}
				onSubmit={noop}
				onStop={noop}
				loading={false}
				webSearchEnabled={false}
				setWebSearchEnabled={setWebSearchEnabled}
			/>,
		);
		const web = screen.getByRole("button", { name: /toggle web search/i });
		expect(web).toHaveAttribute("aria-pressed", "false");
		fireEvent.click(web);
		expect(setWebSearchEnabled).toHaveBeenCalledWith(true);
	});

	it("shows web search as pressed when enabled", () => {
		render(
			<MessageInput
				input=""
				setInput={noop}
				onSubmit={noop}
				onStop={noop}
				loading={false}
				webSearchEnabled
				setWebSearchEnabled={vi.fn()}
			/>,
		);
		expect(
			screen.getByRole("button", { name: /toggle web search/i }),
		).toHaveAttribute("aria-pressed", "true");
	});
});
