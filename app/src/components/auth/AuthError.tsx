"use client";

import { useEffect, useState } from "react";
import { m, useReducedMotion } from "framer-motion";
import {
	AlertTriangle,
	Clock,
	Globe,
	type LucideIcon,
	OctagonX,
	Wallet,
	XCircle,
} from "lucide-react";
import { ApiError, BackendUnavailableError } from "@/lib/api";
import type { AuthErrorKind } from "./types";

/**
 * Inline countdown — previously extracted as `useCountdown` in AuthSkeleton.
 * Returns the seconds remaining until `targetSec` reaches 0, ticking once
 * per second. Returns 0 if `targetSec` is not a positive number.
 */
function useCountdown(targetSec: number | undefined): number {
	const [remaining, setRemaining] = useState(targetSec ?? 0);
	useEffect(() => {
		if (typeof targetSec !== "number" || targetSec <= 0) {
			setRemaining(0);
			return;
		}
		setRemaining(targetSec);
		const start = Date.now();
		const id = setInterval(() => {
			const elapsed = Math.floor((Date.now() - start) / 1000);
			const left = Math.max(0, targetSec - elapsed);
			setRemaining(left);
			if (left === 0) clearInterval(id);
		}, 1000);
		return () => clearInterval(id);
	}, [targetSec]);
	return remaining;
}

interface AuthErrorProps {
	error: unknown;
	onRetry?: () => void;
	onDismiss?: () => void;
}

/**
 * Convert any thrown value into an actionable error shape.
 *
 * Why hand-roll this instead of catching everywhere:
 *   - Wagmi rejects with `Error` objects that carry `{ code, message,
 *     shortMessage }`. Wallet-emitted errors expose `code: 4001` for
 *     user rejection and chain-related errors with provider-specific text.
 *   - The API client throws `ApiError` (HTTP-aware) and
 *     `BackendUnavailableError` (network failure).
 *   - The shape gets reused across modals and pages — so the message
 *     wording lives here, in one place, not duplicated at every callsite.
 */
export function shapeAuthError(err: unknown): {
	kind: AuthErrorKind;
	message: string;
	retryAfterSec?: number;
} {
	if (err instanceof ApiError) {
		if (err.status === 429) {
			const retry =
				typeof err.body === "object" &&
				err.body !== null &&
				"retryAfter" in err.body
					? Number((err.body as { retryAfter?: number }).retryAfter)
					: undefined;
			return {
				kind: "rate_limited",
				message:
					"Too many attempts. Please slow down and try again in a moment.",
				retryAfterSec: retry,
			};
		}
		if (err.status === 401 || err.status === 403) {
			return {
				kind: "signature_failed",
				message: "Signature or session rejected. Please try again.",
			};
		}
		return {
			kind: "unknown",
			message: err.message || "Something went wrong. Please try again.",
		};
	}

	if (err instanceof BackendUnavailableError) {
		return {
			kind: "network",
			message: "Can't reach the server. Check your connection and try again.",
		};
	}

	const anyErr = err as
		| { code?: number; shortMessage?: string; message?: string }
		| null
		| undefined;

	const message = anyErr?.message ?? anyErr?.shortMessage ?? "";
	const lower = message.toLowerCase();

	if (
		anyErr?.code === 4001 ||
		lower.includes("user rejected") ||
		lower.includes("user denied") ||
		lower.includes("user cancelled")
	) {
		return {
			kind: "user_rejected",
			message: "Connection cancelled. Click again when you're ready.",
		};
	}

	if (
		lower.includes("wallet") &&
		lower.includes("not") &&
		(lower.includes("installed") || lower.includes("detected"))
	) {
		return {
			kind: "no_wallet",
			message:
				"No wallet detected. Install MetaMask or Coinbase Wallet, then refresh.",
		};
	}

	if (
		(lower.includes("chain") || lower.includes("network")) &&
		(lower.includes("switch") ||
			lower.includes("wrong") ||
			lower.includes("mismatch") ||
			lower.includes("unsupported"))
	) {
		return {
			kind: "wrong_chain",
			message:
				"Wrong network. OMA requires Base mainnet — switch networks in your wallet and retry.",
		};
	}

	if (
		lower.includes("rejected") ||
		lower.includes("denied") ||
		lower.includes("signature")
	) {
		return {
			kind: "signature_failed",
			message: message || "Signature failed. Please try again.",
		};
	}

	return {
		kind: "unknown",
		message:
			message || "Couldn't complete the request. Please try again in a moment.",
	};
}

const KIND_META: Record<AuthErrorKind, { Icon: LucideIcon; title: string }> = {
	user_rejected: { Icon: XCircle, title: "Cancelled" },
	no_wallet: { Icon: Wallet, title: "Wallet not found" },
	wrong_chain: { Icon: Globe, title: "Wrong network" },
	signature_failed: { Icon: OctagonX, title: "Signature failed" },
	rate_limited: { Icon: Clock, title: "Too many attempts" },
	network: { Icon: AlertTriangle, title: "Connection issue" },
	unknown: { Icon: AlertTriangle, title: "Something went wrong" },
};

export function AuthError({ error, onRetry, onDismiss }: AuthErrorProps) {
	const shaped = shapeAuthError(error);
	const meta = KIND_META[shaped.kind];
	const reduceMotion = useReducedMotion();
	const Icon = meta.Icon;
	const retryCountdown = useCountdown(shaped.retryAfterSec);

	// Only show the countdown while there are seconds remaining on the
	// rate-limit window. After the timer hits 0, the hint disappears
	// (matches the original wording for non-rate-limited errors).
	const showCountdown =
		shaped.kind === "rate_limited" &&
		typeof shaped.retryAfterSec === "number" &&
		shaped.retryAfterSec > 0 &&
		retryCountdown > 0;

	return (
		<m.div
			role="alert"
			aria-live="assertive"
			initial={reduceMotion ? false : { opacity: 0, y: -4 }}
			animate={reduceMotion ? false : { opacity: 1, y: 0 }}
			transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
			className="flex items-start gap-3 rounded-lg border border-red/30 bg-red/10 px-3.5 py-3"
		>
			<Icon className="h-4 w-4 shrink-0 text-red mt-0.5" aria-hidden="true" />
			<div className="min-w-0 flex-1 text-xs">
				<p className="font-semibold text-red">{meta.title}</p>
				<p className="mt-0.5 text-text leading-relaxed">
					{shaped.message}
					{showCountdown && (
						<span
							className="text-text-muted tabular-nums"
							aria-live="off"
						>
							{" "}
							(retry in {retryCountdown}s)
						</span>
					)}
				</p>
				{(onRetry || onDismiss) && (
					<div className="mt-2 flex flex-wrap gap-2">
						{onRetry && (
							<button
								type="button"
								onClick={onRetry}
								disabled={showCountdown}
								className="inline-flex items-center rounded-md border border-red/30 bg-red/10 px-2.5 py-1 text-[11px] font-semibold text-red hover:bg-red/20 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
							>
								{showCountdown ? `Wait ${retryCountdown}s` : "Try again"}
							</button>
						)}
						{onDismiss && (
							<button
								type="button"
								onClick={onDismiss}
								className="inline-flex items-center rounded-md px-2 py-1 text-[11px] font-medium text-text-muted hover:text-text transition-colors"
							>
								Dismiss
							</button>
						)}
					</div>
				)}
			</div>
		</m.div>
	);
}
