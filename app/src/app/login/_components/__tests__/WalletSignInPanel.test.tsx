import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import WalletSignInPanel from "../WalletSignInPanel";

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

describe("WalletSignInPanel", () => {
	beforeEach(() => cleanup());

	it("tells a wallet user that connecting creates their account", () => {
		renderPanel();
		expect(
			screen.getByText(/creates your account/i),
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

	it("does not navigate until the server confirms the session", async () => {
		// The wallet bug: siwe.verify resolves before the Set-Cookie is
		// committed, so navigating immediately lands on /dashboard signed out.
		const { authClient } = await import("@/lib/auth-client");
		const { connectWallet, ensureBaseChain, signSiweMessage } = await import(
			"@/lib/wallet"
		);
		vi.mocked(connectWallet).mockResolvedValue({ address: "0xabc" } as never);
		vi.mocked(ensureBaseChain).mockResolvedValue(undefined as never);
		vi.mocked(signSiweMessage).mockResolvedValue({
			message: "m",
			signature: "0xs",
		} as never);
		(authClient.siwe.verify as ReturnType<typeof vi.fn>).mockResolvedValue({
			data: { success: true },
			error: null,
		});
		// Session never appears.
		(authClient.getSession as ReturnType<typeof vi.fn>).mockResolvedValue({
			data: null,
			error: null,
		});

		const onError = vi.fn();
		const onSuccess = vi.fn();
		renderPanel({ onError, onSuccess });

		fireEvent.click(screen.getByRole("button", { name: /connect wallet/i }));

		await vi.waitFor(() => expect(onError).toHaveBeenCalled(), { timeout: 8000 });
		// It must NOT claim success, and must not have navigated away.
		expect(onSuccess).not.toHaveBeenCalled();
		expect(window.location.pathname).toBe("/");
	}, 20000);

	it("still renders a connect button as the primary action", () => {
		renderPanel();
		expect(screen.getByRole("button", { name: /connect wallet/i })).toBeTruthy();
	});
});
