"use client";

/**
 * /login — wallet (SIWE) or Mullvad-style account-number entry point.
 *
 * Layout
 * ------
 * Two-column on desktop (≥ md): a brand pitch on the left and the auth
 * card on the right. Mobile stacks brand-first so the value prop reads
 * immediately on small screens.
 *
 * Above the auth card (both viewports) sits the x402 callout so the
 * "skip login" path reads as a peer of the Wallet / Account tabs rather
 * than a footer footnote.
 *
 * Auth methods (all three routes are real, all verified against the
 * backend):
 *
 *   1. Wallet (default) — SIWE on Base mainnet via wagmi. User picks a
 *      connector, approves the wallet popup, then signs an EIP-4361
 *      nonce-bound message. JWT cookie issued on `/api/auth/verify`.
 *
 *   2. Account number — paste or generate a 16-digit Mullvad-style
 *      identifier. Server stores a SHA-256 hash, no PII. Reuses the
 *      existing `AccountLoginModal` in `inline` mode.
 *
 *   3. x402 (no account) — any OMA endpoint accepts an `X-PAYMENT`
 *      header on Base. Linked from the callout; not a form on this page.
 *
 * Cross-cutting concerns
 * ----------------------
 *   - CSRF token is pre-fetched on mount so the account-number login has
 *     no first-click latency (A-C1). Failures surface a warning banner
 *     with a Retry button; while in-flight, a tiny "Preparing…" line.
 *   - The SIWE message preview is built locally using the same
 *     EIP-4361 structure the wallet-provider signs. We never see the
 *     server-issued nonce before the actual sign — we show a structurally
 *     accurate preview so the user can audit the *format*.
 *   - Specific error shapes for user-rejected / wrong-network /
 *     rate-limit / network-down come from `shapeAuthError`.
 *   - `useReducedMotion` honored globally; all entry animations gated.
 *
 * TODO(2FA)
 * ---------
 * Account-number login doesn't currently expose a TOTP step. When the
 * server-side flag (`users.two_factor_enabled`) lands and the
 * `/api/auth/account/login` endpoint starts returning
 * `{ requiresTwoFactor: true }` instead of issuing a session, this page
 * needs to:
 *   1. Catch that response shape in `AccountLoginModal.handleLogin`
 *      and surface a 6-digit TOTP input below the account-number field.
 *   2. Auto-advance each digit, paste-fill, and resubmit with
 *      `{ accountNumber, totpCode }`.
 *   3. On success, fall through to the existing cookie-set path.
 * Until the server supports it, leaving a hook here is wasteful — the
 * audit log is the source of truth.
 *
 * See `app/src/components/auth/` for the shared primitives this page
 * composes.
 */

