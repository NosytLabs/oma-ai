"use client";

import {
	AlertTriangle,
	Check,
	Copy,
	Key,
	Loader2,
	Wallet,
	X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import {
	getSessionToken,
	setCsrfTokenCookie,
	setSessionCookie,
	setSessionMetaCookie,
} from "@/lib/cookies";

interface AccountLoginModalProps {
	onClose: () => void;
	/**
	 * Inline mode renders the modal contents without a fixed backdrop or
	 * position:fixed wrapper so the host page (e.g. /login tab panel) can
	 * embed it. `onClose` becomes a no-op since the user switches context
	 * via the host's own controls.
	 */
	inline?: boolean;
	/**
	 * CSRF token pre-fetched by the host page on mount. Required for `login`
	 * mode so the user can press Enter before any in-component async fetch
	 * completes (A-C1 race). When omitted, the modal falls back to fetching
	 * its own token on mount — the original (racey) behavior.
	 */
	initialCsrfToken?: string | null;
}

type Mode = "login" | "create" | "success";

export function AccountLoginModal({
	onClose,
	inline = false,
	initialCsrfToken = null,
}: AccountLoginModalProps) {
	const [mode, setMode] = useState<Mode>("login");
	const [accountNumber, setAccountNumber] = useState("");
	const [createdAccount, setCreatedAccount] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);
	const [csrfToken, setCsrfToken] = useState<string | null>(initialCsrfToken);
	const modalRef = useRef<HTMLDivElement>(null);
	const triggerRef = useRef<HTMLElement | null>(null);

	// L-A3: the host page passes an inline arrow `() => {}` for `onClose`,
	// which is a new function reference on every parent render. Listing it in
	// a useEffect dependency caused the effect to re-run on every parent
	// re-render (e.g. when the CSRF pre-fetch resolves), which removed+re-added
	// the keydown listener and stole focus from the input the user was typing
	// into. We capture the latest `onClose` in a ref so the keydown handler
	// always sees the latest callback without forcing the mount effect to
	// re-run.
	const onCloseRef = useRef(onClose);
	useEffect(() => {
		onCloseRef.current = onClose;
	}, [onClose]);

	// L-A3 (mount-only): keydown listener + initial focus + trigger capture.
	// Runs exactly once when the modal mounts, never on parent re-renders.
	useEffect(() => {
		triggerRef.current = document.activeElement as HTMLElement;

		const handleKeyDown = (e: KeyboardEvent) => {
			// L-A3 (inline): in inline mode there is no backdrop to dismiss, so
			// Escape falls back to blurring the active input — avoids stealing
			// focus via a no-op onClose and matches the WAI-ARIA dialog pattern.
			if (e.key === "Escape") {
				if (!inline) onCloseRef.current();
				else (document.activeElement as HTMLElement | null)?.blur?.();
				return;
			}

			if (e.key === "Tab" && modalRef.current) {
				const focusableElements =
					modalRef.current.querySelectorAll<HTMLElement>(
						'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
					);
				const firstElement = focusableElements[0];
				const lastElement = focusableElements[focusableElements.length - 1];

				if (e.shiftKey) {
					if (document.activeElement === firstElement) {
						e.preventDefault();
						lastElement.focus();
					}
				} else {
					if (document.activeElement === lastElement) {
						e.preventDefault();
						firstElement.focus();
					}
				}
			}
		};

		document.addEventListener("keydown", handleKeyDown);
		const firstFocusable = modalRef.current?.querySelector<HTMLElement>(
			'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
		);
		firstFocusable?.focus();

		return () => {
			document.removeEventListener("keydown", handleKeyDown);
			// Only restore focus to the trigger if it's still attached to the DOM.
			// Otherwise focus() on a detached node is a silent no-op and we've
			// already moved on (e.g. the host page navigated away).
			const trigger = triggerRef.current;
			if (trigger?.isConnected) trigger.focus();
		};
	}, [inline]);

	// L-A3 (CSRF fetch only): runs when the host-provided CSRF token changes
	// from null to a real value (or vice versa). On the /login page the host
	// pre-fetches the token on mount, so the modal typically never has to
	// fetch its own. When embedded elsewhere (e.g. the global header modal)
	// without `initialCsrfToken`, we fall back to fetching here. Critically,
	// this effect does NOT touch focus or the keydown listener.
	useEffect(() => {
		if (initialCsrfToken) {
			setCsrfToken(initialCsrfToken);
			return;
		}
		let cancelled = false;
		async function fetchCsrfToken() {
			try {
				const response = await api.auth.getCsrfToken();
				if (!cancelled && response.token) {
					setCsrfTokenCookie(response.token);
					setCsrfToken(response.token);
				}
			} catch (err) {
				if (!cancelled) console.error("Failed to fetch CSRF token:", err);
			}
		}
		fetchCsrfToken();
		return () => {
			cancelled = true;
		};
	}, [initialCsrfToken]);

	const handleLogin = useCallback(async () => {
		if (!accountNumber.trim()) return;
		setLoading(true);
		setError(null);
		try {
			const headers: Record<string, string> = {
				"Content-Type": "application/json",
			};
			// Fall back to reading the CSRF token directly from the cookie if the
			// React state hasn't been populated yet (race between pre-fetch and
			// user clicking Sign In). The cookie is set by /api/auth/csrf-token
			// on the same origin, so it's always available.
			let csrf = csrfToken;
			if (!csrf) {
				const m = document.cookie.match(/csrf_token=([^;]+)/);
				if (m) csrf = decodeURIComponent(m[1]);
			}
			if (csrf) {
				headers["x-csrf-token"] = csrf;
			}

			const res = await fetch(
				`${typeof window !== "undefined" ? "/api" : process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/auth/account/login`,
				{
					method: "POST",
					headers,
					body: JSON.stringify({
						accountNumber: accountNumber.trim().toUpperCase(),
					}),
				},
			);
			if (!res.ok) {
				const body = await res.json().catch(() => ({}));
				const msg =
					(body as { error?: { message?: string } })?.error?.message ||
					"Login failed";
				throw new Error(msg);
			}
			const data = (await res.json()) as { token: string };
			setSessionCookie(data.token, 7);
			// Populate the client-readable meta cookie so wallet-provider's
			// getStoredSession() sees authMethod='account-number' and flips
			// isAuthenticated to true. Without this, the dashboard renders the
			// "Connect Wallet" empty state even though the JWT is set.
			setSessionMetaCookie({ authMethod: "account-number" });
			window.location.reload();
		} catch (err: unknown) {
			setError(err instanceof Error ? err.message : "Login failed");
		} finally {
			setLoading(false);
		}
	}, [accountNumber, csrfToken]);

	const handleCreate = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			// /auth/account/create supports both modes: with a session it links
			// the new number to the current user; without a session it creates a
			// fresh "standalone" user row keyed by the number's SHA-256 hash and
			// returns a JWT. Either way the user ends up logged in.
			const headers: Record<string, string> = {
				"Content-Type": "application/json",
			};
			const token = getSessionToken();
			if (token) {
				headers.Authorization = `Bearer ${token}`;
			}

			const res = await fetch(
				`${typeof window !== "undefined" ? "/api" : process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/auth/account/create`,
				{
					method: "POST",
					headers,
				},
			);
			if (!res.ok) {
				const body = await res.json().catch(() => ({}));
				const msg =
					(body as { error?: { message?: string } })?.error?.message ||
					"Failed to create account";
				throw new Error(msg);
			}
			const data = (await res.json()) as {
				accountNumber: string;
				token?: string;
			};
			setCreatedAccount(data.accountNumber);
			if (data.token) {
				setSessionCookie(data.token, 7);
				// Populate the client-readable meta cookie so wallet-provider's
				// getStoredSession() sees authMethod='account-number' and flips
				// isAuthenticated to true. Without this, the dashboard renders the
				// "Connect Wallet" empty state even though the JWT is set.
				setSessionMetaCookie({ authMethod: "account-number" });
			}
			setMode("success");
		} catch (err: unknown) {
			setError(
				err instanceof Error ? err.message : "Failed to create account number",
			);
		} finally {
			setLoading(false);
		}
	}, []);

	const handleCopy = useCallback(() => {
		if (createdAccount) {
			navigator.clipboard.writeText(createdAccount);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		}
	}, [createdAccount]);

	const handleDone = useCallback(() => {
		// After a successful account-number creation, we just stored a new
		// session token. Reload so the wallet-provider picks it up and the
		// route guards (which read oma_session) recognize the user.
		if (createdAccount) {
			window.location.reload();
			return;
		}
		onClose();
	}, [createdAccount, onClose]);

	return (
		<>
			{!inline && (
				<div
					role="presentation"
					className="fixed inset-0 z-[100] bg-overlay/60 backdrop-blur-sm cursor-default"
					onClick={onClose}
				/>
			)}
			<div
				ref={modalRef}
				className={
					inline
						? "w-full border-accent/30 bg-panel border rounded-xl p-6"
						: "fixed inset-x-0 top-1/2 -translate-y-1/2 z-[101] mx-4 w-[calc(100%-2rem)] max-w-md border-accent/30 bg-panel border rounded-xl shadow-2xl"
				}
				onClick={(e) => e.stopPropagation()}
				role={inline ? undefined : "dialog"}
				aria-modal={inline ? undefined : "true"}
				aria-labelledby="modal-title"
			>
				<div className="flex items-center justify-between mb-4">
					<div className="flex items-center gap-3">
						<div className="flex h-10 w-10 items-center justify-center rounded-lg border border-accent/30 bg-accent/10">
							<Key className="h-5 w-5 text-accent" />
						</div>
						<div>
							<h3 id="modal-title" className="text-lg font-bold text-text">
								{mode === "login"
									? "Account Login"
									: mode === "create"
										? "Anonymous Account"
										: "Account Created"}
							</h3>
							<p className="text-xs text-text-muted">
								{mode === "login"
									? "Sign in with your anonymous account number"
									: mode === "create"
										? "No KYC, no email, no PII required"
										: "Save your account number"}
							</p>
						</div>
					</div>
					{!inline && (
						<button
							type="button"
							onClick={onClose}
							aria-label="Close modal"
							className="rounded-lg p-2.5 text-text-muted hover:bg-surface hover:text-text transition-colors cursor-pointer"
						>
							<X className="h-5 w-5" />
						</button>
					)}
				</div>

				{error && (
					<div
						id="account-error"
						role="alert"
						className="mb-4 flex items-center gap-2 rounded-lg border border-red/30 bg-red/10 px-4 py-3"
					>
						<AlertTriangle className="h-4 w-4 shrink-0 text-red" />
						<span className="text-sm text-red">{error}</span>
					</div>
				)}

				{mode === "login" && (
					<>
						<div className="mb-4">
							<label
								htmlFor="account-number-input"
								className="mb-2 block text-xs font-medium uppercase tracking-widest text-text-muted"
							>
								Account Number
							</label>
							<input
								id="account-number-input"
								name="accountNumber"
								type="text"
								value={accountNumber}
								onChange={(e) => setAccountNumber(e.target.value.toUpperCase())}
								onKeyDown={(e) => e.key === "Enter" && handleLogin()}
								placeholder="OMA-XXXX-XXXX-XXXX"
								aria-label="Account number"
								aria-invalid={!!error}
								aria-describedby={error ? "account-error" : undefined}
								className="w-full rounded-lg border border-border bg-surface px-4 py-3 font-mono text-lg tracking-wider placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/50 disabled:opacity-50"
								disabled={loading}
							/>
						</div>
						<button
							type="button"
							onClick={handleLogin}
							disabled={loading || !accountNumber.trim()}
							className="btn-primary w-full py-3 disabled:opacity-50 disabled:cursor-not-allowed"
						>
							{loading ? (
								<span className="flex items-center justify-center gap-2">
									<Loader2 className="h-4 w-4 animate-spin" />
									Signing in...
								</span>
							) : (
								"Sign In"
							)}
						</button>
						<p className="mt-4 text-center text-xs text-text-muted">
							No account number yet?{" "}
							<button
								type="button"
								onClick={() => {
									setMode("create");
									setError(null);
								}}
								className="text-accent hover:text-accent-bright cursor-pointer"
							>
								Create one
							</button>
						</p>
						<p className="mt-2 text-center text-[11px] text-text-muted/80">
							Mullvad-style: no email, no KYC, no PII. Just a number to write
							down.
						</p>
					</>
				)}

				{mode === "create" && (
					<>
						<div className="mb-4 rounded-lg border border-accent/30 bg-accent/10 px-4 py-3">
							<div className="flex items-start gap-3">
								<Key
									className="h-5 w-5 text-accent shrink-0 mt-0.5"
									aria-hidden="true"
								/>
								<div>
									<p className="text-sm font-medium text-text-bright mb-1">
										Anonymous account number
									</p>
									<p className="text-xs text-text-secondary leading-relaxed">
										No email. No KYC. No PII. Generates a Mullvad-style account
										number — write it down and use it to sign in on any device.
										Completely anonymous.
									</p>
								</div>
							</div>
						</div>
						<button
							type="button"
							onClick={handleCreate}
							disabled={loading}
							className="btn-primary w-full py-3 disabled:opacity-50 disabled:cursor-not-allowed"
						>
							{loading ? (
								<span className="flex items-center justify-center gap-2">
									<Loader2 className="h-4 w-4 animate-spin" />
									Creating...
								</span>
							) : (
								"Generate Anonymous Number"
							)}
						</button>
						<p className="mt-4 text-center text-xs text-text-muted">
							Already have an account number?{" "}
							<button
								type="button"
								onClick={() => {
									setMode("login");
									setError(null);
								}}
								className="text-accent hover:text-accent-bright cursor-pointer"
							>
								Sign in
							</button>
						</p>
					</>
				)}

				{mode === "success" && createdAccount && (
					<>
						<div className="mb-4 rounded-lg border border-success/30 bg-success/10 px-4 py-3">
							<div className="flex items-start gap-3">
								<Check
									className="h-5 w-5 text-success shrink-0 mt-0.5"
									aria-hidden="true"
								/>
								<div>
									<p className="text-sm text-success font-medium mb-1">
										Account created
									</p>
									<p className="text-xs text-text-muted">
										This number is shown once. Save it somewhere safe —
										there&apos;s no password reset, no email recovery, no
										support ticket.
									</p>
								</div>
							</div>
						</div>
						<div className="mb-4 flex items-center gap-2 rounded-lg border border-border bg-surface p-4">
							<code className="flex-1 break-all text-base sm:text-lg font-mono text-accent tracking-wider select-all">
								{createdAccount}
							</code>
							<button
								type="button"
								onClick={handleCopy}
								aria-label={copied ? "Copied" : "Copy to clipboard"}
								className="shrink-0 rounded-lg p-2 transition-colors hover:bg-accent/10 hover:text-accent cursor-pointer"
							>
								{copied ? (
									<Check className="h-5 w-5 text-success" />
								) : (
									<Copy className="h-5 w-5" />
								)}
							</button>
						</div>

						{/* Optional: Link a wallet */}
						<div className="mb-4 rounded-lg border border-accent/20 bg-accent/5 px-4 py-3">
							<div className="flex items-start gap-3">
								<Wallet className="h-5 w-5 text-accent shrink-0 mt-0.5" />
								<div className="min-w-0 flex-1">
									<p className="text-sm font-medium text-text-bright mb-1">
										Link a wallet (optional)
									</p>
									<p className="text-xs text-text-secondary leading-relaxed mb-3">
										Connect an EVM wallet to enable SIWE sign-in and USDC
										deposits on Base.
									</p>
									<a
										href="/settings?tab=wallets"
										className="text-xs font-semibold text-accent hover:underline underline-offset-2"
									>
										Set up in Settings →
									</a>
								</div>
							</div>
						</div>

						<div className="flex flex-col sm:flex-row gap-2">
							<button
								type="button"
								onClick={handleCopy}
								className="btn-secondary flex-1 py-3 text-sm inline-flex items-center justify-center gap-2"
							>
								{copied ? (
									<>
										<Check className="h-4 w-4 text-success" /> Copied
									</>
								) : (
									<>
										<Copy className="h-4 w-4" /> Copy number
									</>
								)}
							</button>
							<button
								type="button"
								onClick={handleDone}
								className="btn-primary flex-1 py-3 text-sm"
							>
								Go to dashboard
							</button>
						</div>
					</>
				)}
			</div>
		</>
	);
}
