import { Gauge } from "lucide-react";
import { AnimatedSection, PLAN_LIMITS, SectionHeading } from "./shared";

export function RateLimitsSection() {
	return (
		<AnimatedSection delay={300}>
			<SectionHeading
				id="rate-limits"
				icon={<Gauge className="h-5 w-5" />}
				title="Rate Limits"
				subtitle="Per-plan request and token limits with burst handling."
			/>

			<div className="mb-6 overflow-hidden rounded-xl border border-border">
				<table className="w-full text-left text-sm" aria-label="Rate limits by plan">
					<thead>
						<tr className="border-b border-border bg-surface/50">
							<th className="px-4 py-3 font-medium text-text-muted">Plan</th>
							<th className="px-4 py-3 font-medium text-text-muted text-right">
								RPM
							</th>
							<th className="px-4 py-3 font-medium text-text-muted text-right">
								TPM
							</th>
							<th className="px-4 py-3 font-medium text-text-muted text-right">
								Concurrent
							</th>
						</tr>
					</thead>
					<tbody>
						{PLAN_LIMITS.map((p, i) => (
							<tr
								key={p.name}
								className={`border-b border-border/50 ${i % 2 === 1 ? "bg-surface/30" : ""}`}
							>
								<td className="px-4 py-3">
									<span
										className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${p.badge}`}
									>
										{p.name}
									</span>
								</td>
								<td className="px-4 py-3 text-right font-mono text-text-secondary">
									{p.rpm.toLocaleString()}
								</td>
								<td className="px-4 py-3 text-right font-mono text-text-secondary">
									{p.tpm.toLocaleString()}
								</td>
								<td className="px-4 py-3 text-right font-mono text-text-secondary">
									{p.concurrent}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			<div className="grid gap-4 sm:grid-cols-2">
				<div className="rounded-xl border border-border bg-surface/50 p-4">
					<h3 className="mb-2 font-semibold text-text">Burst Handling</h3>
					<p className="text-sm text-text-muted">
						Token bucket algorithm allows short bursts above the sustained rate.
						Excess tokens are spilled into the next window.
					</p>
				</div>
				<div className="rounded-xl border border-border bg-surface/50 p-4">
					<h3 className="mb-2 font-semibold text-text">Rate Limit Headers</h3>
					<div className="space-y-1 font-mono text-xs text-text-muted">
						<div>
							<span className="text-accent">X-RateLimit-Limit</span> - Requests
							per minute
						</div>
						<div>
							<span className="text-accent">X-RateLimit-Remaining</span> -
							Requests left
						</div>
						<div>
							<span className="text-accent">X-RateLimit-Reset</span> - Seconds
							until reset
						</div>
					</div>
				</div>
			</div>
		</AnimatedSection>
	);
}
