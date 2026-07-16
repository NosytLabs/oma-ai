import { BookOpen, Sparkles, Terminal } from "lucide-react";
import { AnimatedSection, CodeBlock, fmt, MODELS, MODEL_COUNT, SectionHeading } from "./shared";

export function AvailableModelsSection() {
	const tiers = [
		{
			id: "budget",
			name: "Budget",
			color: "text-warning",
			badge: "bg-warning/20 text-warning",
			desc: "Fast, cost-effective models for simple tasks and prototyping.",
			models: MODELS.filter((m) => m.tier === "budget"),
		},
		{
			id: "mid",
			name: "Mid-Tier",
			color: "text-accent",
			badge: "bg-accent/20 text-accent",
			desc: "Balanced performance and cost for everyday workloads.",
			models: MODELS.filter((m) => m.tier === "mid"),
		},
		{
			id: "premium",
			name: "Premium",
			color: "text-violet",
			badge: "bg-violet/20 text-violet",
			desc: "High-performance models for demanding tasks.",
			models: MODELS.filter((m) => m.tier === "premium"),
		},
		{
			id: "frontier",
			name: "Frontier",
			color: "text-violet",
			badge: "bg-violet/20 text-violet",
			desc: "State-of-the-art models with maximum capability.",
			models: MODELS.filter((m) => m.tier === "frontier"),
		},
	];

	return (
		<AnimatedSection delay={250}>
			<SectionHeading
				id="models"
				icon={<BookOpen className="h-5 w-5" />}
				title="Available Models"
				subtitle={`${MODEL_COUNT} models across text, image, video, and audio categories.`}
			/>

			<div className="mb-6 grid gap-4 sm:grid-cols-2">
				<div className="rounded-xl border border-border bg-surface/50 p-4">
					<div className="mb-2 flex items-center gap-2">
						<Terminal className="h-4 w-4 text-accent" />
						<span className="font-semibold text-text">Text Models</span>
					</div>
					<p className="text-sm text-text-muted">
						Chat, reasoning, coding, and instruction-following models from
						multiple providers.
					</p>
				</div>
				<div className="rounded-xl border border-border bg-surface/50 p-4">
					<div className="mb-2 flex items-center gap-2">
						<Sparkles className="h-4 w-4 text-accent" />
						<span className="font-semibold text-text">Multimodal</span>
					</div>
					<p className="text-sm text-text-muted">
						Image generation, video generation, audio transcription, and text-to-speech
						models.
					</p>
				</div>
			</div>

			<div className="space-y-6">
				{tiers.map((tier) => (
					<div key={tier.id} className="rounded-xl border border-border bg-surface/50 overflow-hidden">
						<div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
							<div className="flex items-center gap-3">
								<span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${tier.badge}`}>
									{tier.name}
								</span>
								<span className="text-sm text-text-muted">{tier.models.length} models</span>
							</div>
						</div>
						<div className="p-4">
							<p className="mb-4 text-sm text-text-muted">{tier.desc}</p>
							<div className="overflow-x-auto">
								<table
									className="w-full text-left text-sm"
									aria-label={`${tier.name} tier models`}
								>
									<thead>
										<tr className="border-b border-border/50">
											<th className="pb-2 font-medium text-text-muted">Model</th>
											<th className="pb-2 font-medium text-text-muted text-right">Input / 1M</th>
											<th className="pb-2 font-medium text-text-muted text-right">Output / 1M</th>
											<th className="pb-2 font-medium text-text-muted text-right">Context</th>
											<th className="pb-2 font-medium text-text-muted">Capabilities</th>
										</tr>
									</thead>
									<tbody>
										{tier.models.map((m) => (
											<tr key={m.id} className="border-b border-border/30 last:border-0">
												<td className="py-2">
													<code className="font-mono text-xs text-accent">{m.id}</code>
													<div className="text-xs text-text-muted">{m.name}</div>
												</td>
												<td className="py-2 text-right font-mono text-xs text-text-secondary">
													{fmt(m.inputPricePer1M)}
												</td>
												<td className="py-2 text-right font-mono text-xs text-text-secondary">
													{fmt(m.outputPricePer1M)}
												</td>
												<td className="py-2 text-right text-xs text-text-muted">
													{m.contextLength}
												</td>
												<td className="py-2">
													<div className="flex flex-wrap gap-1">
														{m.capabilities.map((cap) => (
															<span key={cap} className="rounded bg-surface px-1.5 py-0.5 text-[10px] text-text-muted border border-border/50">
																{cap}
															</span>
														))}
													</div>
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</div>
					</div>
				))}
			</div>

			<div className="mt-6 rounded-xl border border-accent/20 bg-accent/5 p-4">
				<div className="flex items-start gap-3">
					<Terminal className="h-5 w-5 text-accent mt-0.5" />
					<div>
						<h3 className="font-semibold text-accent">List All Models</h3>
						<p className="mt-1 text-sm text-text-muted">
							Use the <code className="font-mono">GET /v1/models</code> endpoint to fetch the
							current model catalog with pricing and capabilities.
						</p>
						<CodeBlock
							code={`curl https://api.oma-ai.com/v1/models | jq '.data | length'`}
							lang="bash"
						/>
					</div>
				</div>
			</div>
		</AnimatedSection>
	);
}
