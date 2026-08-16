/**
	* Ensures the playground toolbar renders exactly one COMPARE control.
	* The web-search toggle moved into the composer (MessageInputRedesign),
	* so it no longer lives in the toolbar.
	*
	* The Create / image-video tab was removed in R8 — chat surface is
	* text + multimodal LLM only.
	*/
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChatToolbar } from "../ChatToolbar";

vi.mock("next/dynamic", () => ({
	default: () => {
		const Stub = () => null;
		return Stub;
	},
}));

vi.mock("next/link", () => ({
	default: ({
		children,
		href,
		...rest
	}: {
		children: React.ReactNode;
		href: string;
	}) => (
		<a href={href} {...rest}>
			{children}
		</a>
	),
}));

const baseProps = {
	variant: "chat" as const,
	model: "gemini-3-flash-preview",
	setModel: vi.fn(),
	paramsOpen: false,
	setParamsOpen: vi.fn(),
	searching: false,
	isAuthenticated: false,
	balance: null,
	balanceDollars: 0,
	isLowBalance: false,
	compareMode: false,
	setCompareMode: vi.fn(),
	shareStatus: "default" as const,
	shareConversation: vi.fn(),
	exportConversation: vi.fn(),
	clearChat: vi.fn(),
	messagesLength: 0,
	deferredMessages: [],
	setShortcutsOpen: vi.fn(),
};

describe("ChatToolbar — single WEB / COMPARE path", () => {
	afterEach(() => {
		cleanup();
	});

	it("renders exactly one compare control (WEB toggle lives in the composer)", () => {
		render(<ChatToolbar {...baseProps} />);

		const compare = screen.getAllByRole("button", {
			name: /compare models/i,
		});
		expect(compare).toHaveLength(1);
	});

	it("does not render Create / image-video tab (text-only chat surface)", () => {
		render(<ChatToolbar {...baseProps} />);
		const create = screen.queryByRole("tab", { name: /create/i });
		expect(create).toBeNull();
	});
});
