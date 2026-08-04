"use client";

/**
 * Polar (Visa / Mastercard) credit purchase interface.
 *
 * Calls the server's POST /v1/checkout endpoint which creates a Polar
 * checkout session for one of three plans (hobby / builder / scale) and
 * returns a redirect URL. The user is sent to Polar's hosted checkout,
 * pays with card, and on `subscription.created` the server credits their
 * account.
 *
 * No wallet required — this is the fiat-friendly path.
 */

import { AnimatePresence, m } from "@/lib/framer-motion-client";
import {
	ArrowRight,
	CreditCard,
	Loader2,
	ShieldCheck,
	Sparkles,
} from "lucide-react";
import { useCallback, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/lib/hooks/useAuth";
import { request } from "@/lib/api";

interface CheckoutResponse {
	id: string;
	url: string;
}

interface PlanCard {
	plan: "hobby" | "builder" | "scale";
	name: string;
	credits: number;
	price: string;
	priceCents: number;
	perCredit: string;
	highlight?: boolean;
	tagline: string;
}

import { CREDIT_PLANS, perCreditPrice } from "@/lib/credit-utils";
const PLANS: PlanCard[] = CREDIT_PLANS.map((plan, idx) => ({
  plan: (["hobby","builder","scale"] as const)[idx],
  name: plan.tag,
  credits: plan.credits,
  price: `$${plan.usd}`,
  priceCents: plan.usd * 100,
  perCredit: perCreditPrice(),
  tagline: ["Side projects & exploration", "Production apps & agents", "High-volume workloads"][idx],
  highlight: idx === 1
}));

export function FiatCheckoutPanel() {
	const { isAuthenticated, isDemo } = useAuth();
	const toast = useToast();
	const [selected, setSelected] = useState<PlanCard>(PLANS[1]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");

	const handleCheckout = useCallback(async () => {
		if (!isAuthenticated || isDemo) return;
		setError("");
		setLoading(true);
		try {
			const res = await request<CheckoutResponse>("/v1/checkout", {
				method: "POST",
				body: JSON.stringify({
					plan: selected.plan,
					successUrl: `${window.location.origin}/dashboard?tab=credits`,
				}),
			});
			if (!res?.url) {
				throw new Error("Checkout session did not return a URL");
			}
			window.location.href = res.url;
		} catch (err) {
			const msg =
				err instanceof Error
					? err.message
					: "Could not start checkout. Please try again.";
			setError(msg);
			toast.error("Checkout failed");
		} finally {
			setLoading(false);
		}
	}, [selected, isAuthenticated, isDemo, toast]);

	return (
		<div className="space-y-5">
			<div className="rounded-lg border border-accent/20 bg-accent/5 p-4">
				<div className="flex items-start gap-3">
					<div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent/10 text-accent">
						<CreditCard className="h-4 w-4" aria-hidden="true" />
					</div>
					<div className="min-w-0">
						<h3 className="text-sm font-semibold text-text-bright">
							Buy credits with a card
						</h3>
						<p className="mt-1 text-[12px] leading-relaxed text-text-secondary">
							Pay with Visa, Mastercard, or Apple Pay via Polar. No wallet, no
							USDC required. Credits land in your account the moment the
							payment settles.
						</p>
					</div>
				</div>
			</div>

			<fieldset
				className="grid gap-3 sm:grid-cols-3"
				aria-label="Choose a credit pack"
			>
				{PLANS.map((p) => {
					const isActive = selected.plan === p.plan;
					return (
						<label
							key={p.plan}
							className={`group relative flex cursor-pointer flex-col rounded-lg border p-4 transition-all ${
								isActive
									? "border-accent bg-accent/5 shadow-[0_0_0_1px_var(--color-accent)]"
									: "border-border bg-panel hover:border-accent/40"
							}`}
						>
							<input
								type="radio"
								name="plan"
								value={p.plan}
								checked={isActive}
								onChange={() => setSelected(p)}
								className="sr-only"
							/>
							{p.highlight && (
								<span className="absolute -top-2 right-3 inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider text-void">
									<Sparkles className="h-3 w-3" aria-hidden="true" />
									Popular
								</span>
							)}
							<span className="text-[11px] font-mono uppercase tracking-wider text-text-muted">
								{p.name}
							</span>
							<span className="mt-1 text-2xl font-bold text-text-bright">
								{p.credits.toLocaleString()}
								<span className="ml-1 text-[12px] font-normal text-text-muted">
									credits
								</span>
							</span>
							<span className="mt-0.5 text-[11px] text-text-muted">
								{p.tagline}
							</span>
							<div className="mt-3 flex items-baseline justify-between">
								<span className="text-base font-semibold text-accent">
									{p.price}
								</span>
								<span className="text-[10px] font-mono text-text-muted">
									{p.perCredit}
								</span>
							</div>
						</label>
					);
				})}
			</fieldset>

			<AnimatePresence>
				{error && (
					<m.div
						role="alert"
						initial={{ opacity: 0, y: -4 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -4 }}
						className="rounded border border-warning/30 bg-warning/10 px-3 py-2 text-[12px] text-warning"
					>
						{error}
					</m.div>
				)}
			</AnimatePresence>

			{!isAuthenticated || isDemo ? (
				<a
					href="/login?next=/deposit"
					className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-accent px-4 text-sm font-semibold text-void transition-colors hover:bg-accent-bright"
				>
					Sign in to buy credits
					<ArrowRight className="h-4 w-4" aria-hidden="true" />
				</a>
			) : (
				<button
					type="button"
					onClick={handleCheckout}
					disabled={loading}
					className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-accent px-4 text-sm font-semibold text-void transition-colors hover:bg-accent-bright disabled:opacity-60"
				>
					{loading ? (
						<>
							<Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
							Opening checkout…
						</>
					) : (
						<>
							<CreditCard className="h-4 w-4" aria-hidden="true" />
							Pay {selected.price} with card
							<ArrowRight className="h-4 w-4" aria-hidden="true" />
						</>
					)}
				</button>
			)}

			<div className="flex items-center justify-center gap-2 text-[11px] text-text-muted">
				<ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
				Secure checkout by Polar · No wallet needed
			</div>
		</div>
	);
}
