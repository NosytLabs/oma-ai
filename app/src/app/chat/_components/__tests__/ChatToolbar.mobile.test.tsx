/**
 * Ensures the playground toolbar does not double-mount WEB / COMPARE
 * (skeptic: mobile had primary strip + sm:hidden strip both rendering WEB).
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
	model: "minimax-m2.7",
	setModel: vi.fn(),
	paramsOpen: false,
	setParamsOpen: vi.fn(),
	webSearchEnabled: false,
	setWebSearchEnabled: vi.fn(),
	mediaMode: "text" as const,
	setMediaMode: vi.fn(),
	searching: false,
	isAuthenticated: false,
	balance: null,
	balanceDollars: 0,
	isLowBalance: false,
	compareMode: false,
	setCompareMode: vi.fn(),
	shareStatus: "default" as const,
	shareConversation: vi.fn(),
	exportStatus: "default" as const,
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

	it("renders exactly one web-search toggle and one compare control", () => {
		render(<ChatToolbar {...baseProps} />);

		const web = screen.getAllByRole("button", { name: /toggle web search/i });
		expect(web).toHaveLength(1);

		const compare = screen.getAllByRole("button", {
			name: /compare models/i,
		});
		expect(compare).toHaveLength(1);
	});

	it("keeps mode tabs for chat/image/video", () => {
		render(<ChatToolbar {...baseProps} />);
		const tabs = screen.getAllByRole("tab");
		expect(tabs.length).toBe(3);
	});
});
