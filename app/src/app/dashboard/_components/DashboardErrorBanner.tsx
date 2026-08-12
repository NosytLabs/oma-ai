"use client";

import { useState } from "react";
import { RefreshCw, WifiOff } from "lucide-react";

/**
 * Inline error banner for the dashboard. Classifies the message into
 * backend-unavailable / suspended / payment-required / quota / generic,
 * and offers Retry (backend down) or Dismiss actions.
 */
export function DashboardErrorBanner({
	error,
	backendUnavailable,
	onRefresh,
}: {
	error: string | null;
	backendUnavailable: boolean;
	onRefresh: () => void;
}) {
	const [dismissed, setDismissed] = useState(false);

	if (!error || dismissed) return null;

	const isSuspended = error.includes("suspended");
	const isPaymentRequired = error.includes("payment required");
	const isQuota =
		error.includes("limit exceeded") || error.includes("quota");
	const isDismissable = !(
		isSuspended ||
		isPaymentRequired ||
		isQuota
	);

	return (
		<div
			role="alert"
			aria-live="polite"
			className="mb-6 flex items-center justify-between gap-4 rounded-[var(--radius-xl)] border border-error/30 bg-error/5 p-4"
		>
			<div className="flex items-center gap-3 text-sm text-text">
				{backendUnavailable ? (
					<>
						<WifiOff className="h-4 w-4 shrink-0 text-error" />
						<div>
							<div className="font-medium text-error">
								Backend unavailable
							</div>
							<div className="text-xs text-text-muted mt-0.5">
								Make sure the API server is reachable (configured via NEXT_PUBLIC_API_URL).
							</div>
						</div>
					</>
				) : isSuspended ? (
					<>
						<span className="inline-block h-2 w-2 shrink-0 rounded-full bg-error" />
						<span>
							<span className="font-medium text-error">
								Account suspended
							</span>{" "}
							<span className="text-text-muted">. Contact support to appeal this action.</span>
						</span>
					</>
				) : isPaymentRequired ? (
					<>
						<span className="inline-block h-2 w-2 shrink-0 rounded-full bg-warning" />
						<span>
							<span className="font-medium text-warning">
								Payment required
							</span>{" "}
							<span className="text-text-muted">. You have reached a block requiring a paid wallet transaction.</span>
						</span>
					</>
				) : isQuota ? (
					<>
						<span className="inline-block h-2 w-2 shrink-0 rounded-full bg-warning" />
						<span>
							<span className="font-medium text-warning">
								Quota exceeded
							</span>{" "}
							<span className="text-text-muted">. Your free tier daily usage limit was reached. Deposit credits to continue.</span>
						</span>
					</>
				) : (
					<>
						<span className="inline-block h-2 w-2 shrink-0 rounded-full bg-error animate-pulse" />
						<span>
							<span className="font-medium text-error">
								Something went wrong.
							</span>{" "}
							<span className="text-text-muted">{error}</span>
						</span>
					</>
				)}
			</div>
			<div className="flex shrink-0 items-center gap-2">
				{backendUnavailable && (
					<button
						type="button"
						onClick={onRefresh}
						className="inline-flex items-center gap-1.5 rounded-[var(--radius-lg)] border border-error/40 bg-error/10 px-3 py-1.5 text-xs font-medium text-error transition-colors duration-200 ease-out hover:bg-error/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error active:scale-[0.97]"
					>
						<RefreshCw className="h-3 w-3" />
						Retry
					</button>
				)}
				{isDismissable && (
					<button
						type="button"
						onClick={() => setDismissed(true)}
						className="rounded-[var(--radius-lg)] border border-border bg-void px-3 py-1.5 text-xs font-medium text-text-muted transition-colors duration-200 ease-out hover:bg-surface hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
					>
						Dismiss
					</button>
				)}
			</div>
		</div>
	);
}