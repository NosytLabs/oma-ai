"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

/** Confirm the newly verified identity through the browser's session cookie. */
async function confirmSession(userId: string, signal: AbortSignal, isActive: () => boolean, timeoutMs = 4000): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	// getSession() is relative to the same-origin auth proxy by default.
	while (Date.now() < deadline && isActive()) {
		try {
			const { data } = await authClient.getSession({
				query: { disableCookieCache: true },
				fetchOptions: {
					cache: "no-store",
					// Keep the deadline active through response-body parsing too.
					signal: AbortSignal.any([signal, AbortSignal.timeout(Math.max(1, deadline - Date.now()))]),
				},
			});
			if (!isActive()) return;
			if (data?.user?.id === userId) {
				// Reload the authenticated app instead of preserving stale client state.
				window.location.assign(
					safeLoginNext(new URLSearchParams(window.location.search).get("next")),
				);
				return;
			}
		} catch {
			// Transient: retry until the deadline.
		}
		if (!isActive()) return;
		const remaining = deadline - Date.now();
		if (remaining > 0) await new Promise<void>(resolve => {
			const done = () => { clearTimeout(timer); signal.removeEventListener("abort", done); resolve(); };
			const timer = setTimeout(done, Math.min(250, remaining));
			signal.addEventListener("abort", done, { once: true });
			if (signal.aborted) done();
		});
	}
	if (!isActive()) return;
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
	// shared across every wallet row, so without this every button claims to
	// be connecting while a single popup is open.
	const [pendingWalletId, setPendingWalletId] = useState<string | undefined>(undefined);
	const attemptRef = useRef<AbortController | null>(null);
	useEffect(() => subscribeWallets(() => setWallets(listWallets())), []);
	useEffect(() => () => {
		const attempt = attemptRef.current;
		if (!attempt) return;
		attemptRef.current = null;
		// A dispatched wallet prompt cannot be dismissed programmatically.
		// Ignore its eventual result and stop any remaining HTTP/polling work.
		attempt.abort();
		setSubmitting(false);
	}, [setSubmitting]);

	const handleSiwe = useCallback(async (walletId?: string) => {
		if (submitting || attemptRef.current) return;
		const attempt = new AbortController();
		attemptRef.current = attempt;
		const isActive = () => attemptRef.current === attempt;
		setPendingWalletId(walletId);
		setSubmitting(true);
		try {
			const wallet = await connectWallet(walletId, isActive);
			if (!isActive()) return;
			await ensureBaseChain(isActive);
			if (!isActive()) return;

			const nonceResp = await authClient.siwe.nonce({}, { signal: attempt.signal });
			if (!isActive()) return;
			if (!nonceResp.data?.nonce) {
				throw new Error(
					nonceResp.error?.message ?? "Failed to get SIWE nonce from server",
				);
			}

			const domain = resolveSiweDomain();
			const { message, signature } = await signSiweMessage(
				wallet.address,
				nonceResp.data.nonce,
				domain,
				window.location.origin,
				isActive,
			);
			if (!isActive()) return;

			const verifyResp = await authClient.siwe.verify({
				message,
				signature,
			}, { signal: attempt.signal });
			if (!isActive()) return;
			if (verifyResp.error) {
				throw new Error(verifyResp.error.message ?? "Signature verification failed");
			}
			if (!verifyResp.data?.success || !verifyResp.data.user?.id) {
				throw new Error("Wallet verification did not return an account. Please try again.");
			}
			await confirmSession(verifyResp.data.user.id, attempt.signal, isActive);
			if (isActive()) onSuccess("Wallet connected");
		} catch (err) {
			if (!isActive()) return;
			const details = err && typeof err === "object" ? err as { code?: unknown; message?: unknown } : undefined;
			const error = Number(details?.code) === 4001
				? new Error("Wallet request canceled. You can try again when ready.")
				: Number(details?.code) === -32002
					? new Error("A wallet request is already open. Check your wallet before trying again.")
					: err instanceof Error ? err
						: new Error(typeof details?.message === "string" ? details.message : "Wallet sign-in failed");
			onError(error, "Wallet sign-in failed");
		} finally {
			if (isActive()) {
				attemptRef.current = null;
				setSubmitting(false);
				setPendingWalletId(undefined);
			}
		}
	}, [onError, onSuccess, setSubmitting, submitting]);

	return (
		<div className="space-y-3 animate-fade-in">
			<p className="text-sm text-text-secondary">
				Sign in with your Base mainnet wallet via SIWE
				(EIP-4361). No transaction — just a signature.
			</p>
			<p className="text-[11px] text-text-muted">
				New to OMA? Signing in creates an account linked to your wallet
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
						wallets[0] ? `Connect ${wallets[0].name}` : "Connect wallet"
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
						Install a browser wallet, or use an email magic link to sign
						in without an extension.
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