import { m, useReducedMotion } from "framer-motion";
import {
	AlertTriangle,
	ArrowRight,
	Loader2,
	type LucideIcon,
	RefreshCw,
	Shield,
	ShieldCheck,
	Sparkles,
	Wallet as WalletIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
	forwardRef,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { SiweMessage } from "siwe";
import { base as baseChain } from "wagmi/chains";
import { AccountLoginModal } from "@/components/account-login-modal";
import { useApiHealth } from "@/components/api-status";
import {
	AuthError,
	SiwePreview,
	shapeAuthError,
	WalletPicker,
	WalletStatus,
} from "@/components/auth";
import { OmaLogo } from "@/components/ui/oma-logo";
import { useWallet } from "@/components/wallet-provider";
import { api } from "@/lib/api";
import { log } from "@/lib/logger";
import { fadeUpProps } from "@/lib/motion";
import { safeNextPath } from "@/lib/safe-next-path";

type AuthTab = "wallet" | "account";

/**
 * Build a structurally accurate SIWE message for *preview purposes*.
 *
 * The actual signed payload comes from `wallet-provider.tsx` and includes
 * a fresh server-issued nonce we can't predict. The fields below are
 * deterministic per (browser, wallet, page) session: domain, address,
 * chain id, statement. Showing the user this preview tells them the
 * *format* they're signing — what fields, what values, what they
 * authorize (the OMA Terms of Service statement).
 */
function buildPreviewSiweMessage(address: `0x${string}`): string {
	// Mirror wallet-provider: browser origin first so the preview matches
	// the SIWE domain the user will actually sign.
	const fallback =
		process.env.NEXT_PUBLIC_APP_URL ||
		(typeof window !== "undefined" ? window.location.origin : "https://oma-ai.com");
	const appUrl =
		typeof window !== "undefined" ? window.location.origin : fallback;
	let url: URL;
	try {
		url = new URL(appUrl);
	} catch {
		url = new URL("https://oma-ai.com");
	}
	// Note: nonce value below is illustrative. The real nonce comes from
	// the server during the actual sign flow (`/api/auth/nonce`).
	const msg = new SiweMessage({
		domain: url.hostname,
		address,
		uri: url.origin,
		version: "1",
		chainId: baseChain.id,
		nonce: "<server-issued nonce>",
		statement: "I accept the OMA Terms of Service",
		issuedAt: new Date().toISOString(),
	});
	return msg.toMessage();
}

/* =====================================================================
   LoginInner — the page body
   ===================================================================== */

function LoginInner() {
	const router = useRouter();
	const {
		isReady,
		isAuthenticated,
		isAuthenticating,
		isConnecting,
		connectEvm,
		disconnect,
		evmAddress,
		evmChain,
		availableConnectors,
	} = useWallet();

	const [next, setNext] = useState("/dashboard");
	const [tab, setTab] = useState<AuthTab>("wallet");

	useEffect(() => {
		if (typeof window === "undefined") return;
		const params = new URLSearchParams(window.location.search);
		setNext(safeNextPath(params.get("next") || "/dashboard"));
		setTab(params.get("method") === "account" ? "account" : "wallet");
	}, []);

	const [csrfToken, setCsrfToken] = useState<string | null>(null);
	const [csrfError, setCsrfError] = useState(false);
	const [csrfPreparing, setCsrfPreparing] = useState(true);

	// A-C1: pre-fetch CSRF token on mount (race-free account-number flow).
	// Hoisted into a stable callback so the inline "Retry" button on the
	// CSRF error banner can re-run it without rebuilding the page.
	const fetchCsrf = useCallback(() => {
		setCsrfPreparing(true);
		setCsrfError(false);
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
				// Expected when API is down (placeholder DATABASE_URL / offline).
				// UI surfaces csrfError + offline banner; avoid noisy console.
				log.debug("CSRF pre-fetch failed", err);
				setCsrfError(true);
			})
			.finally(() => {
				if (!cancelled) setCsrfPreparing(false);
			});
		return () => {
			cancelled = true;
		};
	}, []);

	useEffect(() => {
		return fetchCsrf();
	}, [fetchCsrf]);

	const [walletError, setWalletError] = useState<unknown>(null);
	const [pickerOpen, setPickerOpen] = useState(false);
	const [pendingConnectorId, setPendingConnectorId] = useState<string | null>(
		null,
	);
	const walletTabRef = useRef<HTMLButtonElement>(null);
	const accountTabRef = useRef<HTMLButtonElement>(null);
	const triggerRef = useRef<HTMLButtonElement>(null);

	const { status: apiStatus, refresh: refreshApiHealth } = useApiHealth();
	const offline = apiStatus === "offline";

	const onTabKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLButtonElement>) => {
			if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
			e.preventDefault();
			const tabs: Array<{
				ref: React.RefObject<HTMLButtonElement | null>;
				value: AuthTab;
			}> = [
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
			target.ref.current?.focus();
		},
		[],
	);

	// Bounce to `next` once authenticated.
	useEffect(() => {
		if (isAuthenticated) router.replace(next);
	}, [isAuthenticated, next, router]);

	const handleConnectorSelect = useCallback(
		async (id: string) => {
			setWalletError(null);
			setPendingConnectorId(id);
			setPickerOpen(false);
			try {
				await connectEvm(id);
				// wallet-provider's effect will run SIWE automatically.
			} catch (e) {
				setWalletError(shapeAuthError(e));
			} finally {
				setPendingConnectorId(null);
				triggerRef.current?.focus();
			}
		},
		[connectEvm],
	);

	const handleSwitchWallet = useCallback(() => {
		setWalletError(null);
		setPickerOpen(true);
	}, []);

	const handleDisconnect = useCallback(async () => {
		setWalletError(null);
		try {
			await disconnect();
		} catch (e) {
			setWalletError(shapeAuthError(e));
		}
	}, [disconnect]);

	const previewMessage = useMemo(
		() => (evmAddress ? buildPreviewSiweMessage(evmAddress) : ""),
		[evmAddress],
	);

	const walletPanelState: "disconnected" | "authenticating" | "connected" =
		isAuthenticating
			? "authenticating"
			: isAuthenticated
				? "connected"
				: "disconnected";

	return (
		<div className="page-shell relative flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center">
			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
			>
				<div className="absolute inset-0 bg-grid opacity-[0.18] mask-radial" />
				<div className="absolute -left-24 top-8 h-80 w-80 rounded-full bg-accent/12 blur-[120px]" />
				<div className="absolute right-[-4rem] top-1/3 h-72 w-72 rounded-full bg-tertiary/10 blur-[120px]" />
				<div className="absolute -bottom-20 left-1/3 h-80 w-80 rounded-full bg-secondary/8 blur-[140px]" />
			</div>

			<div className="container-page grid w-full max-w-6xl grid-cols-1 items-center gap-8 py-4 md:grid-cols-[1.08fr_0.92fr] md:gap-10">
				<BrandPitch />
				<div className="mx-auto w-full max-w-md space-y-6">
					<X402Callout />
					<LoginCard
						tab={tab}
						setTab={setTab}
						offline={offline}
						refreshApiHealth={refreshApiHealth}
						csrfError={csrfError}
						csrfPreparing={csrfPreparing || !isReady}
						retryCsrf={fetchCsrf}
						csrfToken={csrfToken}
						onTabKeyDown={onTabKeyDown}
						walletTabRef={walletTabRef}
						accountTabRef={accountTabRef}
						walletPanelState={walletPanelState}
						evmAddress={evmAddress}
						evmChain={evmChain}
						previewMessage={previewMessage}
						isConnecting={isConnecting || !isReady}
						pendingConnectorId={pendingConnectorId}
						availableConnectors={availableConnectors}
						pickerOpen={pickerOpen}
						setPickerOpen={setPickerOpen}
						triggerRef={triggerRef}
						onConnectorSelect={handleConnectorSelect}
						onSwitchWallet={handleSwitchWallet}
						onDisconnect={handleDisconnect}
						walletError={walletError}
						onDismissWalletError={() => setWalletError(null)}
					/>
				</div>
			</div>

			<WalletPicker
				open={pickerOpen}
				connectors={availableConnectors}
				pendingId={pendingConnectorId}
				onSelect={handleConnectorSelect}
				onClose={() => {
					setPickerOpen(false);
					triggerRef.current?.focus();
				}}
			/>
		</div>
	);
}

