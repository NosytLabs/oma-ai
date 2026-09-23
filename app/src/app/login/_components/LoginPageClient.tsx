"use client";

/**
	* /login — Better Auth sign-in entry point.
	*
	* Two sign-in methods:
	*
	* 1. Magic link — passwordless email sign-in via Resend.
	* 2. SIWE wallet — EIP-4361 sign-in on Base mainnet via viem.
	* Better Auth owns the nonce, signature verification, and session.
	*
	* Cross-cutting:
	* - No CSRF pre-fetch dance (Better Auth manages CSRF internally).
	* - Errors bubble through Better Auth — friendly messages shaped
	* server-side; we just toast them here.
	*/

import {
	AlertTriangle,
	ArrowRight,
	Coins,
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
	Suspense,
	useCallback,
	useEffect,
	useState,
} from "react";
import dynamic from "next/dynamic";
import { useToast } from "@/components/ui/Toast";
import { useApiHealth } from "@/components/api-status";
import { OmaWordmark } from "@/components/ui/oma-logo";
import { signIn } from "@/lib/auth-client";
import { useAuth } from "@/lib/hooks/useAuth";
import { Skeleton } from "@/components/ui/Skeleton";

const LazyWalletSignInPanel = dynamic(
	() => import("./WalletSignInPanel"),
	{
		ssr: true,
		loading: () => <Skeleton className="h-40 w-full" />,
	},
);

type Method = "magic" | "wallet";

/**
	* Resolve post-login destination. Only same-origin relative paths are allowed
	* (blocks open redirects via `//evil` or absolute URLs).
	* Exported for unit tests — keep the guard in one place.
	*/
export function safeLoginNext(raw: string | null | undefined): string {
	if (!raw) return "/dashboard";
	if (!raw.startsWith("/") || raw.startsWith("//")) return "/dashboard";
	return raw;
}

function defaultNext(): string {
	if (typeof window === "undefined") return "/dashboard";
	const params = new URLSearchParams(window.location.search);
	return safeLoginNext(params.get("next"));
}

function LoginFallback() {
	return (
		<div
			className="page-shell relative flex flex-col items-center justify-center py-10 sm:py-12"
			aria-busy="true"
			aria-label="Loading sign-in"
		>
			<div className="container-page grid w-full max-w-5xl grid-cols-1 items-start gap-8 lg:grid-cols-[1fr_1fr] lg:items-center">
				<div className="surface-card space-y-4 p-8">
					<Skeleton className="h-8 w-32" />
					<Skeleton className="h-10 w-3/4" />
					<Skeleton className="h-4 w-full" />
					<Skeleton className="h-16 w-full" />
					<Skeleton className="h-16 w-full" />
				</div>
				<div className="mx-auto w-full max-w-md space-y-4 lg:mx-0">
					<Skeleton className="h-28 w-full rounded-[var(--radius-lg)]" />
					<Skeleton className="h-64 w-full rounded-[var(--radius-lg)]" />
				</div>
			</div>
		</div>
	);
}

export default function LoginPage() {
	// useSearchParams requires a Suspense boundary so SSR and the first
	// client paint share the same tree (avoids hydration attribute drift).
	return (
		<Suspense fallback={<LoginFallback />}>
			<LoginInner />
		</Suspense>
	);
}

