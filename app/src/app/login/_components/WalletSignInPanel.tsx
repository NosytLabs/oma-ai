"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import {
	connectWallet,
	ensureBaseChain,
	listWallets,
	signSiweMessage,
	subscribeWallets,
	type DiscoveredWallet,
} from "@/lib/wallet";
import { resolveSiweDomain } from "./siwe-domain";
import { safeLoginNext } from "@/lib/login-href";

/**
 * The SIWE `domain` in the signed message MUST equal the host the server's
 * better-auth instance checks against.
 *
 * Sign from the host the browser is ACTUALLY on. Previously this preferred
 * NEXT_PUBLIC_APP_URL, which Next inlines at BUILD time — so the shipped
 * bundle could disagree with the live host (it carried "oma-ai.com" while
 * the site is served from www.oma-ai.com). better-auth then rejected the
 * message with "SIWE message does not match the expected nonce, domain,
 * address, or chain ID" and wallet sign-in never created an account.
 *
 * `window.location.host` is the single source of truth for what the user is
 * looking at; production redirects the apex to the server's canonical www
 * host before sign-in. The logic lives in
 * `./siwe-domain` so it is unit-testable without rendering this component.
 */
const SIWE_DOMAIN = resolveSiweDomain();

/**
 * Wait until the server actually reports an authenticated session.
 *
 * better-auth's siwe.verify resolves as soon as its fetch returns; the
 * Set-Cookie it carries is committed by the browser independently. A
 * client-side navigation issued in the same tick can therefore arrive before
 * the cookie is visible, and the destination renders signed-out. This polls
 * get-session briefly rather than assuming success, then forces a full page
 * load so navigation can never race the cookie again.
 *
 * Throws if no session appears, so the caller surfaces a real error instead
 * of silently dropping the visitor on a signed-out page.
 */
async function confirmSession(timeoutMs = 4000): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	// getSession() is relative to the same-origin auth proxy by default.
	while (Date.now() < deadline) {
		try {
			const { data } = await authClient.getSession({ fetchOptions: { cache: "no-store" } });
			if (data?.user) {
				// Cookie is confirmed. A hard navigation guarantees it is
				// applied on the next render, with no client-cache to rehydrate.
				window.location.assign(
					safeLoginNext(new URLSearchParams(window.location.search).get("next")),
				);
				return;
			}
		} catch {
			// Transient: retry until the deadline.
		}
		await new Promise((resolve) => setTimeout(resolve, 250));
	}
	throw new Error(
		"Signed, but the session did not persist. Please try again — if this repeats, use the magic link.",
	);
}


interface WalletSignInPanelProps {
	submitting: boolean;
	setSubmitting: (submitting: boolean) => void;
	onError: (err: unknown, fallback: string) => void;
	onSuccess: (msg: string) => void;
	/** Switch back to the magic-link tab from the no-wallet help block. */
	onUseMagicLink: () => void;
}