/* =====================================================================
   X402Callout — third sign-in path, lifted above the auth card so it
   reads as a peer of the Wallet / Account tabs rather than a footer
   footnote. Documented at /docs#x402.
   ===================================================================== */

function X402Callout() {
	return (
		<m.div
			{...fadeUpProps(0)}
			className="rounded-[var(--radius-md)] border border-accent/25 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--color-accent)_10%,transparent)_0%,color-mix(in_srgb,var(--color-panel)_92%,transparent)_100%)] p-5 shadow-[0_18px_44px_-32px_var(--color-accent-glow)]"
		>
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
						Call any OMA endpoint with an{" "}
						<code className="font-mono text-text-secondary">X-PAYMENT</code>{" "}
						header on Base. Agent-native USDC settlement — no pre-funded
						credits or session cookie required.
					</p>
					<a
						href="/docs#x402"
						className="mt-2.5 inline-flex items-center gap-1 text-[11px] font-semibold text-accent hover:underline underline-offset-2"
					>
						How x402 works
						<ArrowRight className="h-3 w-3" aria-hidden="true" />
					</a>
				</div>
			</div>
		</m.div>
	);
}

/* =====================================================================
   BrandPitch — left column on desktop
   ===================================================================== */

function BrandPitch() {
	const items: Array<{ Icon: LucideIcon; title: string; body: string }> = [
		{
			Icon: ShieldCheck,
			title: "Low-friction signup.",
			body: "Wallet (SIWE) or a 16-digit account number. No email gate, no password to leak.",
		},
		{
			Icon: Sparkles,
			title: "One gateway. Every model.",
			body: "OpenAI-compatible API. Multi-provider routing with circuit-breaker failover.",
		},
		{
			Icon: Shield,
			title: "Crypto-native billing.",
			body: "Credits in USDC on Base. x402 pay-per-request for agents — no pre-fund required.",
		},
	];

	return (
		<m.section
			{...fadeUpProps(0)}
			aria-labelledby="brand-heading"
		>
			{/* Compact brand banner on mobile */}
			<div className="mb-6 text-center md:hidden">
				<div className="mb-3 flex justify-center">
					<span className="inline-flex rounded-xl border border-accent/25 bg-accent/8 p-2">
						<OmaLogo size="md" />
					</span>
				</div>
				<h1 className="text-2xl font-bold text-text-bright">
					Sign in to <span className="text-accent">oma</span>
				</h1>
				<p className="mt-2 text-sm text-text-secondary">
					Open Model Access — USDC-metered inference for builders.
				</p>
			</div>

			{/* Full brand pitch on desktop */}
			<div className="hidden md:block">
				<div className="surface-card overflow-hidden p-8 lg:p-10">
					<div className="mb-6 flex items-center gap-3">
						<span className="inline-flex rounded-xl border border-accent/25 bg-accent/8 p-2 shadow-[0_0_24px_-8px_var(--color-accent-glow)]">
							<OmaLogo size="md" />
						</span>
						<span className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/6 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-accent">
							<Sparkles className="h-3 w-3" aria-hidden="true" />
							Open Model Access
						</span>
					</div>
					<h1
						id="brand-heading"
						className="display-headline max-w-xl text-[clamp(2.6rem,4.8vw,4.6rem)] text-text-bright"
					>
						Sign in once.
						<br />
						<span className="gradient-text-accent">Ship without friction.</span>
					</h1>
					<p className="mt-5 max-w-xl text-[1.03rem] leading-relaxed text-text-secondary">
						One OpenAI-compatible gateway. Wallet or account number, credits in
						USDC on Base, x402 for agents.
					</p>

					<ul className="mt-8 space-y-4">
						{items.map(({ Icon, title, body }) => (
							<li key={title} className="flex items-start gap-3">
								<span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-accent/20 bg-accent/10 text-accent">
									<Icon className="h-4 w-4" aria-hidden="true" />
								</span>
								<div>
									<p className="text-sm font-semibold text-text-bright">{title}</p>
									<p className="mt-1 text-sm leading-relaxed text-text-muted">
										{body}
									</p>
								</div>
							</li>
						))}
					</ul>

					<p className="mt-10 text-sm text-text-muted">
						No account? Just connect. New here?{" "}
						<Link
							href="/docs"
							className="text-accent hover:underline underline-offset-2"
						>
							Read the docs
						</Link>{" "}
						or skip auth entirely with{" "}
						<Link
							href="/docs#x402"
							className="text-accent hover:underline underline-offset-2"
						>
							x402
						</Link>
						.
					</p>
				</div>
			</div>
		</m.section>
	);
}