function LoginInner() {
	const router = useRouter();
	const toast = useToast();
	const { status: apiStatus } = useApiHealth();
	const { isAuthenticated, isDemo, isReady } = useAuth();
	const [mounted, setMounted] = useState(false);
	const offline = mounted && apiStatus === "offline";

	// Already signed in — don't show the form, go where they were headed.
	useEffect(() => {
		if (isReady && isAuthenticated && !isDemo) {
			router.replace(defaultNext());
		}
	}, [isReady, isAuthenticated, isDemo, router]);

	const [method, setMethod] = useState<Method>("magic");
	const [email, setEmail] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [magicSent, setMagicSent] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [next, setNext] = useState("/dashboard");
	const searchParams = useSearchParams();

	useEffect(() => {
		setMounted(true);
		setNext(defaultNext());
		const requested = searchParams?.get("method");
		if (requested === "wallet" || requested === "magic") {
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
				const absoluteCallback = next.startsWith("/")
					? `${window.location.origin}${next}`
					: next;
				await signIn.magicLink({
					email,
					callbackURL: absoluteCallback,
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

	return (
		<div className="page-shell relative flex flex-col items-center justify-center py-10 sm:py-12">
			<div className="container-page grid w-full max-w-5xl grid-cols-1 items-start gap-8 lg:grid-cols-[1fr_1fr] lg:items-center lg:gap-12">
				<BrandPitch />
				<div className="order-first mx-auto w-full max-w-md lg:order-none lg:mx-0 lg:justify-self-start">
					<div className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-lg)]">
						<h2 className="text-lg font-bold text-text-bright">
							Choose how to sign in
						</h2>
						<p className="mt-1 text-xs text-text-muted">
							Magic link by email or your wallet. No
							password to lose.
						</p>
						<p className="mt-2 text-[11px] text-text-muted">
							New user? Sending a magic link here also creates your account.
						</p>

						<div>
							{offline && (
								<div
									role="alert"
									aria-live="assertive"
									className="mt-4 flex items-start gap-2 rounded-[var(--radius-lg)] border border-warning/30 bg-[color-mix(in_srgb,var(--color-warning)_10%,transparent)] px-4 py-3"
								>
									<AlertTriangle
										className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-warning)]"
										aria-hidden="true"
									/>
									<div className="text-xs text-text-primary">
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
									className="mt-4 rounded-[var(--radius-lg)] border border-[var(--color-error)]/30 bg-[color-mix(in_srgb,var(--color-error)_10%,transparent)] p-3 text-xs text-[var(--color-error)]"
								>
									{error}
								</div>
							)}
						</div>

						<div
							role="tablist"
							aria-label="Authentication method"
							className="mt-5 grid grid-cols-2 gap-1 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-1"
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

						</div>

						<div className="mt-5">
							{method === "magic" && (
								<div
									role="tabpanel"
									id="panel-magic"
									aria-labelledby="tab-magic"
								>
									<form
										onSubmit={handleMagic}
										className="space-y-3"
									>
									<label
										htmlFor="email"
										className="block text-xs font-medium uppercase tracking-wider text-text-secondary"
									>
										Email address
									</label>
									<input
										id="email"
										name="email"
										type="email"
										autoComplete="email"
										inputMode="email"
										placeholder="you@example.com"
										value={email}
										onChange={(e) => {
											setEmail(e.target.value.trim());
											if (magicSent) setMagicSent(false);
										}}
										required
										// React 19 may disagree with the browser on an empty style attr
										// during hydration of controlled inputs — suppress the noise.
										suppressHydrationWarning
										className="w-full rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-void)] px-3 py-3 text-sm placeholder:text-text-muted focus:border-[var(--color-accent)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20"
									/>
									<button
										type="submit"
										disabled={submitting || offline}
										className="btn-primary min-h-12 w-full justify-center disabled:cursor-not-allowed disabled:opacity-50"
									>
										{submitting ? (
											<>
												<Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
												Sending…
											</>
										) : (
											"Send magic link"
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
								</div>
							)}

							{method === "wallet" && (
								<div
									role="tabpanel"
									id="panel-wallet"
									aria-labelledby="tab-wallet"
								>
									<LazyWalletSignInPanel
										next={next}
										offline={offline}
										submitting={submitting}
										setSubmitting={setSubmitting}
										onError={handleError}
										onSuccess={(msg) => toast.success(msg)}
										onRedirect={(url) => router.replace(url)}
									/>
								</div>
							)}
						</div>
					</div>
					<div className="mt-6">
						<X402Callout />
					</div>
					<p className="mt-6 text-center text-xs text-text-muted">
						By signing in you accept the{" "}
						<Link href="/terms" className="text-[var(--color-accent)] underline decoration-[var(--color-accent)] opacity-60 underline-offset-2 hover:decoration-[var(--color-accent)]">
							Terms
						</Link>
						,{" "}
						<Link href="/privacy" className="text-[var(--color-accent)] underline decoration-[var(--color-accent)] opacity-60 underline-offset-2 hover:decoration-[var(--color-accent)]">
							Privacy Policy
						</Link>
						, and{" "}
						<Link href="/terms#acceptable-use" className="text-[var(--color-accent)] underline decoration-[var(--color-accent)] opacity-60 underline-offset-2 hover:decoration-[var(--color-accent)]">
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
	const panelId = `panel-${id.replace("tab-", "")}`;
	return (
		<button
			type="button"
			id={id}
			role="tab"
			aria-selected={selected}
			aria-controls={panelId}
			onClick={onSelect}
			className={`inline-flex items-center justify-center gap-2 rounded-[var(--radius-sm)] px-3 py-3 min-h-11 text-xs font-semibold transition-[color,background-color,box-shadow,transform] duration-200 ease-out active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] ${
				selected
					? "bg-[var(--color-accent)] text-[var(--color-accent-fg)] shadow-[0_0_15px_-5px_var(--color-accent-glow)]"
					: "text-text-muted hover:text-text-primary"
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
			body: "Credits in USDC on Base. x402 settlement for agents — wallet-based.",
		},
	];
	return (
		<div className="order-last space-y-6 lg:order-none">
			<div className="surface-card p-8">
				<OmaWordmark size="md" />
				<h1 className="mt-6 display-headline text-text-bright">
					Sign in once.{" "}
					<span className="text-accent">Ship without friction.</span>
				</h1>
				<p className="mt-3 text-sm text-text-secondary">
					One OpenAI-compatible gateway. Magic link or wallet, credits by USDC on Base, x402 for agents.
				</p>
				<ul className="mt-6 space-y-4">
					{items.map(({ Icon, title, body }) => (
						<li key={title} className="flex items-start gap-3">
							<span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-accent)]/20 bg-[color-mix(in_srgb,var(--color-accent)_10%,transparent)] text-[var(--color-accent)] shadow-[0_0_15px_-5px_var(--color-accent-glow)]">
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
		<div className="rounded-[var(--radius-xl)] border border-[var(--color-accent)]/25 bg-[color-mix(in_srgb,var(--color-accent)_5%,transparent)] p-5 shadow-[0_18px_44px_-32px_var(--color-accent-glow)]">
			<div className="flex items-start gap-3">
				<span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-lg)] border border-[var(--color-accent)]/30 bg-[color-mix(in_srgb,var(--color-accent)_10%,transparent)] text-[var(--color-accent)]">
					<Sparkles className="h-4 w-4" aria-hidden="true" />
				</span>
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-2">
						<p className="text-sm font-semibold text-text-bright">
							Fund with x402 (agents)
						</p>
						<span className="rounded-[var(--radius-sm)] border border-[var(--color-accent)]/30 bg-[color-mix(in_srgb,var(--color-accent)_10%,transparent)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-[var(--color-accent)]">
							Agents
						</span>
					</div>
					<p className="mt-1 text-[11px] leading-relaxed text-text-muted">
						Sign an EIP-3009 USDC authorization on Base, verify with{" "}
						<code className="font-mono text-text-secondary">
							PAYMENT-SIGNATURE
						</code>
						, settle from a session to credit your balance, then spend with an
						API key. Wallet-based, no card needed; facilitator pays gas.
					</p>
					<Link
						href="/docs#x402"
						className="mt-2.5 inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--color-accent)] hover:underline underline-offset-2 transition-colors duration-200 ease-out hover:text-[var(--color-accent-hover)]"
					>
						How x402 works
						<ArrowRight className="h-3 w-3" aria-hidden="true" />
					</Link>
				</div>
			</div>
		</div>
	);
}
