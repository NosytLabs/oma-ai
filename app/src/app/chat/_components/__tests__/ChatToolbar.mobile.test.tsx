/**
	* Ensures the playground toolbar renders exactly one COMPARE control.
	* The web-search toggle moved into the composer (MessageInput),
	* so it no longer lives in the toolbar.
	*
	* The Create / image-video tab was removed in R8 — chat surface is
	* text + multimodal LLM only.
	*/
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
	model: "deepseek-v4-flash-0731-openbroker",
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
	modelLinkStatus: "default" as const,
	copyModelLink: vi.fn(),
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

	it("keeps compare inside the single More menu (WEB toggle lives in the composer)", () => {
		render(<ChatToolbar {...baseProps} messagesLength={1} />);

		fireEvent.click(screen.getByRole("button", { name: /more chat actions/i }));
		const compare = screen.getAllByRole("menuitem", {
			name: /compare models/i,
		});
		expect(compare).toHaveLength(1);
	});

	it("closes the action menu with Escape and returns focus to its trigger", () => {
		render(<ChatToolbar {...baseProps} messagesLength={1} />);
		const trigger = screen.getByRole("button", { name: /more chat actions/i });
		fireEvent.click(trigger);
		fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
		expect(screen.queryByRole("menu")).not.toBeInTheDocument();
		expect(trigger).toHaveFocus();
	});

	it("prevents a new conversation from interrupting an active response", () => {
		const newConversation = vi.fn();
		render(<ChatToolbar {...baseProps} newConversation={newConversation} loading />);
		const start = screen.getByRole("button", { name: /new conversation/i });
		expect(start).toBeDisabled();
		fireEvent.click(start);
		expect(newConversation).not.toHaveBeenCalled();
	});

	it("offers model-link copying before the first message", () => {
		const copyModelLink = vi.fn();
		render(<ChatToolbar {...baseProps} copyModelLink={copyModelLink} />);

		fireEvent.click(screen.getByRole("button", { name: /more chat actions/i }));
		const copyLink = screen.getByRole("menuitem", { name: "Copy model link" });
		expect(copyLink).toBeEnabled();
		fireEvent.click(copyLink);

		expect(copyModelLink).toHaveBeenCalledTimes(1);
	});
});