/* =====================================================================
   LoginCard — the auth form card
   ===================================================================== */

interface LoginCardProps {
	tab: AuthTab;
	setTab: (t: AuthTab) => void;
	offline: boolean;
	refreshApiHealth: () => void;
	csrfError: boolean;
	csrfPreparing: boolean;
	retryCsrf: () => void;
	csrfToken: string | null;
	onTabKeyDown: (e: React.KeyboardEvent<HTMLButtonElement>) => void;
	walletTabRef: React.RefObject<HTMLButtonElement | null>;
	accountTabRef: React.RefObject<HTMLButtonElement | null>;
	walletPanelState: "disconnected" | "authenticating" | "connected";
	evmAddress: `0x${string}` | undefined;
	evmChain: { id: number; name: string } | undefined;
	previewMessage: string;
	isConnecting: boolean;
	pendingConnectorId: string | null;
	availableConnectors: Array<{ id: string; name: string; icon?: string }>;
	pickerOpen: boolean;
	setPickerOpen: (b: boolean) => void;
	triggerRef: React.RefObject<HTMLButtonElement | null>;
	onConnectorSelect: (id: string) => void;
	onSwitchWallet: () => void;
	onDisconnect: () => void;
	walletError: unknown;
	onDismissWalletError: () => void;
}

