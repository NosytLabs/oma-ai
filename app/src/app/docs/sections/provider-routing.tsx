import { GitBranch } from "lucide-react";
import { AnimatedSection, SectionHeading } from "./shared";

export function ProviderRoutingSection() {
	return (
		<AnimatedSection delay={260}>
			<SectionHeading
				id="provider-routing"
				icon={<GitBranch className="h-5 w-5" />}
				title="Provider Routing"
				subtitle="OMA routes each request through the best available provider — automatically."
			/>

			<div className="rounded-xl border border-accent/20 bg-accent/5 p-5 mb-6">
				<div className="flex items-start gap-3">
					<GitBranch className="h-5 w-5 text-accent mt-0.5 shrink-0" />
					<div>
						<h4 className="font-semibold text-accent">Intelligent Request Routing</h4>
						<p className="mt-1 text-sm text-text-muted">
							Every model id resolves to one or more upstream providers. OMA
							selects the optimal provider based on your plan tier, latency,
							and availability — with automatic circuit-breaker failover.
						</p>
					</div>
				</div>
			</div>

			<div className="mb-6 grid gap-4 sm:grid-cols-3">
				<div className="rounded-xl border border-border bg-surface/50 p-4">
					<div className="flex items-center gap-2 mb-2">
						<span className="inline-flex items-center rounded-full bg-accent/20 text-accent px-2.5 py-0.5 text-xs font-medium">Primary</span>
						<span className="font-semibold text-text text-sm">Venice</span>
					</div>
					<p className="text-sm text-text-muted">
						Default provider for most model tiers. Venice handles chat, image,
						video, and embedding workloads with low-latency inference.
					</p>
					<div className="mt-3 flex flex-wrap gap-1">
						<span className="rounded bg-surface px-1.5 py-0.5 text-[10px] text-text-muted border border-border/50">chat</span>
						<span className="rounded bg-surface px-1.5 py-0.5 text-[10px] text-text-muted border border-border/50">image</span>
						<span className="rounded bg-surface px-1.5 py-0.5 text-[10px] text-text-muted border border-border/50">video</span>
						<span className="rounded bg-surface px-1.5 py-0.5 text-[10px] text-text-muted border border-border/50">embeddings</span>
					</div>
				</div>
				<div className="rounded-xl border border-border bg-surface/50 p-4">
					<div className="flex items-center gap-2 mb-2">
						<span className="inline-flex items-center rounded-full bg-warning/20 text-warning px-2.5 py-0.5 text-xs font-medium">Fallback</span>
						<span className="font-semibold text-text text-sm">Surplus</span>
					</div>
					<p className="text-sm text-text-muted">
						Secondary provider that handles overflow and failover traffic when
						Venice is at capacity or unavailable. Same model coverage.
					</p>
					<div className="mt-3 flex flex-wrap gap-1">
						<span className="rounded bg-surface px-1.5 py-0.5 text-[10px] text-text-muted border border-border/50">chat</span>
						<span className="rounded bg-surface px-1.5 py-0.5 text-[10px] text-text-muted border border-border/50">reasoning</span>
					</div>
				</div>
				<div className="rounded-xl border border-border bg-surface/50 p-4">
					<div className="flex items-center gap-2 mb-2">
						<span className="inline-flex items-center rounded-full bg-success/20 text-success px-2.5 py-0.5 text-xs font-medium">Budget</span>
						<span className="font-semibold text-text text-sm">Gonka</span>
					</div>
					<p className="text-sm text-text-muted">
						Ultra-low-cost provider for budget-tier models. Ideal for high-volume,
						latency-tolerant workloads and prototyping.
					</p>
					<div className="mt-3 flex flex-wrap gap-1">
						<span className="rounded bg-surface px-1.5 py-0.5 text-[10px] text-text-muted border border-border/50">chat</span>
						<span className="rounded bg-surface px-1.5 py-0.5 text-[10px] text-text-muted border border-border/50">fast</span>
					</div>
				</div>
			</div>

			<div className="grid gap-4 sm:grid-cols-2">
				<div className="rounded-xl border border-border bg-surface/50 p-4">
					<h4 className="mb-2 font-semibold text-text text-sm">How Routing Works</h4>
					<ol className="space-y-1.5 text-sm text-text-muted list-decimal list-inside">
						<li>Request arrives with a model id and plan tier</li>
						<li>OMA checks the model→provider mapping for that tier</li>
						<li>Primary provider is tried first (Venice for most models)</li>
						<li>On failure or rate-limit, circuit breaker triggers fallback (Surplus)</li>
						<li>Budget-tier models route directly to Gonka</li>
					</ol>
				</div>
				<div className="rounded-xl border border-border bg-surface/50 p-4">
					<h4 className="mb-2 font-semibold text-text text-sm">Response Headers</h4>
					<p className="text-sm text-text-muted mb-3">
						Each response includes the provider that handled the request:
					</p>
					<div className="space-y-1 font-mono text-xs text-text-muted">
						<div>
							<span className="text-accent">x-provider</span>: venice | surplus | gonka
						</div>
						<div>
							<span className="text-accent">x-routing-tier</span>: primary | fallback | budget
						</div>
						<div>
							<span className="text-accent">x-provider-latency</span>: milliseconds
						</div>
					</div>
				</div>
			</div>
		</AnimatedSection>
	);
}
