import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import { authClient } from "@/lib/auth-client";
import { connectWallet, ensureBaseChain, listWallets, signSiweMessage, subscribeWallets } from "@/lib/wallet";
import WalletSignInPanel from "../WalletSignInPanel";
import { createAuthClient } from "better-auth/react";

/**
 * Wallet sign-in has to be understandable by someone who has never used a
 * wallet. Two regressions motivated these tests:
 *
 *  1. The panel used to show only an error toast naming three wallets, which is
 *     a dead end: no install link, and no route to the extension-free magic
 *     link. Visitors with no EIP-1193 provider had no way forward.
 *  2. The copy only ever promised account creation for the magic-link path,
 *     so a wallet user reasonably concluded that connecting would NOT create an
 *     account. It does — the server provisions on SIWE verify.
 */

vi.mock("@/lib/wallet", async () => {
	const subscribe = vi.fn(() => () => {});
	return {
		connectWallet: vi.fn(),
		ensureBaseChain: vi.fn(),
		listWallets: vi.fn(() => []),
		signSiweMessage: vi.fn(),
		subscribeWallets: subscribe,
	};
});

vi.mock("@/lib/auth-client", () => ({ authClient: {
	siwe: { nonce: vi.fn(), verify: vi.fn() },
	getSession: vi.fn(),
} }));

function renderPanel(overrides: Record<string, unknown> = {}) {
	return render(
		<WalletSignInPanel
			submitting={false}
			setSubmitting={() => {}}
			onError={() => {}}
			onSuccess={() => {}}
			onUseMagicLink={() => {}}
			{...overrides}
		/>,
	);
}

const originalLocation = window.location;

