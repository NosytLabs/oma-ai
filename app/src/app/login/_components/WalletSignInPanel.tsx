"use client";

import { useCallback } from "react";
import { Loader2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import {
	connectWallet,
	hasWallet,
	OMA_CHAIN_ID,
	signSiweMessage,
} from "@/lib/wallet";
import { resolveSiweDomain } from "./siwe-domain";

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
 * looking at, and the server accepts both apex and www. The logic lives in
 * `./siwe-domain` so it is unit-testable without rendering this component.
 */
const SIWE_DOMAIN = resolveSiweDomain();


interface WalletSignInPanelProps {
	next: string;
	offline: boolean;
	submitting: boolean;
	setSubmitting: (submitting: boolean) => void;
	onError: (err: unknown, fallback: string) => void;
	onSuccess: (msg: string) => void;
	onRedirect: (url: string) => void;
}

export default function WalletSignInPanel({
	next,
	offline,
	submitting,
	setSubmitting,
	onError,
	onSuccess,
	onRedirect,
}: WalletSignInPanelProps) {
	const handleSiwe = useCallback(async () => {
		if (!hasWallet()) {
			onError(
				new Error("No EIP-1193 wallet detected. Install MetaMask, Rabby, or Coinbase Wallet, then reload."),
				"Wallet connection failed"
			);
			return;
		}
		setSubmitting(true);
		try {
			const wallet = await connectWallet();
			if (wallet.chainId !== OMA_CHAIN_ID) {
				throw new Error(
					`Switch your wallet to Base mainnet (chain id ${OMA_CHAIN_ID}) and try again.`,
				);
			}

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

			onSuccess("Wallet connected");
			onRedirect(next);
		} catch (err) {
			onError(err, "Wallet sign-in failed");
		} finally {
			setSubmitting(false);
		}
	}, [next, onError, onSuccess, onRedirect, setSubmitting]);

	return (
		<div className="space-y-3 animate-fade-in">
			<p className="text-sm text-text-secondary">
				Sign in with your Base mainnet wallet via SIWE
				(EIP-4361). No transaction — just a signature.
			</p>
			<button
				type="button"
				onClick={() => void handleSiwe()}
				disabled={submitting || offline}
				className="btn-primary min-h-12 w-full rounded-[var(--radius-lg)] disabled:cursor-not-allowed disabled:opacity-50"
			>
				{submitting ? (
					<>
						<Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
						Connecting…
					</>
				) : (
					"Connect wallet"
				)}
			</button>
		</div>
	);
}