function LoginCard(p: LoginCardProps) {
	const {
		tab,
		setTab,
		offline,
		refreshApiHealth,
		csrfError,
		csrfPreparing,
		retryCsrf,
		onTabKeyDown,
		walletTabRef,
		accountTabRef,
		walletPanelState,
		evmAddress,
		evmChain,
		previewMessage,
		isConnecting,
		pendingConnectorId,
		pickerOpen,
		setPickerOpen,
		triggerRef,
		onSwitchWallet,
		onDisconnect,
		walletError,
		onDismissWalletError,
		csrfToken,
	} = p;

	const isWrongChain = evmChain !== undefined && evmChain.id !== baseChain.id;
	const reduceMotion = useReducedMotion();
	const accountLoginAvailable = !offline && !csrfError && !!csrfToken;

	useEffect(() => {
		if (!accountLoginAvailable && tab === "account") {
			setTab("wallet");
		}
	}, [accountLoginAvailable, setTab, tab]);

	return (
		<div
			className={
				"surface-card rounded-[calc(var(--radius-lg)+2px)] bg-panel/95 p-6 shadow-[0_24px_72px_-42px_rgba(0,0,0,0.95)] backdrop-blur-sm sm:p-8 " +
				(reduceMotion ? "" : "")
			}
		>
			{/* Mobile-only mini brand — desktop hides this in favor of
                the left BrandPitch. */}
			<div className="mb-5 md:hidden">
				<div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-accent/30 bg-accent/10 text-accent">
					<Shield className="h-5 w-5" aria-hidden="true" />
				</div>
				<h2 className="text-xl font-bold text-text-bright">Sign in</h2>
				<p className="mt-1 text-xs text-text-muted">
					{accountLoginAvailable
						? "Wallet or private account number. SIWE on Base mainnet."
						: "Wallet sign-in is live now. Private account numbers return when auth bootstrap is healthy."}
				</p>
			</div>

			{/* Desktop-only card header. */}
			<div className="mb-5 hidden md:block">
				<h2 className="text-lg font-bold text-text-bright">
					Choose how to sign in
				</h2>
				<p className="mt-1 text-xs text-text-muted">
					{accountLoginAvailable
						? "Wallet or private account number. SIWE on Base mainnet."
						: "Wallet sign-in is available. Private account numbers re-enable automatically when auth bootstrap recovers."}
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
							Sign-in is temporarily unavailable. Auto-retrying every 30s.
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
					role="alert"
					aria-live="assertive"
					className="mb-4 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3"
				>
					<AlertTriangle
						className="mt-0.5 h-4 w-4 shrink-0 text-warning"
						aria-hidden="true"
					/>
					<div className="flex-1 text-xs text-text leading-relaxed">
						<p className="font-semibold mb-1">
							Private account numbers are temporarily unavailable
						</p>
						<p className="text-text-muted">
							We couldn&apos;t prepare the auth bootstrap for account-number
							sign-in. Wallet sign-in still works and is the fastest recovery
							path right now.
						</p>
						<button
							type="button"
							onClick={retryCsrf}
							className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-semibold text-warning hover:underline underline-offset-2"
						>
							<RefreshCw className="h-3 w-3" aria-hidden="true" />
							Retry CSRF pre-fetch
						</button>
					</div>
				</div>
			)}

			{csrfPreparing && !csrfError && !offline && (
				<p
					role="status"
					aria-live="polite"
					className="mb-3 flex items-center gap-1.5 text-[10px] text-text-muted"
				>
					<Loader2 className="h-2.5 w-2.5 animate-spin" aria-hidden="true" />
					Preparing account-number sign-in…
				</p>
			)}

			<div
				role="tablist"
				aria-label="Authentication method"
				className="mb-5 grid grid-cols-2 gap-1 rounded-lg border border-border bg-surface p-1"
			>
				<TabButton
					id="tab-wallet"
					ref={walletTabRef}
					label="Wallet"
					selected={tab === "wallet"}
					icon={<WalletIcon className="h-3.5 w-3.5" aria-hidden="true" />}
					onSelect={() => setTab("wallet")}
					onKeyDown={onTabKeyDown}
				/>
				<TabButton
					id="tab-account"
					ref={accountTabRef}
					label="Account number"
					selected={tab === "account"}
					icon={
						<span
							className="font-mono text-[11px] font-bold leading-none"
							aria-hidden="true"
						>
							#
						</span>
					}
					onSelect={() => {
						if (accountLoginAvailable) setTab("account");
					}}
					onKeyDown={onTabKeyDown}
					disabled={!accountLoginAvailable}
				/>
			</div>

			<div
				id="panel-wallet"
				role="tabpanel"
				aria-labelledby="tab-wallet"
				hidden={tab !== "wallet"}
				className="space-y-4"
			>
				{walletError !== null && (
					<AuthError
						error={walletError}
						onDismiss={onDismissWalletError}
						onRetry={() => {
							onDismissWalletError();
							triggerRef.current?.focus();
							setPickerOpen(true);
						}}
					/>
				)}

				{walletPanelState === "disconnected" && (
					<>
						<button
							ref={triggerRef}
							type="button"
							onClick={() => setPickerOpen(true)}
							disabled={offline}
							aria-haspopup="dialog"
							aria-expanded={pickerOpen}
							aria-controls="wallet-picker"
							title={offline ? "API is offline" : undefined}
							className="btn-primary inline-flex w-full items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
						>
							{isConnecting && pendingConnectorId ? (
								<>
									<Loader2 className="h-4 w-4 animate-spin" />
									Connecting…
								</>
							) : (
								<>
									<WalletIcon className="h-4 w-4" aria-hidden="true" />
									Connect Wallet
								</>
							)}
						</button>
						<p className="text-center text-[11px] text-text-muted">
							A SIWE signature proves wallet ownership. No transaction, no fee.
						</p>
					</>
				)}

				{walletPanelState === "authenticating" && (
					<>
						<button
							type="button"
							disabled
							aria-busy="true"
							className="btn-primary inline-flex w-full items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-70"
						>
							<Loader2 className="h-4 w-4 animate-spin" />
							Signing message…
						</button>
						{evmAddress && <SiwePreview message={previewMessage} isSigning />}
					</>
				)}

				{walletPanelState === "connected" && (
					<button
						type="button"
						disabled
						aria-busy="true"
						className="btn-primary inline-flex w-full items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-70"
					>
						<Loader2 className="h-4 w-4 animate-spin" />
						Signed in — redirecting…
					</button>
				)}

				{/* When the wallet is connected but we are not currently
                  authenticating, show the address/chain + switch +
                  disconnect controls. This covers the SIWE-failed-then-
                  user-wants-to-retry path AND the rare "connected but
                  never auto-signed" path. */}
				{evmAddress && walletPanelState !== "authenticating" && (
					<div className="space-y-3">
						<WalletStatus
							address={evmAddress}
							chain={evmChain}
							expectedId={baseChain.id}
						/>
						{isWrongChain && (
							<div
								role="alert"
								aria-live="polite"
								className="flex items-start gap-2 rounded-lg border border-red/30 bg-red/10 px-3 py-2 text-[11px] text-red"
							>
								<AlertTriangle
									className="mt-0.5 h-3.5 w-3.5 shrink-0"
									aria-hidden="true"
								/>
								<div>
									You&apos;re on {evmChain?.name}. OMA needs Base mainnet —
									switch networks in your wallet and try again.
								</div>
							</div>
						)}
						<div className="flex flex-col gap-2 sm:flex-row">
							<button
							type="button"
							onClick={onSwitchWallet}
							className="btn-secondary inline-flex flex-1 items-center justify-center gap-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
						>
								<WalletIcon className="h-3.5 w-3.5" aria-hidden="true" />
								Switch wallet
							</button>
							<button
								type="button"
								onClick={onDisconnect}
								className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-border bg-surface px-3 py-2.5 text-xs font-medium text-text-secondary transition-colors hover:border-red/30 hover:text-red"
							>
								Disconnect
							</button>
						</div>
						<details className="group rounded-lg border border-border/60 bg-surface/40">
							<summary className="cursor-pointer select-none px-3 py-2 text-[11px] font-medium text-text-secondary hover:text-text">
								View SIWE message format
							</summary>
							<div className="border-t border-border/40 p-3">
								<SiwePreview message={previewMessage} isSigning={false} />
							</div>
						</details>
					</div>
				)}
			</div>

			<div
				id="panel-account"
				role="tabpanel"
				aria-labelledby="tab-account"
				hidden={tab !== "account"}
			>
				<AccountLoginModal
					onClose={() => {}}
					inline
					initialCsrfToken={csrfToken}
					skipCsrfFetch
				/>
			</div>

			<p className="mt-6 text-center text-xs text-text-muted">
				{accountLoginAvailable ? (
					<>
						Wallet auth &amp; account-number auth share the same JWT — switch
						methods anytime from{" "}
						<Link
							href="/settings"
							className="text-text-secondary hover:text-accent underline underline-offset-2"
						>
							settings
						</Link>
						.
					</>
				) : (
					<>
						Wallet sign-in stays available while account-number auth recovers.
						Continue with SIWE, or open{" "}
						<Link
							href="/docs"
							className="text-text-secondary hover:text-accent underline underline-offset-2"
						>
							docs
						</Link>{" "}
						for recovery steps.
					</>
				)}
			</p>
		</div>
	);
}

