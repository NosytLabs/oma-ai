import { CheckCircle2, DollarSign } from "lucide-react";
import { AnimatedSection, fmt, MODEL_PRICING_ROWS, SectionHeading } from "./shared";

export function PricingSection() {
	return (
		<AnimatedSection delay={400}>
			<SectionHeading
				id="pricing"
				icon={<DollarSign className="h-5 w-5" />}
				title="Pricing"
				subtitle="Per-model pricing. Input and output priced per million tokens."
			/>

			<div className="mb-6 rounded-xl border border-border overflow-hidden">
				<table className="w-full text-left text-sm" aria-label="Model pricing per million tokens">
					<thead>
						<tr className="border-b border-border bg-surface/50">
							<th className="px-4 py-3 font-medium text-text-muted">Model</th>
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
						{MODEL_PRICING_ROWS.map((m, i) => (
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
								<td className="px-4 py-3 text-right text-text-muted">
									{m.ctx}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			<div className="rounded-xl border border-accent/20 bg-accent/5 p-4">
				<h3 className="font-semibold text-accent">Credit Deduction</h3>
				<div className="mt-2 grid gap-2 sm:grid-cols-2">
					<div className="flex items-start gap-2">
						<CheckCircle2 className="h-4 w-4 text-accent mt-0.5" />
						<span className="text-sm text-text-muted">
							$1 = $1. Billed per token in real-time.
						</span>
					</div>

					<div className="flex items-start gap-2">
						<CheckCircle2 className="h-4 w-4 text-accent mt-0.5" />
						<span className="text-sm text-text-muted">
							No minimums or subscriptions
						</span>
					</div>
					<div className="flex items-start gap-2">
						<CheckCircle2 className="h-4 w-4 text-accent mt-0.5" />
						<span className="text-sm text-text-muted">
							12-month rolling expiry
						</span>
					</div>
				</div>
			</div>
		</AnimatedSection>
	);
}
