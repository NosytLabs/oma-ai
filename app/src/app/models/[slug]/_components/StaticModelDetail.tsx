import Link from "next/link";
import { Play } from "lucide-react";
import {
	CAPABILITY_ICONS,
	CAPABILITY_LABELS,
} from "@/app/models/_lib/capabilities";
import { TIER_LABELS } from "@/app/models/_lib/labels";
import {
	PROVIDER_COLORS,
	TIER_COLORS,
	formatContextLength,
	type Model,
} from "@/lib/models-data";
import { playgroundHrefForModel } from "@/lib/playground-href";
import { CopyableCode } from "@/components/copyable-code";
import { Stat, RelatedModels } from "./ModelDetailShared";

function formatPrice(per1M: number): string {
	if (per1M < 0.01) return `$${per1M.toFixed(3)}`;
	return `$${per1M.toFixed(2)}`;
}

function formatContextWithVisual(tokens: number | undefined | null): string {
	// Context window is a TOKEN metric. An earlier "pages" label was an
	// unsourced conversion (it implied a page size nobody agreed on) and
	// contradicted the catalogue's own "200K ctx" labelling. Reuse the
	// canonical formatter so static and live model pages cannot drift.
	if (typeof tokens !== "number") return "—";
	return `${formatContextLength(tokens)} (${tokens.toLocaleString()} tokens)`;
}

