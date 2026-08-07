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

const SIWE_DOMAIN =
	typeof window !== "undefined" ? window.location.host : "oma-ai.com";

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

			const nonceResp = await authClient.siwe.nonce({
				walletAddress: wallet.address,
				chainId: wallet.chainId,
			});
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
				walletAddress: wallet.address,
				chainId: wallet.chainId,
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
		<div
			role="tabpanel"
			id="panel-wallet"
			aria-labelledby="tab-wallet"
			className="space-y-3 animate-fade-in"
		>
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
