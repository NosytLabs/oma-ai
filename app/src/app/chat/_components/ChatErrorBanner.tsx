"use client";

/**
 * CHAT ERROR BANNER — Classifed error display with recovery actions
 *
 * Classifies errors by keyword matching (cheap, no extra fetch) and
 * provides actionable recovery steps:
 *   - Auth → "Connect Wallet" CTA (preserves ?next= redirect)
 *   - Network → Retry button + diagnostic hints
 *   - Rate limit → Wait time estimation + retry
 *   - Model → Suggest switching models
 *   - Credits → Link to deposit page
 *
 * Mobile-first: wraps gracefully, touch-friendly dismiss.
 */

import {
	AlertCircle,
	ArrowRight,
	Bot,
	Clock,
	Coins,
	RefreshCw,
	Wallet,
	WifiOff,
	X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

export interface ChatErrorBannerProps {
	error: string | null;
	onDismiss: () => void;
	onRetry?: () => void;
}

interface ErrorClassification {
	type: "auth" | "network" | "rateLimit" | "model" | "credits" | "unknown";
	label: string;
	suggestion: string;
	action?: {
		label: string;
		href?: string;
		onClick?: () => void;
	};
}

function classifyError(error: string): ErrorClassification {
	const lower = error.toLowerCase();

	// Auth errors
	if (
		lower.includes("auth") ||
		lower.includes("unauthorized") ||
		lower.includes("connect your wallet") ||
		lower.includes("reconnect") ||
		lower.includes("sign in")
	) {
		return {
			type: "auth",
			label: "AUTH REQUIRED",
			suggestion:
				"Sign in with your wallet or account number — chat also needs an API key (created in the dashboard)",
		};
	}

	// Credits / payment errors
	if (
		lower.includes("insufficient") ||
		lower.includes("no credits") ||
		lower.includes("balance") ||
		lower.includes("deposit")
	) {
		return {
			type: "credits",
			label: "LOW CREDITS",
			suggestion: "Add credits to continue using the gateway",
			action: {
				label: "TOP UP",
				href: "/deposit",
			},
		};
	}

	// Rate limit errors
	if (
		lower.includes("rate limit") ||
		lower.includes("429") ||
		lower.includes("too many")
	) {
		// Try to extract retry-after from error
		const retryMatch = error.match(/retry[---_ ]after[:\s]*(\d+)/i);
		const waitSeconds = retryMatch ? parseInt(retryMatch[1], 10) : null;

		return {
			type: "rateLimit",
			label: "RATE LIMITED",
			suggestion: waitSeconds
				? `Wait ${waitSeconds}s before retrying`
				: "Too many requests — wait a moment and try again",
			action: {
				label: "RETRY",
			},
		};
	}

	// Model errors
	if (
		(lower.includes("model") ||
			lower.includes("provider") ||
			lower.includes("overloaded")) &&
		!lower.includes("auth")
	) {
		return {
			type: "model",
			label: "MODEL ERROR",
			suggestion: "The model is unavailable — try switching to a different one",
			action: {
				label: "SWITCH MODEL",
			},
		};
	}

	// Network errors
	if (
		lower.includes("cannot reach") ||
		lower.includes("network") ||
		lower.includes("fetch") ||
		lower.includes("econnrefused") ||
		lower.includes("timeout") ||
		lower.includes("connection")
	) {
		return {
			type: "network",
			label: "NETWORK ERROR",
			suggestion: "Could not reach the server — check your connection",
		};
	}

	// Unknown errors
	return {
		type: "unknown",
		label: "ERROR",
		suggestion: error.length > 100 ? `${error.slice(0, 100)}...` : error,
	};
}

const TYPE_STYLES: Record<
	ErrorClassification["type"],
	{ bg: string; border: string; text: string; badge: string }
> = {
	auth: {
		bg: "bg-error/10",
		border: "border-error/20",
		text: "text-error",
		badge: "bg-error/20 text-error",
	},
	credits: {
		bg: "bg-warning/10",
		border: "border-warning/20",
		text: "text-warning",
		badge: "bg-warning/20 text-warning",
	},
	rateLimit: {
		bg: "bg-warning/10",
		border: "border-warning/20",
		text: "text-warning",
		badge: "bg-warning/20 text-warning",
	},
	model: {
		bg: "bg-accent/10",
		border: "border-accent/20",
		text: "text-accent",
		badge: "bg-accent/20 text-accent",
	},
	network: {
		bg: "bg-error/10",
		border: "border-error/20",
		text: "text-error",
		badge: "bg-error/20 text-error",
	},
	unknown: {
		bg: "bg-error/10",
		border: "border-error/20",
		text: "text-error",
		badge: "bg-error/20 text-error",
	},
};

const TYPE_ICONS: Record<ErrorClassification["type"], typeof AlertCircle> = {
	auth: Wallet,
	credits: Coins,
	rateLimit: Clock,
	model: Bot,
	network: WifiOff,
	unknown: AlertCircle,
};

export function ChatErrorBanner({
	error,
	onDismiss,
	onRetry,
}: ChatErrorBannerProps) {
	const pathname = usePathname();
	const [retrying, setRetrying] = useState(false);
	const [countdown, setCountdown] = useState<number | null>(null);

	const classification = error ? classifyError(error) : null;
	const styles = classification ? TYPE_STYLES[classification.type] : null;
	const Icon = classification ? TYPE_ICONS[classification.type] : AlertCircle;

	const loginHref = pathname
		? `/login?next=${encodeURIComponent(pathname)}`
		: "/login";

	// Auto-countdown for rate limits
	useEffect(() => {
		if (classification?.type === "rateLimit" && error) {
			const retryMatch = error.match(/retry[---_ ]after[:\s]*(\d+)/i);
			const seconds = retryMatch ? parseInt(retryMatch[1], 10) : 30;

			setCountdown(seconds);
			const interval = setInterval(() => {
				setCountdown((prev) => {
					if (prev === null || prev <= 1) {
						clearInterval(interval);
						return null;
					}
					return prev - 1;
				});
			}, 1000);
			return () => clearInterval(interval);
		}
	}, [classification?.type, error]);

	const handleRetry = useCallback(() => {
		if (classification?.type === "auth" && classification.action?.href) return; // handled by Link
		setRetrying(true);
		onRetry?.();
		setTimeout(() => setRetrying(false), 1000);
	}, [classification, onRetry]);

	if (!error || !classification || !styles) return null;

	return (
		<div
			className={`mb-3 flex items-start justify-between gap-3 px-3 py-2.5 ${styles.bg} border ${styles.border} text-[11px] ${styles.text} uppercase tracking-wider`}
			role="alert"
		>
			<div className="flex items-start gap-2 flex-1 min-w-0">
				<Icon className="w-3.5 h-3.5 shrink-0 mt-0.5" />

				<div className="flex-1 min-w-0">
					{/* Error type badge */}
					<div className="flex items-center gap-2 mb-1">
						<span
							className={`px-1.5 py-0.5 text-[9px] font-bold ${styles.badge}`}
						>
							{classification.label}
						</span>
						{countdown !== null && countdown > 0 && (
							<span className="text-[9px] font-mono opacity-70">
								RETRY IN {countdown}s
							</span>
						)}
					</div>

					{/* Suggestion */}
					<p className="text-[10px] font-mono opacity-80 leading-relaxed normal-case">
						{classification.suggestion}
					</p>

					{/* Action buttons */}
					<div className="flex items-center gap-2 mt-2 flex-wrap">
						{/* Auth CTA */}
						{classification.type === "auth" && (
							<Link
								href={loginHref}
								prefetch={false}
								className="
                  inline-flex items-center gap-1 px-3 py-1.5
                  bg-accent text-text-inverse text-[10px] font-bold uppercase tracking-wider
                  hover:bg-accent-hover transition-colors min-h-[32px]
                "
							>
								Sign In
								<ArrowRight className="w-3 h-3" />
							</Link>
						)}

						{/* API key CTA — a 401 also fires for signed-in users who
						    haven't created an API key yet (chat auths with the
						    oma_api_key cookie, not the session JWT). */}
						{classification.type === "auth" && (
							<Link
								href="/dashboard?tab=api-keys"
								prefetch={false}
								className="
                inline-flex items-center gap-1 px-3 py-1.5
                border border-current text-[10px] font-bold uppercase tracking-wider
                hover:bg-white/5 transition-colors min-h-[32px]
              "
							>
								Create API Key
								<ArrowRight className="w-3 h-3" />
							</Link>
						)}

						{/* Credits CTA */}
						{classification.type === "credits" &&
							classification.action?.href && (
								<Link
									href={classification.action.href}
									prefetch={false}
									className="
                  inline-flex items-center gap-1 px-3 py-1.5
                  bg-warning text-void text-[10px] font-bold uppercase tracking-wider
                  hover:bg-warning/90 transition-colors min-h-[32px]
                "
								>
									Top Up Credits
									<ArrowRight className="w-3 h-3" />
								</Link>
							)}

						{/* Retry button */}
						{classification.type !== "auth" &&
							classification.type !== "credits" &&
							onRetry && (
								<button
									type="button"
									onClick={handleRetry}
									disabled={
										retrying ||
										(classification.type === "rateLimit" &&
											countdown !== null &&
											countdown > 0)
									}
									className="
                  inline-flex items-center gap-1 px-3 py-1.5
                  border border-current text-[10px] font-bold uppercase tracking-wider
                  hover:bg-white/5 transition-colors min-h-[32px]
                  disabled:opacity-40 disabled:cursor-not-allowed
                "
								>
									<RefreshCw
										className={`w-3 h-3 ${retrying ? "animate-spin" : ""}`}
									/>
									{retrying
										? "RETRYING..."
										: classification.type === "rateLimit"
											? "RETRY"
											: "TRY AGAIN"}
								</button>
							)}

						{/* Model switch hint */}
						{classification.type === "model" && (
							<span className="text-[9px] font-mono opacity-60 normal-case">
								Use the model selector above to switch
							</span>
						)}
					</div>
				</div>
			</div>

			<button
				type="button"
				onClick={onDismiss}
				aria-label="Dismiss error"
				className="
          p-2 hover:bg-white/5 transition-colors shrink-0
          min-h-[44px] min-w-[44px] flex items-center justify-center
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
          focus-visible:ring-offset-2 focus-visible:ring-offset-void
        "
			>
				<X className="w-3 h-3" />
			</button>
		</div>
	);
}
