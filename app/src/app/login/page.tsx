"use client";

/**
 * /login — Better Auth sign-in entry point.
 *
 * Three sign-in methods, all driven by Better Auth:
 *
 *   1. Magic link — passwordless email sign-in. Resend in prod,
 *      console.log fallback in dev. Works with any browser.
 *   2. Anonymous — "Continue as guest" — no PII, ephemeral session.
 *      Better Auth tracks it under a generated email domain so the
 *      session cookie still gets the same HttpOnly treatment.
 *   3. SIWE wallet — EIP-4361 sign-in on Base mainnet via wagmi.
 *      Better Auth's siwe plugin owns the nonce + verify pipeline.
 *
 * Cross-cutting:
 *   - No CSRF pre-fetch dance (Better Auth manages CSRF internally).
 *   - Use `signIn.magicLink()` / `signIn.anonymous()` / `signIn.siwe()`
 *     on the Better Auth client. No custom fetch plumbing.
 *   - Errors bubble through Better Auth — friendly messages shaped
 *     server-side; we just toast them here.
 */

import {
	AlertTriangle,
	ArrowRight,
	Loader2,
	Mail,
	type LucideIcon,
	Sparkles,
	User as GuestIcon,
	Wallet as WalletIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
	type FormEvent,
	useCallback,
	useEffect,
	useState,
} from "react";
import { useToast } from "@/components/ui/Toast";
import { useApiHealth } from "@/components/api-status";
import { signIn } from "@/lib/auth-client";

type Method = "magic" | "anonymous" | "wallet";

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
	const [submitting, setSubmitting] = useState(false);
	const [magicSent, setMagicSent] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [next, setNext] = useState("/dashboard");

	useEffect(() => {
		setNext(defaultNext());
	}, []);

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

	const handleAnonymous = useCallback(async () => {
		setError(null);
		setSubmitting(true);
		try {
			await signIn.anonymous();
			toast.success("Signed in as guest");
			router.replace(next);
		} catch (err) {
			handleError(err, "Failed to start guest session");
		} finally {
			setSubmitting(false);
		}
	}, [router, next, toast, handleError]);

	const handleSiwe = useCallback(async () => {
		setError(null);
		setSubmitting(true);
		try {
			// Better Auth SIWE plugin handles nonce + verify.
			// The plugin opens the configured wallet flow (window.ethereum)
			// to capture the signature and forwards it to the server.
			// For now we surface a "Connect wallet" CTA — the actual sign-in
			// dance is wired through `signIn.siwe()` once the user has a
			// connected wallet (window.ethereum injection) to sign with.
			type SiweSignIn = (args: { walletAddress: string; callbackURL: string }) => Promise<void>;
			const siwe = (signIn as unknown as { siwe?: SiweSignIn }).siwe;
			if (!siwe) {
				throw new Error("SIWE plugin not enabled on this deployment");
			}
			await siwe({ walletAddress: "", callbackURL: next });
			router.replace(next);
		} catch (err) {
			handleError(err, "Wallet sign-in failed");
		} finally {
			setSubmitting(false);
		}
	}, [next, router, toast, handleError]);

	return (
		<div className="page-shell relative flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center px-4 py-8">
			<div className="container-page grid w-full max-w-5xl grid-cols-1 items-start gap-8 lg:grid-cols-[1fr_1fr]">
				<BrandPitch />
				<div className="mx-auto w-full max-w-md">
					<X402Callout />
					<div className="mt-6 rounded-lg border border-border-bright bg-panel p-6 shadow-[0_24px_72px_-42px_rgba(0,0,0,0.95)]">
						<h2 className="text-lg font-bold text-text-bright">
							Choose how to sign in
						</h2>
						<p className="mt-1 text-xs text-text-muted">
							Magic link by email, anonymous guest, or your wallet. No
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
								id="tab-guest"
								label="Guest"
								selected={method === "anonymous"}
								icon={<GuestIcon className="h-3.5 w-3.5" aria-hidden="true" />}
								onSelect={() => {
									setMethod("anonymous");
									setError(null);
								}}
							/>
						</div>

						<div className="mt-5">
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

							{method === "anonymous" && (
								<div className="space-y-3">
									<p className="text-sm text-text-secondary">
										Get a free ephemeral session without an email or
										wallet. You can link an account later from
										settings.
									</p>
									<button
										type="button"
										onClick={() => void handleAnonymous()}
										disabled={submitting || offline}
										className="w-full py-3 text-sm font-semibold rounded-lg bg-accent text-void transition-colors hover:bg-accent-bright disabled:cursor-not-allowed disabled:opacity-50"
									>
										{submitting ? (
											<>
												<Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
												Starting…
											</>
										) : (
											"Continue as guest →"
										)}
									</button>
								</div>
							)}
						</div>
					</div>
					<p className="mt-6 text-center text-xs text-text-muted">
						By signing in you accept the{" "}
						<Link href="/terms" className="text-accent hover:underline">
							Terms
						</Link>{" "}
						and{" "}
						<Link href="/privacy" className="text-accent hover:underline">
							Privacy Policy
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
			Icon: GuestIcon,
			title: "Crypto-native billing.",
			body: "Credits in USDC on Base. x402 pay-per-request for agents — no card, no KYC.",
		},
	];
	return (
		<div className="space-y-6">
			<div className="surface-card p-8">
				<p className="font-mono text-xs uppercase tracking-widest text-accent">
					Open Model Access
				</p>
				<h1 className="mt-2 text-3xl font-bold tracking-tight text-text-bright sm:text-4xl">
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
						envelope (EIP-3009 USDC on Base). Flat rate per request — no card,
						no KYC, gas paid by the facilitator.
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