export default function WalletSignInPanel({
	submitting,
	setSubmitting,
	onError,
	onSuccess,
	onUseMagicLink,
}: WalletSignInPanelProps) {
	const [wallets, setWallets] = useState<DiscoveredWallet[]>([]);
	// Which wallet row the visitor actually clicked. `submitting` alone is
	// shared across every row and tab, so without this every button claims to
	// be connecting while a single popup is open.
	const [pendingWalletId, setPendingWalletId] = useState<string | undefined>(undefined);
	useEffect(() => subscribeWallets(() => setWallets(listWallets())), []);

	const handleSiwe = useCallback(async (walletId?: string) => {
		setPendingWalletId(walletId);
		setSubmitting(true);
		try {
			const wallet = await connectWallet(walletId);
			await ensureBaseChain();

			const nonceResp = await authClient.siwe.nonce({});
			if (!nonceResp.data?.nonce) {
				throw new Error(
					nonceResp.error?.message ?? "Failed to get SIWE nonce from server",
				);
			}

			const { message, signature } = await signSiweMessage(
				wallet.address,
				nonceResp.data.nonce,
				SIWE_DOMAIN,
			);

			const verifyResp = await authClient.siwe.verify({
				message,
				signature,
			});
			if (verifyResp.error) {
				throw new Error(verifyResp.error.message ?? "Signature verification failed");
			}

			// `siwe.verify` is a fetch, so the Set-Cookie lands asynchronously.
			// A client-side router.replace() can win that race and land on
			// /dashboard before the browser has committed the session, which
			// renders "SIGN IN REQUIRED" and looks like sign-in silently failed.
			// The magic-link path never hit this because it redirects through
			// callbackURL, i.e. a full page load, so the cookie is always set.
			//
			// Confirm the session actually exists before navigating.
			// On success confirmSession() performs the hard navigation itself,
			// so it never returns here; only the throw path falls through.
			await confirmSession();
			onSuccess("Wallet connected");
		} catch (err) {
			onError(err, "Wallet sign-in failed");
		} finally {
			setSubmitting(false);
			setPendingWalletId(undefined);
		}
	}, [onError, onSuccess, setSubmitting]);

	return (
		<div className="space-y-3 animate-fade-in">
			<p className="text-sm text-text-secondary">
				Sign in with your Base mainnet wallet via SIWE
				(EIP-4361). No transaction — just a signature.
			</p>
			<p className="text-[11px] text-text-muted">
				No wallet yet? This creates your account and binds it to your
				address.
			</p>
			{wallets.length > 1 ? (
							<div className="space-y-2">
								{wallets.map((wallet) => (
									<button
										key={wallet.id}
										type="button"
										onClick={() => void handleSiwe(wallet.id)}
										disabled={submitting}
										className="btn-primary min-h-12 w-full rounded-[var(--radius-lg)] disabled:cursor-not-allowed disabled:opacity-50"
									>
										{/* Only the wallet that was actually clicked shows progress.
										    Labelling every row "Connecting…" implied all of them
										    were being tried at once, which is confusing next to an
										    open wallet popup. */}
										{submitting && pendingWalletId === wallet.id ? (
											<>
												<Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
												Check your wallet…
											</>
										) : (
											`Connect ${wallet.name}`
										)}
									</button>
								))}
							</div>
						) : (
							<button
								type="button"
								onClick={() => void handleSiwe()}
								disabled={submitting}
								className="btn-primary min-h-12 w-full rounded-[var(--radius-lg)] disabled:cursor-not-allowed disabled:opacity-50"
							>
								{submitting ? (
									<>
										<Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
										Check your wallet…
									</>
								) : (
						"Connect wallet"
					)}
				</button>
			)}
			{/*
			  The "no wallet" case is a dead end if the only output is an error
			  toast naming three wallets. Most visitors here are not already
			  running an EIP-1193 provider, so offer the actual next step plus a
			  link to the magic-link tab, which needs no extension at all.
			*/}
			{wallets.length === 0 && !submitting && (
				<div className="rounded-[var(--radius-lg)] border border-border/60 bg-surface/40 p-4 text-sm">
					<p className="font-semibold text-text-primary">No wallet extension detected</p>
					<p className="mt-1 text-xs text-text-muted">
						SIWE needs an EIP-1193 provider. Install one, or use the magic
						link instead — it needs no extension and creates the same
						account.
					</p>
					<ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs">
						<li>
							<a
								href="https://metamask.io/download/"
								target="_blank"
								rel="noopener noreferrer"
								className="text-accent underline underline-offset-2 hover:opacity-80"
							>
								MetaMask
							</a>
						</li>
						<li>
							<a
								href="https://rabby.io/"
								target="_blank"
								rel="noopener noreferrer"
								className="text-accent underline underline-offset-2 hover:opacity-80"
							>
								Rabby
							</a>
						</li>
						<li>
							<a
								href="https://www.coinbase.com/wallet/downloads"
								target="_blank"
								rel="noopener noreferrer"
								className="text-accent underline underline-offset-2 hover:opacity-80"
							>
								Coinbase Wallet
							</a>
						</li>
						<li>
							<a
								href="https://www.walletconnect.com/"
								target="_blank"
								rel="noopener noreferrer"
								className="text-accent underline underline-offset-2 hover:opacity-80"
							>
								WalletConnect
							</a>
						</li>
					</ul>
					<button
						type="button"
						onClick={onUseMagicLink}
						className="mt-4 w-full rounded-[var(--radius-lg)] border border-border px-4 py-2 text-sm font-semibold text-text-secondary transition-colors hover:border-text/40 hover:text-text"
					>
						Use magic link instead
					</button>
				</div>
			)}
		</div>
	);
}
