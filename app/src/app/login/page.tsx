"use client";

/**
 * /login — Better Auth sign-in entry point.
 *
 * Three sign-in methods:
 *
 *   1. Magic link — passwordless email sign-in via Resend (dev: console.log fallback).
 *   2. SIWE wallet — EIP-4361 sign-in on Base mainnet via viem.
 *      Better Auth's siwe plugin owns the nonce + verify pipeline.
 *      On first sign-in, the server mints a 16-digit account number
 *      that's shown in the dashboard; the user can paste it back here
 *      as a shortcut to the wallet flow on future visits.
 *   3. Account number — paste a previously-issued account number. We
 *      look up the wallet that owns it and run the same SIWE handshake
 *      under the hood (no private key ever leaves the user's wallet).
 *
 * Cross-cutting:
 *   - No CSRF pre-fetch dance (Better Auth manages CSRF internally).
 *   - Errors bubble through Better Auth — friendly messages shaped
 *     server-side; we just toast them here.
 */

import {
	AlertTriangle,
	ArrowRight,
	Coins,
	Hash,
	Loader2,
	Mail,
	type LucideIcon,
	Sparkles,
	Wallet as WalletIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
	type FormEvent,
	useCallback,
	useEffect,
	useState,
} from "react";
import { useToast } from "@/components/ui/Toast";
import { useApiHealth } from "@/components/api-status";
import { OmaWordmark } from "@/components/ui/oma-logo";
import { authClient, signIn } from "@/lib/auth-client";
import {
	connectWallet,
	hasWallet,
	OMA_CHAIN_ID,
	signSiweMessage,
} from "@/lib/wallet";
import { api } from "@/lib/api";

type Method = "magic" | "wallet" | "account";

const ACCOUNT_NUMBER_RE = /^\d{4}-\d{4}-\d{4}-\d{4}$|^\d{16}$/;

const SIWE_DOMAIN =
	typeof window !== "undefined" ? window.location.host : "oma-ai.com";

function defaultNext(): string {
	if (typeof window === "undefined") return "/dashboard";
	const params = new URLSearchParams(window.location.search);
	const raw = params.get("next");
	if (!raw) return "/dashboard";
	if (!raw.startsWith("/") || raw.startsWith("//")) return "/dashboard";
	return raw;
}

export default function LoginPage() {
	return <LoginInner />;
}

