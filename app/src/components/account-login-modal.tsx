"use client";

import {
	AlertTriangle,
	Check,
	Copy,
	HelpCircle,
	Key,
	Loader2,
	Wallet,
	X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { m } from "@/lib/framer-motion-client";
import { useFormErrorShake } from "@/components/motion/use-form-error-shake";
import { SuccessCheck } from "@/components/motion/success-check";
import { api, setAuthToken } from "@/lib/api";
import {
	getCsrfToken,
	getSessionToken,
	setCsrfTokenCookie,
	setSessionCookie,
	setSessionMetaCookie,
} from "@/lib/cookies";

/**
 * Account-number formats accepted by the server (`server/src/auth/account-number.ts`):
 *   - Current: 16 random digits, e.g. "1234567890123456" (with optional
 *     spaces/dashes stripped on the server). This is what `/auth/account/create`
 *     returns and what newly-issued accounts use.
 *   - Legacy:  "OMA-XXXX-XXXX-XXXX" in Crockford base32 (2-9, A-H, J-N, P-Z,
 *     case-insensitive). Kept for backwards-compatible login of pre-existing
 *     accounts; the server still hashes the normalized form so login keeps
 *     working.
 *
 * This client-side check is purely a usability hint — it surfaces typos
 * immediately instead of waiting for a round-trip + 401. The server is
 * the source of truth.
 */
const ACCOUNT_NUMBER_DIGITS_ONLY = /^[0-9]{16}$/;
const ACCOUNT_NUMBER_LEGACY = /^OMA-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/i;

function isValidAccountNumberShape(value: string): boolean {
	const trimmed = value.trim();
	if (trimmed.length === 0) return true; // empty input — don't show a hint yet
	const upper = trimmed.toUpperCase();
	if (ACCOUNT_NUMBER_LEGACY.test(upper)) return true;
	// For the digits-only form, strip separators before testing.
	const digits = trimmed.replace(/[\s-]/g, "");
	return ACCOUNT_NUMBER_DIGITS_ONLY.test(digits);
}

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
	/**
	 * When the host page is already managing the CSRF token fetch (e.g.
	 * pre-fetching on mount), set this to `true` to suppress the modal's
	 * own fallback fetch. Avoids the duplicate `/auth/csrf-token` request
	 * and the `cancelled`-flag dance when both fire on first mount.
	 */
	skipCsrfFetch?: boolean;
}

type Mode = "login" | "create" | "success";