describe("WalletSignInPanel", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		vi.mocked(connectWallet).mockResolvedValue({ address: "0x0000000000000000000000000000000000000001", chainId: 8453 });
		vi.mocked(ensureBaseChain).mockResolvedValue(undefined);
		vi.mocked(signSiweMessage).mockResolvedValue({ message: "signed-message", signature: "0xsignature" });
		vi.mocked(listWallets).mockReturnValue([]);
		vi.mocked(subscribeWallets).mockImplementation(listener => { listener(); return () => {}; });
		vi.mocked(authClient.siwe.nonce).mockResolvedValue({ data: { nonce: "12345678" }, error: null } as never);
		vi.mocked(authClient.siwe.verify).mockResolvedValue({ data: { success: true, user: { id: "wallet-user", walletAddress: "0x0000000000000000000000000000000000000001", chainId: 8453 } }, error: null } as never);
		vi.mocked(authClient.getSession).mockResolvedValue({ data: null, error: null });
	});
	afterEach(() => {
		cleanup();
		vi.useRealTimers();
		Object.defineProperty(window, "location", { value: originalLocation, configurable: true, writable: true });
	});

	it("tells a wallet user that connecting creates their account", () => {
		renderPanel();
		expect(
			screen.getByText(/creates an account linked to your wallet/i),
		).toBeTruthy();
	});

	it("offers install links and a magic-link fallback when no wallet is present", () => {
		renderPanel();
		for (const name of ["MetaMask", "Rabby", "Coinbase Wallet"]) {
			expect(screen.getByRole("link", { name })).toBeTruthy();
		}
		expect(
			screen.getByRole("button", { name: /use magic link instead/i }),
		).toBeTruthy();
	});

	it("calls onUseMagicLink so the visitor is not stranded", () => {
		const onUseMagicLink = vi.fn();
		renderPanel({ onUseMagicLink });
		fireEvent.click(screen.getByRole("button", { name: /use magic link instead/i }));
		expect(onUseMagicLink).toHaveBeenCalledOnce();
	});

	it.each(["connect", "nonce", "signature", "verify", "session"] as const)("ignores a pending %s result after leaving the wallet method", async stage => {
		let finish!: (value: never) => void;
		const pending = new Promise<never>(resolve => { finish = resolve; });
		if (stage === "connect") vi.mocked(connectWallet).mockReturnValueOnce(pending);
		if (stage === "nonce") vi.mocked(authClient.siwe.nonce).mockReturnValueOnce(pending);
		if (stage === "signature") vi.mocked(signSiweMessage).mockReturnValueOnce(pending);
		if (stage === "verify") vi.mocked(authClient.siwe.verify).mockReturnValueOnce(pending);
		if (stage === "session") vi.mocked(authClient.getSession).mockReturnValueOnce(pending);
		const assign = vi.fn();
		Object.defineProperty(window, "location", { value: { ...originalLocation, protocol: "http:", host: "localhost:3000", origin: "http://localhost:3000", search: "", assign }, configurable: true });
		const onError = vi.fn(); const onSuccess = vi.fn(); const setSubmitting = vi.fn();
		const view = renderPanel({ onError, onSuccess, setSubmitting });
		await act(async () => fireEvent.click(screen.getByRole("button", { name: /connect wallet/i })));
		view.unmount();
		expect(setSubmitting).toHaveBeenLastCalledWith(false);
		if (stage === "nonce") expect(vi.mocked(authClient.siwe.nonce).mock.calls[0][1]?.signal?.aborted).toBe(true);
		if (stage === "verify") expect(vi.mocked(authClient.siwe.verify).mock.calls[0][1]?.signal?.aborted).toBe(true);
		setSubmitting.mockClear();
		await act(async () => {
			finish((stage === "connect" ? { address: "0x0000000000000000000000000000000000000001", chainId: 8453 }
				: stage === "nonce" ? { data: { nonce: "12345678" }, error: null }
					: stage === "signature" ? { message: "old-message", signature: "old-signature" }
						: stage === "verify" ? { data: { success: true, user: { id: "wallet-user" } }, error: null }
							: { data: { user: { id: "wallet-user" } }, error: null }) as never);
		});
		expect(onError).not.toHaveBeenCalled();
		expect(onSuccess).not.toHaveBeenCalled();
		expect(setSubmitting).not.toHaveBeenCalled();
		expect(assign).not.toHaveBeenCalled();
		if (stage === "connect") expect(ensureBaseChain).not.toHaveBeenCalled();
		if (stage === "nonce") expect(signSiweMessage).not.toHaveBeenCalled();
		if (stage === "signature") expect(authClient.siwe.verify).not.toHaveBeenCalled();
		if (stage === "verify") expect(authClient.getSession).not.toHaveBeenCalled();
	});

	it("aborts session confirmation and cancels its retry timer when leaving the wallet method", async () => {
		vi.useFakeTimers();
		const onError = vi.fn();
		const view = renderPanel({ onError });
		await act(async () => fireEvent.click(screen.getByRole("button", { name: /connect wallet/i })));
		expect(authClient.getSession).toHaveBeenCalledOnce();
		const signal = vi.mocked(authClient.getSession).mock.calls[0][0]?.fetchOptions?.signal;
		view.unmount();
		expect(signal?.aborted).toBe(true);
		expect(vi.getTimerCount()).toBe(0);
		await act(async () => vi.advanceTimersByTimeAsync(4100));
		expect(authClient.getSession).toHaveBeenCalledOnce();
		expect(onError).not.toHaveBeenCalled();
	});

	it("reports a failed session confirmation after a successful signature and verification", async () => {
		vi.useFakeTimers();
		const onError = vi.fn();
		const onSuccess = vi.fn();
		renderPanel({ onError, onSuccess });
		await act(async () => fireEvent.click(screen.getByRole("button", { name: /connect wallet/i })));
		await act(async () => vi.advanceTimersByTimeAsync(4100));
		expect(onError.mock.calls[0]?.[0]).toEqual(expect.objectContaining({ message: expect.stringMatching(/session did not persist/i) }));
		expect(onSuccess).not.toHaveBeenCalled();
	});

	it.each(["headers", "body"] as const)("releases the form when the session response stalls at %s", async stage => {
		const sessionClient = createAuthClient({
			baseURL: "http://localhost:3000/api/auth",
			fetchOptions: { customFetchImpl: async (_url, init) => {
				const signal = init?.signal;
				if (stage === "headers") return new Promise<Response>((_resolve, reject) => {
					signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
				});
				return new Response(new ReadableStream({ start(controller) {
					signal?.addEventListener("abort", () => controller.error(new DOMException("Aborted", "AbortError")), { once: true });
				} }), { headers: { "content-type": "application/json" } });
			} },
		});
		vi.mocked(authClient.getSession).mockImplementation((...args) => sessionClient.getSession(...args));
		const onError = vi.fn();
		const setSubmitting = vi.fn();
		renderPanel({ onError, setSubmitting });
		await act(async () => fireEvent.click(screen.getByRole("button", { name: /connect wallet/i })));
		await vi.waitFor(() => expect(onError).toHaveBeenCalled(), { timeout: 5500 });
		expect(onError.mock.calls[0]?.[0]).toEqual(expect.objectContaining({ message: expect.stringMatching(/session did not persist/i) }));
		expect(setSubmitting).toHaveBeenLastCalledWith(false);
	}, 7000);

	it("waits for the verified wallet identity before returning to the requested page", async () => {
		vi.useFakeTimers();
		const assign = vi.fn();
		Object.defineProperty(window, "location", { value: {
			...originalLocation, protocol: "http:", host: "localhost:3000", origin: "http://localhost:3000", search: "?next=%2Fchat%3Fmodel%3Dgpt", assign,
		}, configurable: true, writable: true });
		vi.mocked(authClient.getSession).mockResolvedValue({ data: { user: { id: "old-user" } }, error: null } as never);
		renderPanel();
		await act(async () => fireEvent.click(screen.getByRole("button", { name: /connect wallet/i })));
		expect(assign).not.toHaveBeenCalled();
		vi.mocked(authClient.getSession).mockResolvedValue({ data: { user: { id: "wallet-user" } }, error: null } as never);
		await act(async () => vi.advanceTimersByTimeAsync(250));
		expect(assign).toHaveBeenCalledExactlyOnceWith("/chat?model=gpt");
		expect(signSiweMessage).toHaveBeenCalledWith(
			"0x0000000000000000000000000000000000000001", "12345678", "localhost:3000", "http://localhost:3000", expect.any(Function),
		);
	});

	it.each(["https://www.oma-ai.com", "https://www.preview.example:8443", "http://127.0.0.1:3123"])("uses the actual requesting origin %s for wallet sign-in", async origin => {
		const url = new URL(origin);
		Object.defineProperty(window, "location", { value: { ...originalLocation, protocol: url.protocol, host: url.host, origin: url.origin, search: "", assign: vi.fn() }, configurable: true, writable: true });
		vi.mocked(authClient.getSession).mockResolvedValue({ data: { user: { id: "wallet-user" } }, error: null } as never);
		renderPanel();
		await act(async () => fireEvent.click(screen.getByRole("button", { name: /connect wallet/i })));
		expect(signSiweMessage).toHaveBeenCalledWith("0x0000000000000000000000000000000000000001", "12345678", url.host, url.origin, expect.any(Function));
	});

	it.each([
		[4001, /cancel|reject/i],
		[-32002, /already.*(open|pending)|check.*wallet/i],
	])("makes wallet-provider error %s actionable and leaves sign-in retryable", async (code, message) => {
		vi.mocked(connectWallet).mockRejectedValue({ code, message: "Provider-specific details" });
		const onError = vi.fn();
		const setSubmitting = vi.fn();
		renderPanel({ onError, setSubmitting });
		await act(async () => fireEvent.click(screen.getByRole("button", { name: /connect wallet/i })));
		expect(onError.mock.calls[0]?.[0]).toBeInstanceOf(Error);
		expect(onError.mock.calls[0]?.[0].message).toMatch(message);
		expect(setSubmitting).toHaveBeenLastCalledWith(false);
	});

	it("still renders a connect button as the primary action", () => {
		renderPanel();
		expect(screen.getByRole("button", { name: /connect wallet/i })).toBeTruthy();
	});
});
