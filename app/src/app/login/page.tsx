"use client";

import { m, useReducedMotion } from "framer-motion";
import {
	AlertTriangle,
	KeyRound,
	Loader2,
	RefreshCw,
	Shield,
	Wallet,
	Zap,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import {
	Suspense,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import { AccountLoginModal } from "@/components/account-login-modal";
import { useApiHealth } from "@/components/api-status";
import { useWallet } from "@/components/wallet-provider";
import { api } from "@/lib/api";
import { fadeUpProps } from "@/lib/motion";
import { safeNextPath } from "@/lib/safe-next-path";

/**
 * /login — wallet OR account-number authentication entry point.
 *
 * Two tabs, one for each auth method:
 *   - "Wallet" (default): SIWE (Sign-In With Ethereum) on Base mainnet. Connecting
 *     a wallet proves ownership, signs a nonce-bound message, and the server
 *     issues a JWT cookie. This page exists for /protected?next=... redirects
 *     and external links.
 *   - "Account number" (Mullvad-style): no email, no password, no PII. The user
 *     either pastes a previously-saved OMA-XXXX-XXXX-XXXX number or generates a
 *     fresh one. The server creates a "standalone" user row keyed by the
 *     number's SHA-256 hash and issues a JWT.
 *
 * The two flows share a session — the JWT cookie set by either path is honored
 * by the same `sessionAuth` middleware. A user can later prove wallet ownership
 * via SIWE and link that wallet to their account-number-only row.
 *
 * A-C1: We pre-fetch the CSRF token on mount and pass it into the modal so
 * pressing Enter in the account-number field never races the token fetch.
 */
type AuthTab = "wallet" | "account";

function LoginInner() {
	const router = useRouter();
	const params = useSearchParams();
	const {
		isReady,
		isConnected,
		isAuthenticated,
		isAuthenticating,
		connectEvm,
	} = useWallet();
	// H-LOGIN-1: validate `next` so an attacker can't redirect a freshly-signed-in
	// user off-site. Must be a same-origin single-leading-slash path; reject
	// protocol-relative `//evil.com`, backslash tricks, and double-encoded
	// variants. Implementation + tests in `lib/safe-next-path.ts`.
	const rawNext = params.get("next") || "/dashboard";
	const next = safeNextPath(rawNext);
	const initialTab = (
		params.get("method") === "account" ? "account" : "wallet"
	) as AuthTab;
	const [tab, setTab] = useState<AuthTab>(initialTab);
	const [csrfToken, setCsrfToken] = useState<string | null>(null);
	const [csrfError, setCsrfError] = useState(false);
	const [walletError, setWalletError] = useState<string | null>(null);
	const [isConnectingWallet, setIsConnectingWallet] = useState(false);
	const walletTabRef = useRef<HTMLButtonElement>(null);
	const accountTabRef = useRef<HTMLButtonElement>(null);
	const prefersReducedMotion = useReducedMotion();

	// Backend health: shows an "API is offline" banner if the API is
	// unreachable. Disabled auth methods in that case so the user doesn't
	// burn through wallet popups on a network that's not responding.
	const { status: apiStatus, refresh: refreshApiHealth } = useApiHealth();

	// Bounce to `next` once authenticated.
	useEffect(() => {
		if (isAuthenticated) router.replace(next);
	}, [isAuthenticated, next, router]);

	// A-C1: pre-fetch CSRF token on mount so the modal has it synchronously.
	// If the pre-fetch fails, surface a warning so the user isn't left
	// wondering why the form is broken — the modal will fall back to its
	// own fetch, which may also fail.
	useEffect(() => {
		let cancelled = false;
		api.auth
			.getCsrfToken()
			.then((res) => {
				if (!cancelled && res.token) {
					setCsrfToken(res.token);
					setCsrfError(false);
				}
			})
			.catch((err) => {
				if (cancelled) return;
				console.warn("CSRF pre-fetch failed:", err);
				setCsrfError(true);
			});
		return () => {
			cancelled = true;
		};
	}, []);

	// WAI-ARIA tab pattern: arrow keys move between tabs, Home/End jump to
	// the first/last tab. The browser's default Tab key already moves focus
	// out of the tablist, so we only need to handle the in-list navigation.
	const onTabKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLButtonElement>) => {
			if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
				return;
			}
			e.preventDefault();
			const tabs: Array<{ ref: React.RefObject<HTMLButtonElement | null>; value: AuthTab }> = [
				{ ref: walletTabRef, value: "wallet" },
				{ ref: accountTabRef, value: "account" },
			];
			const currentIndex = tabs.findIndex(
				(t) => t.ref.current === e.currentTarget,
			);
			if (currentIndex === -1) return;
			let nextIndex = currentIndex;
			if (e.key === "ArrowRight") nextIndex = (currentIndex + 1) % tabs.length;
			else if (e.key === "ArrowLeft")
				nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
			else if (e.key === "Home") nextIndex = 0;
			else if (e.key === "End") nextIndex = tabs.length - 1;
			const target = tabs[nextIndex];
			setTab(target.value);
			// Move focus to the newly-selected tab. Per WAI-ARIA APG, focus
			// follows selection on tablist navigation.
			target.ref.current?.focus();
		},
		[],
	);

	const handleConnect = async () => {
		setWalletError(null);
		setIsConnectingWallet(true);
		try {
			await connectEvm();
		} catch (e) {
			// wagmi rejects when the user dismisses the wallet picker, the
			// extension is locked, or the chain is wrong. Surface a clear,
			// actionable message — silently `console.error`-ing and bouncing
			// the user back is a real UX failure mode.
			const err = e as { code?: number; shortMessage?: string; message?: string };
			if (
				err.code === 4001 ||
				err.message?.toLowerCase().includes("user rejected") ||
				err.message?.toLowerCase().includes("user denied")
			) {
				setWalletError("Connection cancelled. Click again to retry.");
			} else if (
				err.message?.toLowerCase().includes("wallet") &&
				!err.message?.toLowerCase().includes("chain")
			) {
				setWalletError(
					"No wallet detected. Install MetaMask or Coinbase Wallet, then refresh.",
				);
			} else {
				setWalletError(
					err.shortMessage ||
						err.message ||
						"Couldn't connect to wallet. Please try again.",
				);
			}
		} finally {
			setIsConnectingWallet(false);
		}
	};

	const offline = apiStatus === "offline";

	return (
		<div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-10 sm:py-16">
			<m.div {...fadeUpProps(0)} className="w-full max-w-md">
				<div className="text-center mb-8">
					<m.div
						// Respect prefers-reduced-motion: the spring animation on
						// the shield icon is decorative; honor the OS-level
						// accessibility setting and skip it.
						initial={prefersReducedMotion ? false : { scale: 0.8, opacity: 0 }}
						animate={prefersReducedMotion ? false : { scale: 1, opacity: 1 }}
						transition={
							prefersReducedMotion
								? { duration: 0 }
								: { type: "spring", stiffness: 260, damping: 20 }
						}
						className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 text-accent border border-accent/20 mb-4 glow-accent-sm"
					>
						<Shield className="h-6 w-6" aria-hidden="true" />
					</m.div>
					<h1 className="h1-utility text-text-bright">Sign in</h1>
					<p className="mt-3 text-sm text-text-secondary leading-relaxed">
						OMA doesn&apos;t use email or password. Sign in with a wallet, or
						with a Mullvad-style account number generated on the fly. No PII
						collected.
					</p>
				</div>

				{offline && (
					<div
						role="alert"
						aria-live="assertive"
						className="mb-4 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3"
					>
						<AlertTriangle
							className="h-4 w-4 shrink-0 text-warning mt-0.5"
							aria-hidden="true"
						/>
						<div className="flex-1 text-xs text-text leading-relaxed">
							<p className="font-semibold mb-1">API is offline</p>
							<p className="text-text-muted">
								Sign-in is temporarily unavailable. Auto-retrying every
								30s, or click below to retry now.
							</p>
							<button
								type="button"
								onClick={refreshApiHealth}
								className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-semibold text-warning hover:underline underline-offset-2"
							>
								<RefreshCw className="h-3 w-3" aria-hidden="true" />
								Retry connection
							</button>
						</div>
					</div>
				)}

				{csrfError && !offline && (
					<div
						role="status"
						aria-live="polite"
						className="mb-4 flex items-start gap-2 rounded-lg border border-border bg-surface px-4 py-2.5"
					>
						<p className="text-[11px] text-text-muted">
							CSRF token pre-fetch failed — sign-in via account number may not
							work. Try the wallet tab or refresh the page.
						</p>
					</div>
				)}

				{/* Tabs */}
				<div
					role="tablist"
					aria-label="Authentication method"
					className="mb-4 grid grid-cols-2 gap-1 rounded-lg border border-border bg-surface p-1"
				>
					<button
						type="button"
						id="tab-wallet"
						role="tab"
						ref={walletTabRef}
						aria-selected={tab === "wallet"}
						aria-controls="panel-wallet"
						tabIndex={tab === "wallet" ? 0 : -1}
						onClick={() => setTab("wallet")}
						onKeyDown={onTabKeyDown}
						className={
							"inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-semibold transition-colors cursor-pointer " +
							(tab === "wallet"
								? "bg-accent text-void shadow-sm"
								: "text-text-muted hover:text-text")
						}
					>
						<Wallet className="h-3.5 w-3.5" aria-hidden="true" />
						Wallet
					</button>
					<button
						type="button"
						id="tab-account"
						role="tab"
						ref={accountTabRef}
						aria-selected={tab === "account"}
						aria-controls="panel-account"
						tabIndex={tab === "account" ? 0 : -1}
						onClick={() => setTab("account")}
						onKeyDown={onTabKeyDown}
						className={
							"inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-semibold transition-colors cursor-pointer " +
							(tab === "account"
								? "bg-accent text-void shadow-sm"
								: "text-text-muted hover:text-text")
						}
					>
						<KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
						Account number
					</button>
				</div>

				{/* Tab panels — both rendered, hidden via the `hidden` attribute
            on the inactive one. WAI-ARIA APG prefers this over conditional
            rendering so `aria-controls` always resolves to a live element
            and tab switches don't re-mount the panel (preserves form
            state, focus history, and animation continuity). */}
				<div
					id="panel-wallet"
					role="tabpanel"
					aria-labelledby="tab-wallet"
					hidden={tab !== "wallet"}
					className="border border-border bg-surface p-6 space-y-3"
				>
					<button
						type="button"
						onClick={handleConnect}
						disabled={!isReady || offline || isConnectingWallet || isAuthenticating}
						aria-busy={isConnectingWallet || isAuthenticating}
						title={
							offline
								? "API is offline — sign-in is temporarily unavailable"
								: undefined
						}
						className="btn-primary w-full inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{isConnectingWallet || isAuthenticating ? (
							<>
								<Loader2 className="h-4 w-4 animate-spin" />
								{isAuthenticating ? "Signing message..." : "Connecting..."}
							</>
						) : (
							<>
								<Wallet className="h-4 w-4" aria-hidden="true" />
								{isConnected ? "Sign in with Ethereum" : "Connect Wallet"}
							</>
						)}
					</button>

					{walletError && (
						<p
							role="alert"
							aria-live="assertive"
							className="text-[11px] text-red text-center"
						>
							{walletError}
						</p>
					)}

					<p className="text-[11px] text-text-muted text-center pt-2">
						A SIWE signature proves wallet ownership. No transaction is sent.
					</p>
				</div>

				<div
					id="panel-account"
					role="tabpanel"
					aria-labelledby="tab-account"
					hidden={tab !== "account"}
				>
					{/* AccountLoginModal in `inline` mode: same login/create/success flow
              as the global modal, but rendered without the fixed backdrop so it
              fits naturally inside the tab panel. `onClose` is a no-op in
              inline mode — the user switches tabs via the tab buttons above.
              `skipCsrfFetch` suppresses the modal's own CSRF fetch because the
              page already pre-fetches on mount (avoids a duplicate request). */}
					<AccountLoginModal
						onClose={() => {}}
						inline
						initialCsrfToken={csrfToken}
						skipCsrfFetch
					/>
				</div>

				<p className="mt-6 text-xs text-text-muted text-center">
					New here?{" "}
					<a
						href="/docs"
						className="text-text-secondary hover:text-accent underline underline-offset-2"
					>
						Read the docs
					</a>{" "}
					to see how OMA works.
				</p>

				{/* x402 pay-as-you-go: skip login, pay per request. No account needed. */}
				<div className="mt-4 rounded-lg border border-accent/20 bg-accent/5 p-4">
					<div className="flex items-start gap-3">
						<Zap
							className="h-4 w-4 text-accent shrink-0 mt-0.5"
							aria-hidden="true"
						/>
						<div className="flex-1 min-w-0">
							<p className="text-xs font-semibold text-text-bright">
								Skip login — pay per request with x402
							</p>
							<p className="mt-1 text-[11px] text-text-muted leading-relaxed">
								Hit any OMA endpoint directly with an{" "}
								<code className="font-mono text-text-secondary">X-PAYMENT</code>{" "}
								header on Base. No signup, no account, no JWT. Best for AI
								agents and one-off calls.
							</p>
							<a
								href="/docs#x402"
								className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-accent hover:underline underline-offset-2"
							>
								How x402 works →
							</a>
						</div>
					</div>
				</div>
			</m.div>
		</div>
	);
}

export default function LoginPage() {
	return (
		<Suspense
			fallback={<div className="min-h-[calc(100vh-4rem)]" aria-hidden="true" />}
		>
			<LoginInner />
		</Suspense>
	);
}
