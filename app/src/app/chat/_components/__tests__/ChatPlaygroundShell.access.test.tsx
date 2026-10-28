import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChatPlaygroundShell } from "../ChatPlaygroundShell";
import { Navbar } from "@/components/navbar";
import type { BalanceResponse } from "@/lib/api";
import {
	conversationHistoryStorageKey,
	conversationStorageKey,
} from "@/lib/chat-storage";

const fixtures = vi.hoisted(() => ({
	auth: { isAuthenticated: false, isReady: true, isDemo: false, user: null as { id: string } | null },
	searchParams: new URLSearchParams("model=claude-opus-5"),
	router: { replace: vi.fn() },
	fetch: vi.fn(),
	balance: null as BalanceResponse | null,
	toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
	exportChatHistory: vi.fn(),
	models: [
		{ id: "claude-opus-5", display_name: "Claude Opus 5", provider: "Venice", category: "frontier", context_length: 1000000, available: true, pricing: { prompt: "7.5", completion: "37.5" } },
		{ id: "minimax-m2-7", display_name: "MiniMax M2.7", provider: "OMA-AI", category: "budget", context_length: 200000, available: true, pricing: { prompt: "0.1", completion: "0.2" } },
	],
}));
vi.mock("next/navigation", () => ({
	useSearchParams: () => fixtures.searchParams,
	usePathname: () => "/chat",
	useRouter: () => fixtures.router,
}));
vi.mock("next/dynamic", async () => {
	const { lazy } = await import("react");
	return { default: (load: () => Promise<React.ComponentType>) => lazy(async () => ({ default: await load() })) };
});
vi.mock("@/components/ThemeToggle", () => ({ ThemeToggle: () => null }));
vi.mock("@/lib/hooks/useAuth", () => ({ useAuth: () => fixtures.auth }));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => fixtures.toast }));
vi.mock("@/lib/chat-export", async (original) => ({
	...await original<typeof import("@/lib/chat-export")>(),
	exportChatHistory: fixtures.exportChatHistory,
}));
vi.mock("@/components/chat/useBalance", async (original) => ({
	...await original<typeof import("@/components/chat/useBalance")>(),
	useBalance: () => ({ balance: fixtures.balance, loading: false, refresh: async () => {} }),
}));
vi.mock("@/lib/api", () => ({
	api: { models: { list: async () => ({ data: fixtures.models }) }, auth: { listKeys: async () => { throw new Error("Unauthorized"); } } },
}));

beforeEach(() => {
	localStorage.clear();
	sessionStorage.clear();
	fixtures.balance = null;
	fixtures.auth.user = null;
	fixtures.auth.isAuthenticated = false;
	fixtures.auth.isReady = true;
	fixtures.auth.isDemo = false;
	fixtures.searchParams = new URLSearchParams("model=claude-opus-5");
	fixtures.fetch.mockReset();
	fixtures.exportChatHistory.mockReset();
	fixtures.fetch.mockImplementation(async (url: string) => url.includes("usage/today")
		? new Response(JSON.stringify({ remaining: 19, limit: 20 }), { status: 200 })
		: new Response(JSON.stringify({ error: { message: "Authentication required" } }), { status: 401 }));
	vi.stubGlobal("fetch", fixtures.fetch);
	HTMLElement.prototype.scrollIntoView = vi.fn();
});

afterEach(() => { vi.restoreAllMocks(); });

function renderChat(withNavbar = false) {
	return render(<>{withNavbar && <Navbar />}<ChatPlaygroundShell /></>);
}

function clickSignIn(link: HTMLElement) {
	// Keep jsdom on this document; the explicit unmount below models navigation.
	link.addEventListener("click", (event) => event.preventDefault(), { once: true });
	fireEvent.click(link);
	expect(sessionStorage.getItem("oma_chat_signin_draft")).not.toBeNull();
}