export function AccountLoginModal({
	onClose,
	inline = false,
	initialCsrfToken = null,
	skipCsrfFetch = false,
}: AccountLoginModalProps) {
	const [mode, setMode] = useState<Mode>("login");
	const [accountNumber, setAccountNumber] = useState("");
	const [createdAccount, setCreatedAccount] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);
	const [copyError, setCopyError] = useState<string | null>(null);
	const [csrfToken, setCsrfToken] = useState<string | null>(initialCsrfToken);
	const [requiresTwoFactor, setRequiresTwoFactor] = useState(false);
	const [totpCode, setTotpCode] = useState("");
	const modalRef = useRef<HTMLDivElement>(null);
	const triggerRef = useRef<HTMLElement | null>(null);
	// Form error shake — "Error state shake" pattern from transitions.dev.
	// Triggers a 320ms horizontal wiggle on the error banner whenever a new
	// error string appears.
	const { shake: shakeError, animation: shakeAnimation, key: shakeKey } =
		useFormErrorShake();
	useEffect(() => {
		if (error) shakeError();
	}, [error, shakeError]);
	// Pending "copied" indicator timer. Held in a ref so we can clear it on
	// unmount and on subsequent copy attempts — without this, the indicator
	// can fire setCopied(false) on an unmounted component, and rapid
	// double-clicks leak timers.
	const copyResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
			// Escape in dialog mode: close the modal. The WAI-ARIA dialog
			// pattern says Escape is the canonical dismiss action.
			// Escape in inline mode: do nothing. Stealing focus or blurring
			// the active input is non-standard and surprising — users
			// typing in the account number field expect Escape to do
			// nothing (or, in `<input type="search">`, clear the value,
			// which the browser handles on its own).
			if (e.key === "Escape") {
				if (!inline) onCloseRef.current();
				return;
			}

			// Focus trap ONLY applies in dialog mode (non-inline). In inline
			// mode the modal lives inside a tab panel alongside the tabs
			// above; trapping focus here would block keyboard users from
			// switching to the wallet tab, which is the whole point of the
			// tab UI. The WAI-ARIA dialog pattern explicitly says focus
			// traps belong to modal dialogs, not embedded panels.
			if (e.key === "Tab" && !inline && modalRef.current) {
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
		// In dialog mode, auto-focus the first focusable element (input).
		// In inline mode, do NOT steal focus — the user just clicked the
		// tab and is already reading the panel. Snatching focus on every
		// tab switch is a screen-reader antipattern.
		if (!inline) {
			const firstFocusable = modalRef.current?.querySelector<HTMLElement>(
				'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
			);
			firstFocusable?.focus();
		}

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
		// Host is managing the fetch (e.g. /login pre-fetches on mount). Do
		// not fire a duplicate `/auth/csrf-token` request — the host's
		// token will arrive via the `initialCsrfToken` prop as soon as it
		// resolves, re-running this effect.
		if (skipCsrfFetch) return;
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
	}, [initialCsrfToken, skipCsrfFetch]);

	const handleLogin = useCallback(async () => {
		if (!accountNumber.trim()) return;
		if (requiresTwoFactor && !totpCode.trim()) return;
		setLoading(true);
		setError(null);
		try {
			const headers: Record<string, string> = {
				"Content-Type": "application/json",
			};
			// Fall back to reading the CSRF token directly from the cookie if the
			// React state hasn't been populated yet (race between pre-fetch and
			// user clicking Sign In). The cookie is set by /api/auth/csrf-token
			// on the same origin, so it's always available. H6 fix: the cookie
			// is now `__Host-csrf_token` in production, so we use the helper
			// (which knows the env-dependent name) instead of a hardcoded regex.
			const csrf = csrfToken ?? getCsrfToken();
			if (csrf) {
				headers["x-csrf-token"] = csrf;
			}

			// If the server previously told us 2FA is required, send the TOTP code.
			if (requiresTwoFactor && totpCode.trim()) {
				headers["X-2FA-Code"] = totpCode.trim();
			}

			const res = await fetch(
				`${
					typeof window !== "undefined"
						? "/api"
						: process.env.NEXT_PUBLIC_API_URL ||
						  (() => {
								throw new Error(
									"NEXT_PUBLIC_API_URL is not set on the server. The login modal must be triggered from the client.",
								);
							})()
				}/auth/account/login`,
				{
					method: "POST",
					headers,
					body: JSON.stringify({
						accountNumber: accountNumber.trim().toUpperCase(),
						totpCode: requiresTwoFactor ? totpCode.trim() : undefined,
					}),
				},
			);
			if (!res.ok) {
				const body = await res.json().catch(() => ({}));
				// If the server says 2FA is required, switch to the TOTP input.
				if ((body as { requiresTwoFactor?: boolean })?.requiresTwoFactor) {
					setRequiresTwoFactor(true);
					setLoading(false);
					return;
				}
				const msg =
					(body as { error?: { message?: string } })?.error?.message ||
					"Login failed";
				throw new Error(msg);
			}
			const data = (await res.json()) as { token: string };
			// C1 fix: setSessionCookie() now POSTs to /api/auth/session/cookie,
			// which sets the canonical HttpOnly __Host-oma_session cookie on
			// the page origin. JS no longer writes the JWT to document.cookie,
			// so XSS can't trivially read it. The JWT is still in the response
			// body (data.token) so the in-memory / localStorage copy used by
			// the SPA client can be populated separately if needed.
			setSessionCookie(data.token, 7);
			// B1 fix: mirror the JWT into the API client's in-memory bearer
			// token cache so any outbound request fired before the reload
			// (the modal's own follow-up, optimistic UI, etc.) attaches
			// `Authorization: Bearer <jwt>`. The HttpOnly cookie alone is
			// insufficient because the API client reads `getAuthToken()`,
			// not document.cookie.
			setAuthToken(data.token);
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
	}, [accountNumber, csrfToken, requiresTwoFactor, totpCode]);

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
			// H3 fix: /auth/account/create now enforces the same double-submit
			// CSRF check as /auth/account/login. Attach the CSRF token to
			// every state-changing request. Same race-tolerant fallback as
			// handleLogin: prefer React state, fall back to the cookie helper
			// (which knows the env-dependent `csrf_token` / `__Host-csrf_token`
			// name from H6).
			const csrf = csrfToken ?? getCsrfToken();
			if (csrf) {
				headers["x-csrf-token"] = csrf;
			}

			const res = await fetch(
				`${
					typeof window !== "undefined"
						? "/api"
						: process.env.NEXT_PUBLIC_API_URL ||
						  (() => {
								throw new Error(
									"NEXT_PUBLIC_API_URL is not set on the server. The account-create modal must be triggered from the client.",
								);
							})()
				}/auth/account/create`,
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
				// C1 fix: setSessionCookie() now POSTs to /api/auth/session/cookie
				// to set the HttpOnly canonical cookie. The JWT is no longer
				// written to document.cookie, so XSS can't read it.
				setSessionCookie(data.token, 7);
				// B1 fix: mirror the JWT into the API client's in-memory
				// bearer-token cache so the "Go to dashboard" follow-up (and
				// any subsequent API call before page reload) carries the
				// Authorization header. Same rationale as handleLogin.
				setAuthToken(data.token);
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
	}, [csrfToken]);

	const handleCopy = useCallback(() => {
		if (!createdAccount) return;
		// Clear any in-flight "copied" reset so a rapid second click resets
		// the 2s window from now, not from the first click.
		if (copyResetTimerRef.current) {
			clearTimeout(copyResetTimerRef.current);
			copyResetTimerRef.current = null;
		}
		// `navigator.clipboard` is async and can reject (permission denied,
		// insecure context, browser doesn't support it). Catch and surface
		// the failure so the user knows nothing was copied — silent failure
		// here is a real footgun because the account number is shown ONCE
		// and the user has no recovery path.
		const copyPromise = navigator.clipboard
			? navigator.clipboard.writeText(createdAccount)
			: Promise.reject(new Error("Clipboard API unavailable"));
		copyPromise
			.then(() => {
				setCopied(true);
				setCopyError(null);
				copyResetTimerRef.current = setTimeout(() => {
					setCopied(false);
					copyResetTimerRef.current = null;
				}, 2000);
			})
			.catch((err) => {
				console.error("Clipboard write failed:", err);
				setCopyError(
					"Couldn't copy automatically — select the number and copy manually.",
				);
			});
	}, [createdAccount]);

	// Clear any pending "copied" reset timer on unmount so we don't call
	// setCopied on an unmounted component.
	useEffect(() => {
		return () => {
			if (copyResetTimerRef.current) {
				clearTimeout(copyResetTimerRef.current);
				copyResetTimerRef.current = null;
			}
		};
	}, []);

	// Reset the copy indicator + error whenever the user leaves the success
	// view. Without this, switching back to "create" and creating a NEW
	// account could surface a stale "Copied" tick from the previous one.
	useEffect(() => {
		if (mode !== "success") {
			setCopied(false);
			setCopyError(null);
			if (copyResetTimerRef.current) {
				clearTimeout(copyResetTimerRef.current);
				copyResetTimerRef.current = null;
			}
		}
	}, [mode]);

	const handleDone = useCallback(() => {
		// After a successful account-number creation, navigate to the
		// dashboard so the user lands on their account immediately.
		if (createdAccount) {
			window.location.href = "/dashboard";
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
				{...(inline
					? { role: "region", "aria-labelledby": "modal-title" }
					: { role: "dialog", "aria-modal": "true", "aria-labelledby": "modal-title" })}
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
										? "Private Account"
										: "Account Created"}
							</h3>
							<p className="text-xs text-text-muted">
								{mode === "login"
									? "Sign in with your private account number"
									: mode === "create"
										? "No email, no password, no PII required"
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
								<m.div
									key={shakeKey}
									id="account-error"
									role="alert"
									animate={shakeAnimation ?? undefined}
									className="mb-4 flex items-center gap-2 rounded-lg border border-red/30 bg-red/10 px-4 py-3"
								>
									<AlertTriangle className="h-4 w-4 shrink-0 text-red" />
									<span className="text-sm text-red">{error}</span>
								</m.div>
							)}

				{mode === "login" && (
					<>
						<form
							onSubmit={(e) => {
								e.preventDefault();
								handleLogin();
							}}
						>
						<div className="mb-4">
						<div className="mb-2 flex items-center justify-between gap-2">
							<label
								htmlFor="account-number-input"
								className="block text-xs font-medium uppercase tracking-widest text-text-muted"
							>
								Account Number
							</label>
							<Link
								href="/docs#auth-account"
								className="inline-flex items-center gap-1 text-[11px] text-text-muted hover:text-accent"
							>
								<HelpCircle
									className="h-3 w-3"
									aria-hidden="true"
								/>
								What&apos;s this?
							</Link>
						</div>
						<input
							id="account-number-input"
							name="accountNumber"
							type="text"
							value={accountNumber}
							onChange={(e) => setAccountNumber(e.target.value.toUpperCase())}
							placeholder="1234 5678 9012 3456 or OMA-XXXX-XXXX-XXXX"
							aria-label="Account number"
							aria-invalid={!!error}
							aria-errormessage={error ? "account-error" : undefined}
							aria-describedby={
								accountNumber && !isValidAccountNumberShape(accountNumber)
									? "account-number-format-hint"
									: error
										? "account-error"
										: undefined
							}
							aria-required="true"
							autoComplete="off"
							spellCheck={false}
							inputMode="text"
							className="w-full rounded-lg border border-border bg-surface px-4 py-3 font-mono text-lg tracking-wider placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/50 disabled:opacity-50"
							disabled={loading}
						/>
						{accountNumber &&
							!isValidAccountNumberShape(accountNumber) && (
								<p
									id="account-number-format-hint"
									className="mt-2 text-[11px] text-text-muted"
								>
									Expected: 16 digits (new accounts) or OMA-XXXX-XXXX-XXXX
									(legacy)
								</p>
							)}
					</div>
						{requiresTwoFactor && (
							<div className="mb-4">
								<label
									htmlFor="totp-code-input"
									className="block text-xs font-medium uppercase tracking-widest text-text-muted mb-2"
								>
									2FA Verification Code
								</label>
								<input
									id="totp-code-input"
									name="totpCode"
									type="text"
									value={totpCode}
									onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
									placeholder="6-digit code"
									aria-label="2FA verification code"
									aria-required="true"
									inputMode="numeric"
									autoComplete="one-time-code"
									maxLength={6}
									className="w-full rounded-lg border border-border bg-surface px-4 py-3 font-mono text-lg tracking-[0.5em] text-center placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/50 disabled:opacity-50"
									disabled={loading}
									data-autofocus
								/>
								<p className="mt-2 text-[11px] text-text-muted">
									Enter the 6-digit code from your authenticator app.
								</p>
							</div>
						)}
						<button
							type="submit"
							disabled={loading || !accountNumber.trim() || (requiresTwoFactor && !totpCode.trim())}
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
						Mullvad-style: no email, no password, no PII. Just a number to write
						down.
					</p>
						</form>
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
										Private account number
									</p>
									<p className="text-xs text-text-secondary leading-relaxed">
										No email. No password. No PII. Generates a Mullvad-style
										account number — write it down and use it to sign in on any
										device. Privacy-first by design.
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
								"Generate Private Number"
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
											<div className="mt-0.5 text-success">
												<SuccessCheck size={20} label="Account created" />
											</div>
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
						{copyError && (
							<p
								role="status"
								aria-live="polite"
								className="mb-4 text-[11px] text-warning"
							>
								{copyError}
							</p>
						)}

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
									<Link
										href="/settings?tab=wallets"
										className="text-xs font-semibold text-accent hover:underline underline-offset-2"
									>
										Set up in Settings →
									</Link>
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