function LoginInner() {
	const router = useRouter();
	const toast = useToast();
	const { status: apiStatus } = useApiHealth();
	const offline = apiStatus === "offline";

	const [method, setMethod] = useState<Method>("magic");
	const [email, setEmail] = useState("");
	const [accountInput, setAccountInput] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [magicSent, setMagicSent] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [next, setNext] = useState("/dashboard");
	const searchParams = useSearchParams();

	useEffect(() => {
		setNext(defaultNext());
		const requested = searchParams?.get("method");
		if (requested === "account" || requested === "wallet" || requested === "magic") {
			setMethod(requested);
		}
	}, [searchParams]);

	const handleError = useCallback(
		(err: unknown, fallback: string) => {
			const msg =
				err instanceof Error && err.message ? err.message : fallback;
			setError(msg);
			toast.error(msg);
		},
		[toast],
	);

	const handleMagic = useCallback(
		async (e: FormEvent<HTMLFormElement>) => {
			e.preventDefault();
			setError(null);
			if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
				setError("Enter a valid email address");
				return;
			}
			setSubmitting(true);
			try {
				await signIn.magicLink({
					email,
					callbackURL: next,
				});
				setMagicSent(true);
				toast.success(`Magic link sent to ${email}`);
			} catch (err) {
				handleError(err, "Failed to send magic link");
			} finally {
				setSubmitting(false);
			}
		},
		[email, next, toast, handleError],
	);

	const handleSiwe = useCallback(async () => {
		setError(null);
		if (!hasWallet()) {
			setError(
				"No EIP-1193 wallet detected. Install MetaMask, Rabby, or Coinbase Wallet, then reload.",
			);
			return;
		}
		setSubmitting(true);
		try {
			// 1. Prompt the user to connect a wallet and get their address.
			const wallet = await connectWallet();
			if (wallet.chainId !== OMA_CHAIN_ID) {
				throw new Error(
					`Switch your wallet to Base mainnet (chain id ${OMA_CHAIN_ID}) and try again.`,
				);
			}

			// 2. Ask Better Auth for a server-issued nonce for this wallet.
			const nonceResp = await authClient.siwe.nonce({
				walletAddress: wallet.address,
				chainId: wallet.chainId,
			});
			if (!nonceResp.data?.nonce) {
				throw new Error(
					nonceResp.error?.message ?? "Failed to get SIWE nonce from server",
				);
			}

			// 3. Build and sign the EIP-4361 message with the user's wallet.
			const { message, signature } = await signSiweMessage(
				wallet.address,
				nonceResp.data.nonce,
				SIWE_DOMAIN,
			);

			// 4. Hand the signed payload back to Better Auth for verification.
			//    The server's verifyMessage() callback (viem.recoverMessage)
			//    runs; on success a session cookie is set on the response.
			const verifyResp = await authClient.siwe.verify({
				message,
				signature,
				walletAddress: wallet.address,
				chainId: wallet.chainId,
			});
			if (verifyResp.error) {
				throw new Error(verifyResp.error.message ?? "Signature verification failed");
			}

			toast.success("Wallet connected");
			router.replace(next);
		} catch (err) {
			handleError(err, "Wallet sign-in failed");
		} finally {
			setSubmitting(false);
		}
	}, [next, router, toast, handleError]);

	// Account-number sign-in: a previously-issued 16-digit number resolves
	// server-side to the wallet that owns it, then we run the same SIWE
	// handshake. The account number alone is not enough to authenticate —
	// the wallet still has to sign — so this is a UX shortcut, not a
	// separate credential.
	const handleAccount = useCallback(
		async (e: FormEvent<HTMLFormElement>) => {
			e.preventDefault();
			setError(null);
			const normalized = accountInput.replace(/[\s-]/g, "");
			if (!ACCOUNT_NUMBER_RE.test(accountInput.trim()) || normalized.length !== 16) {
				setError("Enter a 16-digit account number (XXXX-XXXX-XXXX-XXXX or 16 digits)");
				return;
			}
			if (!hasWallet()) {
				setError(
					"Account-number sign-in needs your wallet to sign a one-time message. Install MetaMask, Rabby, or Coinbase Wallet, then reload.",
				);
				return;
			}
			setSubmitting(true);
			try {
				// 1. Resolve the account number to a wallet address.
				const lookup = await api.auth.lookupAccount(normalized);
				if (!lookup?.evmAddress) {
					throw new Error(
						"No wallet linked to that account number — sign in once with your wallet to link one.",
					);
				}

				// 2. Connect that exact wallet. If the user has multiple
				//    wallets in the same provider, we still surface a friendly
				//    hint instead of silently signing with the wrong one.
				const wallet = await connectWallet();
				if (wallet.address.toLowerCase() !== lookup.evmAddress.toLowerCase()) {
					throw new Error(
						`That account number is linked to a different wallet (${lookup.evmAddress.slice(0, 6)}…${lookup.evmAddress.slice(-4)}). Switch to it in your wallet and try again.`,
					);
				}
				if (wallet.chainId !== OMA_CHAIN_ID) {
					throw new Error(
						`Switch your wallet to Base mainnet (chain id ${OMA_CHAIN_ID}) and try again.`,
					);
				}

				// 3. Run the standard SIWE handshake — the account number is
				//    just a routing shortcut, the session is still wallet-bound.
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

				toast.success("Signed in via account number");
				router.replace(next);
			} catch (err) {
				handleError(err, "Account-number sign-in failed");
			} finally {
				setSubmitting(false);
			}
		},
		[accountInput, next, router, toast, handleError],
	);

	return (
		<div className="page-shell relative flex flex-col items-center justify-center px-4 py-8">
			<div className="container-page grid w-full max-w-5xl grid-cols-1 items-start gap-8 lg:grid-cols-[1fr_1fr]">
				<BrandPitch />
				<div className="mx-auto w-full max-w-md">
					<X402Callout />
					<div className="mt-6 rounded-lg border border-border-bright bg-panel p-6 shadow-[0_24px_72px_-42px_rgba(0,0,0,0.95)]">
						<h2 className="text-lg font-bold text-text-bright">
							Choose how to sign in
						</h2>
						<p className="mt-1 text-xs text-text-muted">
							Magic link by email or your wallet. No
							password to lose.
						</p>

						{offline && (
							<div
								role="alert"
								aria-live="assertive"
								className="mt-4 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3"
							>
								<AlertTriangle
									className="mt-0.5 h-4 w-4 shrink-0 text-warning"
									aria-hidden="true"
								/>
								<div className="text-xs text-text">
									<p className="font-semibold">API is offline</p>
									<p className="text-text-muted">
										Sign-in is temporarily unavailable. Retrying
										automatically.
									</p>
								</div>
							</div>
						)}

						{error && (
							<div
								role="alert"
								aria-live="assertive"
								className="mt-4 rounded-lg border border-error/30 bg-error/10 p-3 text-xs text-error"
							>
								{error}
							</div>
						)}

						<div
							role="tablist"
							aria-label="Sign-in method"
							className="mt-5 grid gap-1 rounded-lg border border-border bg-surface p-1"
						>
							<TabButton
								id="tab-magic"
								label="Magic link"
								selected={method === "magic"}
								icon={<Mail className="h-3.5 w-3.5" aria-hidden="true" />}
								onSelect={() => {
									setMethod("magic");
									setError(null);
								}}
							/>
							<TabButton
								id="tab-wallet"
								label="Wallet"
								selected={method === "wallet"}
								icon={<WalletIcon className="h-3.5 w-3.5" aria-hidden="true" />}
								onSelect={() => {
									setMethod("wallet");
									setError(null);
								}}
							/>
							<TabButton
								id="tab-account"
								label="Account #"
								selected={method === "account"}
								icon={<Hash className="h-3.5 w-3.5" aria-hidden="true" />}
								onSelect={() => {
									setMethod("account");
									setError(null);
								}}
							/>
						</div>

						<div className="mt-5">
							<p className="text-sm text-text-secondary">
								Passwordless email link or your base wallet — no
								password to lose.
							</p>
							{method === "magic" && (
								<form onSubmit={handleMagic} className="space-y-3">
									<label
										htmlFor="email"
										className="block text-xs font-medium uppercase tracking-wider text-text-secondary"
									>
										Email address
									</label>
									<input
										id="email"
										type="email"
										autoComplete="email"
										inputMode="email"
										placeholder="you@example.com"
										value={email}
										onChange={(e) => setEmail(e.target.value.trim())}
										required
										className="w-full text-sm bg-void border border-border-bright rounded-lg px-3 py-3 placeholder:text-text-muted focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/20"
									/>
									<button
										type="submit"
										disabled={submitting || offline}
										className="w-full py-3 text-sm font-semibold rounded-lg bg-accent text-void transition-colors hover:bg-accent-bright disabled:cursor-not-allowed disabled:opacity-50"
									>
										{submitting ? (
											<>
												<Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
												Sending…
											</>
										) : (
											"Send magic link →"
										)}
									</button>
									{magicSent && (
										<p
											role="status"
											className="text-[11px] text-text-muted"
										>
											Check your inbox. The link expires in 5 minutes.
										</p>
									)}
								</form>
							)}

							{method === "wallet" && (
								<div className="space-y-3">
									<p className="text-sm text-text-secondary">
										Sign in with your Base mainnet wallet via SIWE
										(EIP-4361). No transaction — just a signature.
									</p>
									<button
										type="button"
										onClick={() => void handleSiwe()}
										disabled={submitting || offline}
										className="w-full py-3 text-sm font-semibold rounded-lg bg-accent text-void transition-colors hover:bg-accent-bright disabled:cursor-not-allowed disabled:opacity-50"
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
						)}

							{method === "account" && (
								<form onSubmit={handleAccount} className="space-y-3">
									<p className="text-sm text-text-secondary">
										Paste the 16-digit number from your dashboard. We look up
										the wallet that owns it and sign a one-time message — your
										private key never leaves your wallet.
									</p>
									<label
										htmlFor="account-number"
										className="block text-xs font-medium uppercase tracking-wider text-text-secondary"
									>
										Account number
									</label>
									<input
										id="account-number"
										type="text"
										autoComplete="off"
										inputMode="numeric"
										placeholder="1234-5678-9012-3456"
										value={accountInput}
										onChange={(e) =>
											setAccountInput(
												e.target.value.replace(/[^\d-]/g, "").slice(0, 19),
											)
										}
										required
										className="w-full font-mono tracking-widest text-sm bg-void border border-border-bright rounded-lg px-3 py-3 placeholder:text-text-muted focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/20"
									/>
									<button
										type="submit"
										disabled={submitting || offline}
										className="w-full py-3 text-sm font-semibold rounded-lg bg-accent text-void transition-colors hover:bg-accent-bright disabled:cursor-not-allowed disabled:opacity-50"
									>
										{submitting ? (
											<>
												<Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
												Signing…
											</>
										) : (
											"Sign in with account number →"
										)}
									</button>
									<p className="text-[11px] text-text-muted">
										Don&apos;t have one yet?{" "}
										<Link
											href="/login?method=wallet"
											className="text-accent hover:underline underline-offset-2"
										>
											Sign in once with your wallet
										</Link>{" "}
										to get one.
									</p>
								</form>
							)}
					</div>
					</div>
					<p className="mt-6 text-center text-xs text-text-muted">
						By signing in you accept the{" "}
						<Link href="/terms" className="text-accent underline decoration-accent opacity-60 underline-offset-2 hover:decoration-accent">
							Terms
						</Link>
						,{" "}
						<Link href="/privacy" className="text-accent underline decoration-accent opacity-60 underline-offset-2 hover:decoration-accent">
							Privacy Policy
						</Link>
						, and{" "}
						<Link href="/aup" className="text-accent underline decoration-accent opacity-60 underline-offset-2 hover:decoration-accent">
							Acceptable Use Policy
						</Link>
						.
					</p>
				</div>
			</div>
		</div>
	);
}

