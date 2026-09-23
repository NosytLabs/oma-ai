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

/**
 * The SIWE `domain` in the signed message MUST equal the host the server's
 * better-auth instance checks against (its `domain` option = the host of
 * PUBLIC_APP_URL, e.g. `localhost:3000` in dev / `oma-ai.com` in prod).
 *
 * We derive it from NEXT_PUBLIC_APP_URL (the canonical origin the server and
 * app are configured with) instead of `window.location.host`, so signing in
 * from `127.0.0.1:3000` or `localhost:3000` produces the SAME message that
 * passes server-side validation. Using `window.location.host` here when the
 * two differ (e.g. 127.0.0.1 vs localhost) makes better-auth reject the
 * signature with "SIWE message does not match the expected nonce, domain,
 * address, or chain ID" and prevents wallet sign-in.
 */
const SIWE_DOMAIN = (() => {
	if (typeof window !== "undefined") {
		const canonical =
			process.env.NEXT_PUBLIC_APP_URL?.replace(/^https?:\/\//, "").split("/")[0];
		if (canonical) return canonical;
		return window.location.host;
	}
	return "oma-ai.com";
})();


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