describe("guest chat model access", () => {
	it("removes account A's comparison transcript before account B can display or send it", async () => {
		fixtures.auth.isAuthenticated = true;
		fixtures.auth.user = { id: "user-a" };
		fixtures.searchParams = new URLSearchParams("model=minimax-m2-7");
		fixtures.fetch.mockImplementation(async () => new Response('data: {"choices":[{"delta":{"content":"Synthetic comparison reply"}}]}\n\ndata: [DONE]\n\n', { headers: { "Content-Type": "text/event-stream" } }));
		const view = renderChat();
		const composer = await screen.findByRole("textbox", { name: "Enter your message" });
		await waitFor(() => expect(composer).toBeEnabled());
		fireEvent.click(screen.getByRole("button", { name: /more chat actions/i }));
		fireEvent.click(screen.getByRole("menuitem", { name: "Compare models" }));
		const compare = await screen.findByRole("complementary", { name: "Model comparison panel" });
		fireEvent.change(within(compare).getByPlaceholderText("Type to compare..."), { target: { value: "A private comparison prompt" } });
		fireEvent.click(within(compare).getByRole("button", { name: "SEND TO BOTH" }));
		await waitFor(() => expect(within(compare).getByRole("button", { name: "SEND TO BOTH" })).toBeEnabled());
		expect(within(compare).getByText("A private comparison prompt", { selector: "p" })).toBeInTheDocument();
		const sentByA = fixtures.fetch.mock.calls.filter(([url]) => String(url).includes("chat/completions")).length;
		fixtures.auth.user = { id: "user-b" };
		await act(async () => { view.rerender(<ChatPlaygroundShell />); });
		await waitFor(() => expect(screen.getByRole("textbox", { name: "Enter your message" })).toBeEnabled());
		expect(screen.queryAllByText("A private comparison prompt")).toHaveLength(0);
		fireEvent.click(screen.getByRole("button", { name: /more chat actions/i }));
		fireEvent.click(screen.getByRole("menuitem", { name: "Compare models" }));
		const freshCompare = await screen.findByRole("complementary", { name: "Model comparison panel" });
		fireEvent.change(within(freshCompare).getByPlaceholderText("Type to compare..."), { target: { value: "B independent prompt" } });
		fireEvent.click(within(freshCompare).getByRole("button", { name: "SEND TO BOTH" }));
		await waitFor(() => expect(fixtures.fetch.mock.calls.filter(([url]) => String(url).includes("chat/completions"))).toHaveLength(sentByA + 2));
		for (const [, options] of fixtures.fetch.mock.calls.filter(([url]) => String(url).includes("chat/completions")).slice(sentByA)) {
			expect(JSON.parse(options.body).messages).toEqual([{ role: "user", content: "B independent prompt" }]);
		}
	});

	it("migrates the legacy chat into searchable history and keeps it when starting a new chat", async () => {
		localStorage.setItem(
			conversationStorageKey(null),
			JSON.stringify([
				{ role: "user", content: "Legacy sparse attention question", timestamp: 1 },
			]),
		);
		renderChat();
		// The first render cold-loads the chat workspace inside Suspense.
		await waitFor(() =>
			expect(screen.getByRole("textbox", { name: "Enter your message" })).toBeEnabled(),
			{ timeout: 10_000 },
		);

		const historyToggle = screen.getByRole("button", { name: "Conversation history" });
		fireEvent.click(historyToggle);
		// The history panel is lazy-loaded; allow a cold import under the full worker pool.
		const history = await screen.findByRole("dialog", { name: "Conversation history" }, { timeout: 10_000 });
		expect(within(history).getByText("Legacy sparse attention question")).toBeVisible();

		fireEvent.click(within(history).getByRole("button", { name: "New chat" }));
		expect(within(history).getByText("Legacy sparse attention question")).toBeVisible();
		expect(within(history).getByRole("button", { name: "Open New chat" })).toBeVisible();
	});

	it("uses the active history thread id when exporting the open conversation", async () => {
		const messages = [
			{ role: "user" as const, content: "Export this thread", timestamp: 1 },
		];
		localStorage.setItem(
			conversationHistoryStorageKey(null),
			JSON.stringify({
				version: 1,
				activeThreadId: "active-thread-id",
				threads: [{
					id: "active-thread-id",
					title: "Export this thread",
					createdAt: 1,
					updatedAt: 1,
					pinned: false,
					customTitle: false,
					messages,
					draft: "",
					model: "minimax-m2-7",
				}],
			}),
		);
		fixtures.searchParams = new URLSearchParams("model=minimax-m2-7");
		renderChat();
		await screen.findByText("Export this thread");

		fireEvent.click(screen.getByRole("button", { name: /more chat actions/i }));
		fireEvent.click(screen.getByRole("menuitem", { name: "Export JSON" }));

		expect(fixtures.exportChatHistory).toHaveBeenCalledWith(
			messages,
			"json",
			"active-thread-id",
		);
	});

	it("focuses the mobile history drawer, closes it with Escape, and restores focus", async () => {
		vi.spyOn(window, "matchMedia").mockImplementation((query: string) => ({
			matches: query.includes("max-width"),
			media: query,
			onchange: null,
			addListener: vi.fn(),
			removeListener: vi.fn(),
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			dispatchEvent: vi.fn(),
		}));
		renderChat();
		const historyToggle = await screen.findByRole("button", { name: "Conversation history" });
		historyToggle.focus();
		fireEvent.click(historyToggle);
		const dialog = await screen.findByRole("dialog", { name: "Conversation history" });
		await waitFor(() =>
			expect(within(dialog).getByRole("searchbox", { name: "Search chats" })).toHaveFocus(),
		);

		fireEvent.keyDown(document, { key: "Escape" });

		await waitFor(() =>
			expect(screen.queryByRole("dialog", { name: "Conversation history" })).not.toBeInTheDocument(),
		);
		expect(historyToggle).toHaveFocus();
	});

	it("keeps a paid selection and draft while requesting sign-in before a network send", async () => {
		renderChat();
		const composer = await screen.findByRole("textbox", { name: "Enter your message" });
		fireEvent.change(composer, { target: { value: "Keep this draft" } });
		fireEvent.click(screen.getByRole("button", { name: "Send message" }));
		const dialog = await screen.findByRole("dialog", { name: "Sign in to access this model" });
		expect(composer).toHaveValue("Keep this draft");
		expect(within(dialog).getByRole("link", { name: /sign in/i })).toHaveAttribute("href", "/login?next=%2Fchat%3Fmodel%3Dclaude-opus-5");
		expect(fixtures.fetch.mock.calls.some(([url]) => String(url).includes("chat/completions"))).toBe(false);
		fireEvent.keyDown(document, { key: "Escape" });
		await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
		expect(composer).toHaveValue("Keep this draft");
		expect(screen.getByRole("button", { name: /select ai model/i })).toHaveTextContent("Claude Opus 5");
	});

	it("offers an explicit free choice without losing the drafted prompt", async () => {
		renderChat();
		const composer = await screen.findByRole("textbox", { name: "Enter your message" });
		fireEvent.change(composer, { target: { value: "Keep me when switching" } });
		fireEvent.click(await screen.findByRole("button", { name: /try .* free/i }));
		expect(composer).toHaveValue("Keep me when switching");
		await waitFor(() => expect(screen.getByRole("button", { name: /select ai model/i })).toHaveTextContent(/MiniMax/));
		expect(screen.getByText("19 free left")).toBeInTheDocument();
		expect(screen.getByText("Free chat")).toBeInTheDocument();
	});
	it("waits for authentication to resolve before allowing a send", async () => {
		fixtures.auth.isReady = false;
		renderChat();
		const composer = await screen.findByRole("textbox", { name: "Enter your message" });
		fireEvent.change(composer, { target: { value: "Wait for auth" } });
		expect(screen.getByRole("button", { name: "Send message" })).toBeDisabled();
		fireEvent.keyDown(composer, { key: "Enter" });
		expect(fixtures.fetch.mock.calls.some(([url]) => String(url).includes("chat/completions"))).toBe(false);
		expect(composer).toHaveValue("Wait for auth");
	});

	it("still sends a selected free model after preflight", async () => {
		fixtures.searchParams = new URLSearchParams("model=minimax-m2-7");
		renderChat();
		const composer = await screen.findByRole("textbox", { name: "Enter your message" });
		fireEvent.change(composer, { target: { value: "An allowed free request" } });
		fireEvent.click(screen.getByRole("button", { name: "Send message" }));
		await waitFor(() => {
			const request = fixtures.fetch.mock.calls.find(([url]) => String(url).includes("chat/completions"));
			expect(request).toBeDefined();
			expect(JSON.parse(request?.[1].body).model).toBe("minimax-m2-7");
		});
		expect(screen.queryByRole("dialog", { name: "Sign in to access this model" })).not.toBeInTheDocument();
	});

	it("keeps the low-credit warning while sending a paid request with $0.50 remaining", async () => {
		fixtures.auth.isAuthenticated = true;
		fixtures.auth.user = { id: "user-a" };
		fixtures.balance = { balanceCents: "50", totalDepositedCents: "50", totalUsedCents: "0", lastActivityAt: null };
		fixtures.fetch.mockResolvedValue(new Response(
			'data: {"choices":[{"delta":{"content":"A paid response."}}]}\n\ndata: [DONE]\n\n',
			{ status: 200, headers: { "Content-Type": "text/event-stream" } },
		));
		renderChat();
		const composer = await screen.findByRole("textbox", { name: "Enter your message" });
		await waitFor(() => expect(composer).toBeEnabled());
		expect(screen.getAllByText("Low credits — $0.50").length).toBeGreaterThan(0);
		const send = screen.getByRole("button", { name: "Send message" });
		await waitFor(() => expect(send).not.toHaveAttribute("title", "Restoring your chats…"));
		fireEvent.change(composer, { target: { value: "Use my remaining credits" } });
		await waitFor(() => expect(send).toBeEnabled());
		fireEvent.click(send);
		await waitFor(() => {
			const request = fixtures.fetch.mock.calls.find(([url]) => String(url).includes("chat/completions"));
			expect(request).toBeDefined();
			expect(JSON.parse(request?.[1].body)).toMatchObject({ model: "claude-opus-5", messages: expect.arrayContaining([
				{ role: "user", content: "Use my remaining credits" },
			]) });
		});
	});

	it("lets the backend reject an unaffordable paid request at zero credits", async () => {
		fixtures.auth.isAuthenticated = true;
		fixtures.auth.user = { id: "user-a" };
		fixtures.balance = { balanceCents: "0", totalDepositedCents: "0", totalUsedCents: "0", lastActivityAt: null };
		fixtures.fetch.mockResolvedValue(Response.json(
			{ error: { code: "insufficient_credits", message: "Insufficient credits for this request" } },
			{ status: 402 },
		));
		renderChat();
		const composer = await screen.findByRole("textbox", { name: "Enter your message" });
		const send = screen.getByRole("button", { name: "Send message" });
		await waitFor(() => expect(send).not.toHaveAttribute("title", "Restoring your chats…"));
		fireEvent.change(composer, { target: { value: "Ask the backend to check this request" } });
		await waitFor(() => expect(send).toBeEnabled());
		fireEvent.click(send);
		const alert = await screen.findByRole("alert");
		expect(alert).toHaveTextContent("LOW CREDITS");
		expect(within(alert).getByRole("link", { name: "Top Up Credits" })).toHaveAttribute("href", "/deposit");
		expect(fixtures.fetch.mock.calls.filter(([url]) => String(url).includes("chat/completions"))).toHaveLength(1);
	});

	it("shows free website billing for a signed-in session too", async () => {
		fixtures.auth.isAuthenticated = true;
		fixtures.auth.user = { id: "user-a" };
		fixtures.searchParams = new URLSearchParams("model=minimax-m2-7");
		renderChat();
		expect(await screen.findByText("Free chat")).toBeInTheDocument();
		expect(screen.queryByText(/free left/i)).not.toBeInTheDocument();
	});

	it.each(["modal", "empty", "footer", "navbar", "mobile navbar"])("restores the draft once after %s sign-in navigation", async (entry) => {
		const first = renderChat(entry.includes("navbar"));
		const composer = await screen.findByRole("textbox", { name: "Enter your message" });
		fireEvent.change(composer, { target: { value: "A draft worth keeping" } });
		expect(sessionStorage.getItem("oma_chat_signin_draft")).toBeNull();
		let link: HTMLElement;
		if (entry === "modal") {
			fireEvent.click(screen.getByRole("button", { name: "Send message" }));
			link = within(await screen.findByRole("dialog", { name: "Sign in to access this model" })).getByRole("link", { name: /sign in/i });
		} else if (entry === "mobile navbar") {
			fireEvent.click(screen.getByRole("button", { name: "Open navigation menu" }));
			link = within(await screen.findByRole("dialog", { name: "Navigation" })).getByRole("link", { name: "Sign in" });
		} else {
			link = screen.getByRole("link", { name: entry === "empty" ? "Sign in to use this model" : entry === "footer" ? "Sign in to use Claude Opus 5" : "Sign in or create an account" });
		}
		clickSignIn(link);
		first.unmount();
		fixtures.auth.isAuthenticated = true;
		fixtures.auth.user = { id: "user-a" };
		const returned = renderChat();
		await waitFor(() => expect(screen.getByRole("textbox", { name: "Enter your message" })).toHaveValue("A draft worth keeping"));
		expect(sessionStorage.getItem("oma_chat_signin_draft")).toBeNull();
		returned.unmount();
		fixtures.auth.isAuthenticated = false;
		fixtures.auth.user = null;
		renderChat();
		expect(await screen.findByRole("textbox", { name: "Enter your message" })).toHaveValue("");
	});

	it.each(["expired", "different model"])("discards a %s sign-in draft instead of resurfacing it later", async (reason) => {
		const first = renderChat();
		fireEvent.change(await screen.findByRole("textbox", { name: "Enter your message" }), { target: { value: "Discard this handoff" } });
		clickSignIn(screen.getByRole("link", { name: "Sign in to use this model" }));
		first.unmount();
		if (reason === "expired") vi.spyOn(Date, "now").mockReturnValue(Date.now() + 16 * 60_000);
		else fixtures.searchParams = new URLSearchParams("model=minimax-m2-7");
		fixtures.auth.isAuthenticated = true;
		fixtures.auth.user = { id: "user-a" };
		renderChat();
		expect(await screen.findByRole("textbox", { name: "Enter your message" })).toHaveValue("");
		expect(sessionStorage.getItem("oma_chat_signin_draft")).toBeNull();
	});

	it.each(["sign-out", "account change"])("clears a restored handoff on %s without a page unmount", async (transition) => {
		const first = renderChat();
		fireEvent.change(await screen.findByRole("textbox", { name: "Enter your message" }), { target: { value: "Only for the receiving account" } });
		clickSignIn(screen.getByRole("link", { name: "Sign in to use this model" }));
		first.unmount();
		fixtures.auth.isAuthenticated = true;
		fixtures.auth.user = { id: "user-a" };
		const returned = renderChat();
		await waitFor(() => expect(screen.getByRole("textbox", { name: "Enter your message" })).toHaveValue("Only for the receiving account"));
		const restoredComposer = screen.getByRole("textbox", { name: "Enter your message" });
		fixtures.auth.user = transition === "sign-out" ? null : { id: "user-b" };
		fixtures.auth.isAuthenticated = transition !== "sign-out";
		returned.rerender(<>{false}<ChatPlaygroundShell /></>);
		await waitFor(() => expect(restoredComposer).toHaveValue(""));
		expect(screen.getByRole("textbox", { name: "Enter your message" })).toBe(restoredComposer);
	});

	it("adopts the first signed-in identity after an auth-timeout guest restoration", async () => {
		const first = renderChat();
		fireEvent.change(await screen.findByRole("textbox", { name: "Enter your message" }), { target: { value: "Keep through late session resolution" } });
		clickSignIn(screen.getByRole("link", { name: "Sign in to use this model" }));
		first.unmount();
		// useAuth can become ready while the session request is still pending.
		const returned = renderChat();
		const composer = await screen.findByRole("textbox", { name: "Enter your message" });
		await waitFor(() => expect(composer).toHaveValue("Keep through late session resolution"));
		fixtures.auth.isAuthenticated = true;
		fixtures.auth.user = { id: "user-a" };
		returned.rerender(<>{false}<ChatPlaygroundShell /></>);
		expect(screen.getByRole("textbox", { name: "Enter your message" })).toBe(composer);
		expect(composer).toHaveValue("Keep through late session resolution");
	});

	it("keeps a remembered model in navbar sign-in links from a bare chat URL", async () => {
		fixtures.searchParams = new URLSearchParams();
		localStorage.setItem("oma_chat_model:guest", "claude-opus-5");
		const first = renderChat(true);
		const composer = await screen.findByRole("textbox", { name: "Enter your message" });
		await waitFor(() => expect(screen.getByRole("button", { name: /select ai model/i })).toHaveTextContent("Claude Opus 5"));
		fireEvent.change(composer, { target: { value: "Remember my model too" } });
		const link = screen.getByRole("link", { name: "Sign in or create an account" });
		expect(link).toHaveAttribute("href", "/login?next=%2Fchat%3Fmodel%3Dclaude-opus-5");
		clickSignIn(link);
		const destination = new URL(link.getAttribute("href")!, "https://oma.invalid").searchParams.get("next")!;
		first.unmount();
		fixtures.auth.isAuthenticated = true;
		fixtures.auth.user = { id: "user-a" };
		fixtures.searchParams = new URL(destination, "https://oma.invalid").searchParams;
		renderChat();
		await waitFor(() => expect(screen.getByRole("textbox", { name: "Enter your message" })).toHaveValue("Remember my model too"));
	});

	it("waits for a remembered model to hydrate before consuming a returned draft", async () => {
		const first = renderChat();
		fireEvent.change(await screen.findByRole("textbox", { name: "Enter your message" }), { target: { value: "Restore after the model hydrates" } });
		clickSignIn(screen.getByRole("link", { name: "Sign in to use this model" }));
		first.unmount();
		fixtures.searchParams = new URLSearchParams();
		localStorage.setItem("oma_chat_model:guest", "claude-opus-5");
		renderChat();
		await waitFor(() => expect(screen.getByRole("textbox", { name: "Enter your message" })).toHaveValue("Restore after the model hydrates"));
	});

});
