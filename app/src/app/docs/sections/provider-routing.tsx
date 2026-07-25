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
						<h3 className="font-semibold text-accent">Intelligent Request Routing</h3>
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
						Primary provider for 87 models. Handles chat, image,
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
						<span className="inline-flex items-center rounded-full bg-warning/20 text-warning px-2.5 py-0.5 text-xs font-medium">Failover</span>
						<span className="font-semibold text-text text-sm">Surplus</span>
					</div>
					<p className="text-sm text-text-muted">
						Failover provider for models with surplusId mappings.
						Activated automatically when the primary provider is unavailable.
					</p>
					<div className="mt-3 flex flex-wrap gap-1">
						<span className="rounded bg-surface px-1.5 py-0.5 text-[10px] text-text-muted border border-border/50">chat</span>
						<span className="rounded bg-surface px-1.5 py-0.5 text-[10px] text-text-muted border border-border/50">reasoning</span>
					</div>
				</div>
				<div className="rounded-xl border border-border bg-surface/50 p-4">
					<div className="flex items-center gap-2 mb-2">
						<span className="inline-flex items-center rounded-full bg-success/20 text-success px-2.5 py-0.5 text-xs font-medium">Free</span>
						<span className="font-semibold text-text text-sm">Gonka / OpenBroker</span>
					</div>
					<p className="text-sm text-text-muted">
						Free-tier provider via OpenBroker. Hosts MiniMax-M2.7 and
						Kimi-K2.6. No API key required — ideal for prototyping.
					</p>
					<div className="mt-3 flex flex-wrap gap-1">
						<span className="rounded bg-surface px-1.5 py-0.5 text-[10px] text-text-muted border border-border/50">chat</span>
						<span className="rounded bg-surface px-1.5 py-0.5 text-[10px] text-text-muted border border-border/50">tools</span>
					</div>
				</div>
			</div>

			<div className="grid gap-4 sm:grid-cols-2">
				<div className="rounded-xl border border-border bg-surface/50 p-4">
					<h3 className="mb-2 font-semibold text-text text-sm">How Routing Works</h3>
					<ol className="space-y-1.5 text-sm text-text-muted list-decimal list-inside">
						<li>Request arrives with a model id</li>
						<li>OMA looks up the model→provider mapping in the catalog</li>
						<li>The model&apos;s primary provider handles the request</li>
						<li>On failure, circuit breaker triggers failover to alternates</li>
						<li>Each model maps to exactly one or more upstream providers</li>
					</ol>
				</div>
				<div className="rounded-xl border border-border bg-surface/50 p-4">
					<h3 className="mb-2 font-semibold text-text text-sm">Response Headers</h3>
					<p className="text-sm text-text-muted mb-3">
						Each response includes the provider that handled the request:
					</p>
					<div className="space-y-1 font-mono text-xs text-text-muted">
						<div>
							<span className="text-accent">x-provider</span>: venice | gonka
						</div>
					</div>
				</div>
			</div>
		</AnimatedSection>
	);
}