export function StaticModelDetail({ model }: { model: Model }) {
	const tier = TIER_COLORS[model.tier];
	const provider = PROVIDER_COLORS[model.provider];
	const inputPrice = formatPrice(model.inputPricePer1M);
	const outputPrice = formatPrice(model.outputPricePer1M);

	const curlExample = `curl https://www.oma-ai.com/api/v1/chat/completions \\
	-H "Content-Type: application/json" \\
	-H "Authorization: Bearer $OMA_API_KEY" \\
	-d '{
	"model": "${model.id}",
	"messages": [
	{ "role": "user", "content": "Hello, how are you?" }
	],
	"max_tokens": 150,
	"temperature": 0.7
	}'`;

	const pythonExample = `import os
import openai

client = openai.OpenAI(
	api_key=os.getenv("OMA_API_KEY"),
	base_url="https://www.oma-ai.com/api/v1"
)

response = client.chat.completions.create(
	model="${model.id}",
	messages=[
	{"role": "user", "content": "Hello, how are you?"}
	],
	max_tokens=150,
	temperature=0.7
)

print(response.choices[0].message.content)`;

	// The `openai` Node package is CommonJS: a default import is not callable
	// under the documented `new OpenAI(...)` form in native ESM. The named
	// import is the correct, copy-pasteable shape.
	const jsExample = `import { OpenAI } from "openai";

const client = new OpenAI({
	apiKey: process.env.OMA_API_KEY,
	baseURL: "https://www.oma-ai.com/api/v1"
});

const response = await client.chat.completions.create({
	model: "${model.id}",
	messages: [
	{ role: "user", content: "Hello, how are you?" }
	],
	max_tokens: 150,
	temperature: 0.7
});`;

	return (
		<div className="bg-void">
			<div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-12">
				<nav aria-label="Breadcrumb" className="mb-6 text-xs text-text-muted">
					<Link
						href="/models"
						className="hover:text-accent transition-colors duration-200 ease-out"
					>
						← All models
					</Link>
				</nav>

				<header className="mb-10">
					<div className="mb-6">
						<Link
							href={playgroundHrefForModel(model.id)}
							className="btn-primary inline-flex items-center justify-center gap-2 px-6 py-3 text-base font-semibold w-fit"
						>
							<Play className="h-4 w-4 fill-current" aria-hidden="true" /> Try
							in Playground
						</Link>
					</div>

					<div className="flex flex-wrap items-center gap-2 mb-3">
						<span
							className={`inline-flex items-center px-2.5 py-1 rounded-[var(--radius-md)] border text-[10px] font-mono uppercase tracking-wider ${provider.bg} ${provider.text} ${provider.border}`}
						>
							{model.provider}
						</span>
						<span
							className={`inline-flex items-center px-2.5 py-1 rounded-[var(--radius-md)] border text-[10px] font-mono uppercase tracking-wider ${tier.bg} ${tier.text} ${tier.border}`}
						>
							{TIER_LABELS[model.tier]}
						</span>
					</div>
					<h1 className="h1-page text-text-bright mb-3">{model.name}</h1>
					<p className="text-lg text-text-secondary max-w-3xl">
						{model.description}
					</p>
				</header>

				<div className="grid gap-6 sm:grid-cols-3 mb-10">
					<Stat label="Input" value={inputPrice} unit="/ 1M tokens" />
					<Stat label="Output" value={outputPrice} unit="/ 1M tokens" />
					<Stat
						label="Context window"
						value={formatContextWithVisual(model.contextTokens)}
						unit=""
					/>
				</div>

				<section aria-labelledby="capabilities-heading" className="mb-10">
					<h2
						id="capabilities-heading"
						className="font-mono text-xs uppercase tracking-widest text-text-muted mb-3"
					>
						Capabilities
					</h2>
					<ul className="flex flex-wrap gap-2">
						{model.capabilities.map((c) => (
							<li
								key={c}
								className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-accent/30 bg-accent-dim text-xs font-medium text-accent"
							>
								{CAPABILITY_ICONS[c]}
								{CAPABILITY_LABELS[c]}
							</li>
						))}
					</ul>
				</section>

			<section aria-labelledby="architecture-heading" className="mb-10">
				<h2
					id="architecture-heading"
					className="font-mono text-xs uppercase tracking-widest text-text-muted mb-3"
				>
					Architecture
				</h2>
				<div className="space-y-2">
					<div className="flex items-center gap-3">
						<span className="text-text-muted font-mono">Input:</span>
						<span className="flex flex-wrap gap-1">
							{(model.inputModalities ?? ["text"]).map((mod, index) => (
								<span
									key={`input-${mod}-${index}`}
									className="px-2 py-0.5 rounded-[var(--radius-sm)] text-[9px] font-medium bg-surface text-text-secondary border border-border/50"
								>
									{mod.charAt(0).toUpperCase() + mod.slice(1)}
								</span>
							))}
						</span>
					</div>
					<div className="flex items-center gap-3">
						<span className="text-text-muted font-mono">Output:</span>
						<span className="flex flex-wrap gap-1">
							{(model.outputModalities ?? ["text"]).map((mod, index) => (
								<span
									key={`output-${mod}-${index}`}
									className="px-2 py-0.5 rounded-[var(--radius-sm)] text-[9px] font-medium bg-surface text-text-secondary border border-border/50"
								>
									{mod.charAt(0).toUpperCase() + mod.slice(1)}
								</span>
							))}
						</span>
					</div>
				</div>
			</section>

				<section aria-labelledby="parameters-heading" className="mb-10">
					<h2
						id="parameters-heading"
						className="font-mono text-xs uppercase tracking-widest text-text-muted mb-3"
					>
						Supported Parameters
					</h2>
					<div className="overflow-hidden rounded-[var(--radius-xl)] border border-border/50 bg-surface">
						<div className="grid gap-2 p-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
							{[
								"temperature",
								"top_p",
								"max_tokens",
								"stream",
								"frequency_penalty",
								"presence_penalty",
								"stop",
								"tools",
								"tool_choice",
							].map((param) => (
								<span
									key={param}
									className="px-3 py-2 rounded-[var(--radius-sm)] text-xs font-mono bg-[color-mix(in_srgb,var(--color-accent)_5%,transparent)]"
								>
									{param}
								</span>
							))}
						</div>
					</div>
					<p className="text-xs text-text-muted mt-2">
						Common parameters supported by this model for text generation.
					</p>
				</section>

				<section aria-labelledby="model-id-heading" className="mb-10">
					<h2
						id="model-id-heading"
						className="font-mono text-xs uppercase tracking-widest text-text-muted mb-3"
					>
						Upstream model ID
					</h2>
					<code className="inline-block px-3 py-2 rounded-[var(--radius-md)] border border-border bg-surface text-sm font-mono text-accent">
						{model.modelId}
					</code>
					<p className="text-xs text-text-muted mt-2">
						Use this ID in the <code className="font-mono">model</code> field of
						your <code className="font-mono">/v1/chat/completions</code>
						{" "}
						request, or pass{" "}
						<code className="font-mono">?model={model.id}</code> in the chat
						URL.
					</p>
				</section>

<section aria-labelledby="api-example-heading" className="mb-10">
				<h2
					id="api-example-heading"
					className="font-mono text-xs uppercase tracking-widest text-text-muted mb-3"
				>
					API Usage Example
				</h2>
				<div className="space-y-4">
					<div className="bg-surface rounded-[var(--radius-xl)] border border-border/50 p-4">
						<h3 className="font-mono text-sm uppercase tracking-widest text-text-muted mb-2">
							cURL
						</h3>
						<CopyableCode code={curlExample} aria-label={`${model.name} cURL example`} />
					</div>
					<div className="bg-surface rounded-[var(--radius-xl)] border border-border/50 p-4">
						<h3 className="font-mono text-sm uppercase tracking-widest text-text-muted mb-2">
							Python
						</h3>
						<CopyableCode code={pythonExample} aria-label={`${model.name} Python example`} />
					</div>
					<div className="bg-surface rounded-[var(--radius-xl)] border border-border/50 p-4">
						<h3 className="font-mono text-sm uppercase tracking-widest text-text-muted mb-2">
							JavaScript
						</h3>
						<CopyableCode code={jsExample} aria-label={`${model.name} JavaScript example`} />
					</div>
				</div>
			</section>

				<div className="flex flex-wrap gap-3 pt-6 border-t border-border">
					<Link
						href={playgroundHrefForModel(model.id)}
						className="btn-primary"
					>
						Use in playground
					</Link>
					<Link href="/pricing" className="btn-secondary">
						Compare pricing
					</Link>
					<Link
						href="/docs"
						className="inline-flex items-center px-5 py-2.5 rounded-[var(--radius-sm)] text-text-secondary hover:text-accent transition-[color,transform] duration-200 ease-out active:scale-[0.97]"
					>
						API reference
					</Link>
				</div>

				<RelatedModels current={model} />
			</div>
		</div>
	);
}
