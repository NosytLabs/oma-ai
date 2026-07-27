"use client";

/**
 * Dashboard widget: Polar subscription status. Shows the user's current
 * Polar.sh plan (if any), period-end date, and a 'Manage in Polar' button
 * that opens the hosted customer portal. Hidden when Polar is not configured
 * server-side (returns 503 polar_not_configured) so the dashboard never shows
 * an "error" for what is just an unconfigured feature on this deployment.
 */
import Link from "next/link";
import { CreditCard, ExternalLink, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import {
	api,
	PolarNotConfiguredError,
	type PolarSubscription,
} from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

type State =
	| { kind: "loading" }
	| { kind: "unavailable" }
	| { kind: "none" }
	| { kind: "active"; subscription: PolarSubscription }
	| { kind: "error"; message: string };

export function PolarSubscriptionCard() {
	const toast = useToast();
	const [state, setState] = useState<State>({ kind: "loading" });
	const [openingPortal, setOpeningPortal] = useState(false);

	useEffect(() => {
		let cancelled = false;
		api.polar
			.subscription()
			.then((resp) => {
				if (cancelled) return;
				setState(
					resp.subscription
						? { kind: "active", subscription: resp.subscription }
						: { kind: "none" },
				);
			})
			.catch((err: unknown) => {
				if (cancelled) return;
				if (err instanceof PolarNotConfiguredError) {
					setState({ kind: "unavailable" });
				} else {
					setState({
						kind: "error",
						message: err instanceof Error ? err.message : "Failed to load subscription",
					});
				}
			});
		return () => {
			cancelled = true;
		};
	}, []);

	if (state.kind === "unavailable" || state.kind === "loading") return null;
	if (state.kind === "error") return null;

	if (state.kind === "none") {
		return (
			<div className="flex h-full flex-col justify-between rounded-xl border border-border bg-surface p-5">
				<div className="flex items-center gap-2">
					<CreditCard className="h-4 w-4 text-text-muted" aria-hidden="true" />
					<h3 className="text-sm font-medium">Subscription</h3>
				</div>
				<div className="space-y-3">
					<p className="text-xs text-text-muted">
						No active plan. Subscribe to unlock higher rate limits and a
						monthly credit allowance.
					</p>
					<Link
						href="/settings"
						className="inline-flex items-center gap-1.5 text-xs text-accent hover:underline font-mono uppercase tracking-wider"
					>
						<Sparkles className="h-3 w-3" />
						View plans →
					</Link>
				</div>
			</div>
		);
	}

	const sub = state.subscription;
	const periodEnd = sub.currentPeriodEnd
		? new Date(sub.currentPeriodEnd).toLocaleDateString()
		: null;

	const handleOpenPortal = async () => {
		setOpeningPortal(true);
		try {
			const { url } = await api.polar.portal();
			window.location.href = url;
		} catch (err: unknown) {
			toast.error(err instanceof Error ? err.message : "Failed to open portal");
			setOpeningPortal(false);
		}
	};

	return (
		<div className="flex h-full flex-col justify-between rounded-xl border border-accent/30 bg-accent-dim/30 p-5">
			<div className="flex items-center gap-2">
				<CreditCard className="h-4 w-4 text-accent" aria-hidden="true" />
				<h3 className="text-sm font-medium">
					{sub.planName ?? "Active subscription"}
				</h3>
			</div>
			<div className="space-y-3">
				<div className="text-xs text-text-muted font-mono space-y-1">
					<p>
						Status:{" "}
						<span className="text-text-bright">{sub.status}</span>
					</p>
					{periodEnd && <p>Renews: {periodEnd}</p>}
					{sub.cancelAtPeriodEnd === 1 && (
						<p className="text-warning">Cancels at period end</p>
					)}
				</div>
				<button
					type="button"
					onClick={handleOpenPortal}
					disabled={openingPortal}
					className="inline-flex items-center gap-1.5 text-xs text-accent hover:underline font-mono uppercase tracking-wider disabled:opacity-50"
				>
					<ExternalLink className="h-3 w-3" />
					{openingPortal ? "Opening…" : "Manage in Polar"}
				</button>
			</div>
		</div>
	);
}