interface TabButtonProps {
	id: string;
	label: string;
	selected: boolean;
	icon: React.ReactNode;
	onSelect: () => void;
}

function TabButton({ id, label, selected, icon, onSelect }: TabButtonProps) {
	return (
		<button
			type="button"
			id={id}
			role="tab"
			aria-selected={selected}
			onClick={onSelect}
			className={`inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
				selected
					? "bg-accent text-void shadow-sm"
					: "text-text-muted hover:text-text"
			}`}
		>
			{icon}
			{label}
		</button>
	);
}

function BrandPitch() {
	const items: Array<{ Icon: LucideIcon; title: string; body: string }> = [
		{
			Icon: Mail,
			title: "Magic link sign-in.",
			body: "Passwordless email link that expires in 5 minutes. No password to leak.",
		},
		{
			Icon: Sparkles,
			title: "One gateway. Every model.",
			body: "OpenAI-compatible API. Multi-provider routing with provider failover.",
		},
		{
			Icon: Coins,
			title: "Crypto-native billing.",
			body: "Credits in USDC on Base. x402 pay-per-request for agents — wallet-based, no card needed.",
		},
	];
	return (
		<div className="space-y-6">
			<div className="surface-card p-8">
				<OmaWordmark size="md" />
				<h1 className="mt-6 text-3xl font-bold tracking-tight text-text-bright sm:text-4xl">
					Sign in once.{" "}
					<span className="gradient-text-accent">Ship without friction.</span>
				</h1>
				<p className="mt-3 text-sm text-text-secondary">
					One OpenAI-compatible gateway. Magic link or wallet, credits in USDC
					on Base, x402 for agents.
				</p>
				<ul className="mt-6 space-y-4">
					{items.map(({ Icon, title, body }) => (
						<li key={title} className="flex items-start gap-3">
							<span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-accent/20 bg-accent/10 text-accent">
								<Icon className="h-4 w-4" aria-hidden="true" />
							</span>
							<div>
								<p className="text-sm font-semibold text-text-bright">
									{title}
								</p>
								<p className="mt-0.5 text-xs leading-relaxed text-text-muted">
									{body}
								</p>
							</div>
						</li>
					))}
				</ul>
			</div>
		</div>
	);
}

