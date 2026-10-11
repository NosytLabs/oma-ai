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

			<div className="rounded-[var(--radius-xl)] border border-accent/20 bg-accent/5 p-5 mb-6">
				<div className="flex items-start gap-3">
					<GitBranch className="h-5 w-5 text-accent mt-0.5 shrink-0" />
					<div>
						<h3 className="font-semibold text-accent">Intelligent Request Routing</h3>
						<p className="mt-1 text-sm text-text-muted">
							Every model id resolves to an upstream provider. OMA routes each
							request to the model&apos;s catalog-mapped provider based on
							availability — with circuit-breaker protection against failing
							upstreams.
						</p>
					</div>
				</div>
			</div>

			<div className="mb-6 grid gap-4 sm:grid-cols-2">
				<div id="pr-venice" className="rounded-[var(--radius-xl)] border border-border bg-panel shadow-[var(--shadow-md)] p-4 scroll-mt-24">
					<div className="flex items-center gap-2 mb-2">
						<span className="inline-flex items-center rounded-full bg-accent/20 text-accent px-2.5 py-0.5 text-xs font-medium">Primary</span>
						<span className="font-semibold text-text text-sm">Venice</span>
					</div>
					<p className="text-sm text-text-muted">
						Primary provider for the curated chat catalog. Handles
						chat and multimodal-input workloads with low-latency inference.
					</p>
					<div className="mt-3 flex flex-wrap gap-1">
						<span className="rounded-[var(--radius-sm)] bg-surface px-1.5 py-0.5 text-[10px] text-text-muted border border-border/50">chat</span>
						<span className="rounded-[var(--radius-sm)] bg-surface px-1.5 py-0.5 text-[10px] text-text-muted border border-border/50">vision</span>
						<span className="rounded-[var(--radius-sm)] bg-surface px-1.5 py-0.5 text-[10px] text-text-muted border border-border/50">tools</span>
					</div>
				</div>
				<div id="pr-oma-ai" className="rounded-[var(--radius-xl)] border border-border bg-panel shadow-[var(--shadow-md)] p-4 scroll-mt-24">
					<div className="flex items-center gap-2 mb-2">
						<span className="inline-flex items-center rounded-full bg-success/20 text-success px-2.5 py-0.5 text-xs font-medium">Budget</span>
						<span className="font-semibold text-text text-sm">OMA-AI</span>
					</div>
					<p className="text-sm text-text-muted">
						Budget-tier models branded as OMA-AI — MiniMax M2.7, DeepSeek
						V4 Flash, and GLM-5.3 Flash on Gonka/OpenBroker. MiniMax is the
						current free-chat default; check the live catalog for paused routes.
						Same billing surface and API contract as the rest of the catalog.
					</p>
					<div className="mt-3 flex flex-wrap gap-1">
						<span className="rounded-[var(--radius-sm)] bg-surface px-1.5 py-0.5 text-[10px] text-text-muted border border-border/50">chat</span>
						<span className="rounded-[var(--radius-sm)] bg-surface px-1.5 py-0.5 text-[10px] text-text-muted border border-border/50">tools</span>
						<span className="rounded-[var(--radius-sm)] bg-surface px-1.5 py-0.5 text-[10px] text-text-muted border border-border/50">free-tier</span>
					</div>
				</div>
			</div>

			<div className="grid gap-4 sm:grid-cols-2">
				<div id="pr-how" className="rounded-[var(--radius-xl)] border border-border bg-panel shadow-[var(--shadow-md)] p-4 scroll-mt-24">
					<h3 className="mb-2 font-semibold text-text text-sm">How Routing Works</h3>
					<ol className="space-y-1.5 text-sm text-text-muted list-decimal list-inside">
						<li>Request arrives with a model id</li>
						<li>OMA looks up the model→provider mapping in the catalog</li>
						<li>The model&apos;s primary provider handles the request</li>
						<li>On failure, the circuit breaker may retry a configured fallback for that mapped model</li>
						<li>Check x-actual-model for the model served; paid requests use that model&apos;s listed price</li>
					</ol>
				</div>
				<div className="rounded-[var(--radius-xl)] border border-border bg-panel shadow-[var(--shadow-md)] p-4">
					<h3 className="mb-2 font-semibold text-text text-sm">Response Headers</h3>
					<p className="text-sm text-text-muted mb-3">
						Each response includes the public catalog provider label:
					</p>
					<div className="space-y-1 font-mono text-xs text-text-muted">
						<div>
							<span className="text-accent">x-provider</span>: venice | oma-ai
						</div>
						<div><span className="text-accent">x-actual-model</span>: model served</div>
						<div><span className="text-accent">x-oma-fallback</span>: 1 when a fallback is used</div>
					</div>
				</div>
			</div>

			<p className="mt-4 text-xs leading-relaxed text-text-muted">
				A mapped model may also have a compatible fallback provider configured.
				If a primary provider fails and that fallback is used,
				request content must be forwarded to the inference service that actually
				handles the retry. A fallback can serve another model; its ID appears in
				x-actual-model and usage history. Paid usage is charged at the served model&apos;s
				listed price. Free website requests fall back only to eligible Gonka/OpenBroker models.
				See <a href="/privacy" className="text-accent underline underline-offset-2">Privacy</a> for data-flow details.
			</p>
		</AnimatedSection>
	);
}
