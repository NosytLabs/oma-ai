import { Gauge } from "lucide-react";
import {
	AnimatedSection,
	MODEL_RATE_OVERRIDES,
	RATE_LIMIT_ROWS,
	SectionHeading,
} from "./shared";

export function RateLimitsSection() {
	return (
		<AnimatedSection delay={300}>
			<SectionHeading
				id="rate-limits"
				icon={<Gauge className="h-5 w-5" />}
				title="Rate Limits"
				subtitle="One set of limits for every key — no plan tiers. Enforced per API key (or per IP for unauthenticated requests)."
			/>

			<div id="rl-limits" className="mb-6 overflow-hidden rounded-xl border border-border scroll-mt-24">
				<table className="w-full text-left text-sm" aria-label="Default rate limits">
					<thead>
						<tr className="border-b border-border bg-surface/50">
							<th className="px-4 py-3 font-medium text-text-muted">Limit</th>
							<th className="px-4 py-3 font-medium text-text-muted text-right">
								Value
							</th>
							<th className="px-4 py-3 font-medium text-text-muted">Notes</th>
						</tr>
					</thead>
					<tbody>
						{RATE_LIMIT_ROWS.map((row, i) => (
							<tr
								key={row.name}
								className={`border-b border-border/50 ${i % 2 === 1 ? "bg-surface/30" : ""}`}
							>
								<td className="px-4 py-3 font-medium text-text">{row.name}</td>
								<td className="px-4 py-3 text-right font-mono text-text-secondary">
									{row.value}
								</td>
								<td className="px-4 py-3 text-text-muted">{row.desc}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			<div id="rl-models" className="mb-6 overflow-hidden rounded-xl border border-border scroll-mt-24">
				<div className="border-b border-border bg-surface/50 px-4 py-3">
					<h3 className="font-semibold text-text text-sm">
						Per-Model Overrides
					</h3>
					<p className="mt-1 text-xs text-text-muted">
						A few models carry their own request/token ceilings. Everything else
						uses the defaults above.
					</p>
				</div>
				<table
					className="w-full text-left text-sm"
					aria-label="Per-model rate limit overrides"
				>
					<thead>
						<tr className="border-b border-border bg-surface/50">
							<th className="px-4 py-3 font-medium text-text-muted">Model</th>
							<th className="px-4 py-3 font-medium text-text-muted text-right">
								RPM
							</th>
							<th className="px-4 py-3 font-medium text-text-muted text-right">
								TPM
							</th>
						</tr>
					</thead>
					<tbody>
						{MODEL_RATE_OVERRIDES.map((m, i) => (
							<tr
								key={m.model}
								className={`border-b border-border/50 ${i % 2 === 1 ? "bg-surface/30" : ""}`}
							>
								<td className="px-4 py-3">
									<code className="font-mono text-xs text-accent">{m.model}</code>
								</td>
								<td className="px-4 py-3 text-right font-mono text-text-secondary">
									{m.rpm.toLocaleString()}
								</td>
								<td className="px-4 py-3 text-right font-mono text-text-secondary">
									{m.tpm.toLocaleString()}
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
						The bucket holds 60 tokens and refills at 20 per second, so brief
						spikes succeed while sustained traffic settles at the RPM ceiling.
					</p>
				</div>
				<div id="rl-headers" className="rounded-xl border border-border bg-surface/50 p-4 scroll-mt-24">
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
							<span className="text-accent">X-RateLimit-Reset</span> - Unix
							timestamp (seconds) when the limit resets
						</div>
						<div>
							<span className="text-accent">Retry-After</span> - Seconds to wait
							before retrying (sent on 429/503)
						</div>
					</div>
				</div>
			</div>
		</AnimatedSection>
	);
}