function X402Callout() {
	return (
		<div className="rounded-lg border border-accent/25 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--color-accent)_10%,transparent)_0%,color-mix(in_srgb,var(--color-panel)_92%,transparent)_100%)] p-5 shadow-[0_18px_44px_-32px_var(--color-accent-glow)]">
			<div className="flex items-start gap-3">
				<span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-accent/30 bg-accent/10 text-accent">
					<Sparkles className="h-4 w-4" aria-hidden="true" />
				</span>
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-2">
						<p className="text-sm font-semibold text-text-bright">
							Pay per request with x402
						</p>
						<span className="rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-accent">
							Agents
						</span>
					</div>
					<p className="mt-1 text-[11px] leading-relaxed text-text-muted">
						Call chat completions with no account; on 402, retry with a signed{" "}
						<code className="font-mono text-text-secondary">
							PAYMENT-SIGNATURE
						</code>{" "}
						envelope (EIP-3009 USDC on Base). Flat rate per request — wallet-based,
						no card needed, gas paid by the facilitator.
					</p>
					<Link
						href="/docs#x402"
						className="mt-2.5 inline-flex items-center gap-1 text-[11px] font-semibold text-accent hover:underline underline-offset-2"
					>
						How x402 works
						<ArrowRight className="h-3 w-3" aria-hidden="true" />
					</Link>
				</div>
			</div>
		</div>
	);
}