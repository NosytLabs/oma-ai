"use client";

import { CheckCircle2, DollarSign } from "lucide-react";
import { useEffect, useState } from "react";
import { loadModels } from "@/lib/models-data";
import { AnimatedSection, fmt, MODEL_PRICING_ROWS, SectionHeading } from "./shared";

export function PricingSection() {
	// Static fallback rows render immediately; the live catalog replaces
	// them once /v1/models responds (same pattern as AvailableModelsSection —
	// without it this table showed 7 hand-picked models under a "90 models"
	// headline).
	const [rows, setRows] = useState(MODEL_PRICING_ROWS);
	useEffect(() => {
		let cancelled = false;
		loadModels().then((live) => {
			if (cancelled || live.length === 0) return;
			setRows(
				live.map((m) => ({
					id: m.id,
					name: m.name,
					input: m.inputPricePer1M,
					output: m.outputPricePer1M,
					ctx: m.contextLength,
				})),
			);
		});
		return () => {
			cancelled = true;
		};
	}, []);

	return (
		<AnimatedSection delay={400}>
			<SectionHeading
				id="pricing"
				icon={<DollarSign className="h-5 w-5" />}
				title="Pricing"
				subtitle="Per-model pricing. Input and output priced per million tokens."
			/>

			<p className="mb-6 text-sm leading-relaxed text-text-muted">Gonka models are $0.02 per million input tokens and $0.02 per million output tokens. Venice rates include 50% markup. Some Venice models use higher rates for long prompts; check pricing.extended in GET /v1/models and the model detail page. Prices are final customer rates, including any active admin override.</p>

			<div id="pricing-table" className="mb-6 rounded-[var(--radius-xl)] border border-border overflow-x-auto overscroll-x-contain scroll-mt-24">
				<table className="w-full min-w-[30rem] text-left text-sm" aria-label="Model pricing per million tokens">
					<thead>
						<tr className="border-b border-border bg-panel">
							<th className="px-4 py-3 font-medium text-text-muted">Type</th>
							<th className="px-4 py-3 text-right font-medium text-text-muted">
								Input / 1M
							</th>
							<th className="px-4 py-3 text-right font-medium text-text-muted">
								Output / 1M
							</th>
							<th className="px-4 py-3 text-right font-medium text-text-muted">
								Context
							</th>
						</tr>
					</thead>
					<tbody>
						{rows.map((m, i) => (
							<tr
								key={m.id}
								className={`border-b border-border/50 ${i % 2 === 1 ? "bg-surface/30" : ""}`}
							>
								<td className="px-4 py-3 font-medium text-text">{m.name}</td>
								<td className="px-4 py-3 text-right font-mono text-accent">
									{fmt(m.input)}
								</td>
								<td className="px-4 py-3 text-right font-mono text-text-secondary">
									{fmt(m.output)}
								</td>
								<td className="px-4 py-3 text-right text-text-muted font-mono">
									{m.ctx}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			<div id="pricing-credits" className="rounded-[var(--radius-xl)] border border-accent/20 bg-accent/5 p-4 scroll-mt-24">
				<h3 className="font-semibold text-accent">Credit Deduction</h3>
				<div className="mt-2 grid gap-2 sm:grid-cols-2">
					<div className="flex items-start gap-2">
						<CheckCircle2 className="h-4 w-4 text-accent mt-0.5" />
						<span className="text-sm text-text-muted">
							Listed model prices are the final billed prices. $1 of credits
							buys 100 cents of usage at those rates, deducted per token in
							real-time.
						</span>
					</div>

					<div className="flex items-start gap-2">
						<CheckCircle2 className="h-4 w-4 text-accent mt-0.5" />
						<span className="text-sm text-text-muted">
							No subscriptions. Funding methods have their own deposit limits.
						</span>
					</div>
					<div className="flex items-start gap-2">
						<CheckCircle2 className="h-4 w-4 text-accent mt-0.5" />
						<span className="text-sm text-text-muted">
							Credits never expire while your account is active
						</span>
					</div>
				</div>
			</div>
		</AnimatedSection>
	);
}
