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
				subtitle="No plan tiers. Account, API-key and client-IP limits apply together; creating another key does not bypass the account limit."
			/>

			<div id="rl-limits" className="mb-6 overflow-x-auto overscroll-x-contain rounded-[var(--radius-xl)] border border-border bg-panel shadow-[var(--shadow-md)] scroll-mt-24">
				<table className="w-full text-left text-sm" aria-label="Default rate limits">
					<thead>
						<tr className="border-b border-border bg-panel">
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
								className={`border-b border-border/50 ${i % 2 === 1 ? "bg-surface/30" : "bg-panel"}`}
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

			<div id="rl-models" tabIndex={0} role="region" aria-label="Model rate limits. Scroll horizontally to view all columns." className="mb-6 overflow-x-auto overscroll-x-contain rounded-[var(--radius-xl)] border border-border bg-panel shadow-[var(--shadow-md)] scroll-mt-24">
				<div className="border-b border-border bg-panel px-4 py-3">
					<h3 className="font-semibold text-text text-sm">
						Model Budgets
					</h3>
					<p className="mt-1 text-xs text-text-muted">
						The models below have an additional 120,000 TPM budget. Other models
						use the request limits above and their advertised context/output limits;
						OMA does not impose this model-specific TPM budget on them. If one
						request exceeds a listed budget, reduce the prompt or max_tokens rather
						than retrying the same request.
					</p>
				</div>
				<table
					className="w-full text-left text-sm"
					aria-label="Per-model rate limit overrides"
				>
					<thead>
						<tr className="border-b border-border bg-panel">
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
								key={`${m.model}-${m.rpm}-${m.tpm}`}
								className={`border-b border-border/50 ${i % 2 === 1 ? "bg-surface/30" : "bg-panel"}`}
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
				<div className="rounded-[var(--radius-xl)] border border-border bg-panel shadow-[var(--shadow-md)] p-4">
					<h3 className="mb-2 font-semibold text-text">Burst Handling</h3>
					<p className="text-sm text-text-muted">
						Token bucket algorithm allows short bursts above the sustained rate.
						The bucket holds 60 tokens and refills at 20 per second, so brief
						spikes succeed while sustained traffic settles at the RPM ceiling.
					</p>
				</div>
				<div id="rl-headers" className="rounded-[var(--radius-xl)] border border-border bg-panel shadow-[var(--shadow-md)] p-4 scroll-mt-24">
					<h3 className="mb-2 font-semibold text-text">Rate Limit Headers</h3>
					<div className="space-y-1 font-mono text-xs text-text-muted">
						<div>
						<span className="text-accent">X-RateLimit-Limit</span> - Budget
							for the reported policy
						</div>
						<div>
							<span className="text-accent">X-RateLimit-Remaining</span> -
							Budget left (requests or tokens)
						</div>
						<div>
							<span className="text-accent">X-RateLimit-Policy</span> -
							model-rpm counts requests; model-tpm counts tokens;
							degraded-memory is enforced per instance
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
					<p className="mt-3 text-sm text-text-muted">
						Respect Retry-After on 429/503 and use backoff with jitter. During a
						limiter outage, creating another key does not reset your account’s
						emergency allowance. Provider capacity limits may also reject requests;
						a listed model is not a reservation of upstream capacity.
					</p>
					<p className="mt-3 text-sm text-text-muted">OpenBroker’s upstream 429 can also mean shared gateway concurrency is full, even below OMA’s limits. Send fewer requests at once. OMA’s limits and the provider’s capacity are separate; neither guarantees a sustained upstream throughput.</p>
				</div>
			</div>
		</AnimatedSection>
	);
}
