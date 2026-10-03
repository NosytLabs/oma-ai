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

vi.mock("@/lib/auth-client", () => ({ authClient: { siwe: { nonce: vi.fn(), verify: vi.fn() } } }));

function renderPanel(overrides: Record<string, unknown> = {}) {
	return render(
		<WalletSignInPanel
			next="/dashboard"
			submitting={false}
			setSubmitting={() => {}}
			onError={() => {}}
			onSuccess={() => {}}
			onRedirect={() => {}}
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
		for (const name of ["MetaMask", "Rabby", "Coinbase Wallet", "WalletConnect"]) {
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

	it("still renders a connect button as the primary action", () => {
		renderPanel();
		expect(screen.getByRole("button", { name: /connect wallet/i })).toBeTruthy();
	});
});