/* =====================================================================
   TabButton — keyboard-navigable WAI-ARIA tab pattern
   ===================================================================== */

interface TabButtonProps {
	id: string;
	label: string;
	selected: boolean;
	icon: React.ReactNode;
	onSelect: () => void;
	onKeyDown: (e: React.KeyboardEvent<HTMLButtonElement>) => void;
	disabled?: boolean;
}

const TabButton = forwardRef<HTMLButtonElement, TabButtonProps>(
	function TabButton(
		{ id, label, selected, icon, onSelect, onKeyDown, disabled = false },
		ref,
	) {
		return (
			<button
				ref={ref}
				type="button"
				id={id}
				role="tab"
				aria-selected={selected}
				aria-controls={id.replace("tab-", "panel-")}
				aria-disabled={disabled}
				tabIndex={selected && !disabled ? 0 : -1}
				onClick={onSelect}
				onKeyDown={onKeyDown}
				disabled={disabled}
				className={
					"inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent " +
					(disabled
						? "cursor-not-allowed opacity-45 "
						: "cursor-pointer ") +
					(selected
						? "bg-accent text-void shadow-sm"
						: "text-text-muted hover:text-text")
				}
			>
				{icon}
				{label}
			</button>
		);
	},
);

/* =====================================================================
   Page wrapper — Suspense required for useSearchParams.
   ===================================================================== */

export default function LoginPage() {
	return <LoginInner />;
}
