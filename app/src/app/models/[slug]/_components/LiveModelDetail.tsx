import Link from "next/link";
import { Play } from "lucide-react";
import {
	CAPABILITY_ICONS,
	CAPABILITY_LABELS,
} from "@/app/models/_lib/capabilities";
import { TIER_LABELS } from "@/app/models/_lib/labels";
import {
	type Capability,
	deriveCapabilities,
	formatContextLength,
	normalizeProvider,
	PROVIDER_COLORS,
	TIER_COLORS,
	type Tier,
} from "@/lib/models-data";
import { playgroundHrefForModel } from "@/lib/playground-href";
import { Stat } from "./ModelDetailShared";

type LiveModelDetail = {
	id: string;
	category?: string;
	context_length?: number | null;
	provider?: string;
	pricing?: { prompt?: string; completion?: string | null };
	architecture?: {
		input_modalities: string[];
		output_modalities: string[];
	};
	supported_parameters?: string[];
};

function liveDisplayName(id: string): string {
	return id
		.replace(/^(openai|minimax|together|deepinfra|venice)\//i, "")
		.split(/[-_]/)
		.map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : ""))
		.filter(Boolean)
		.join(" ");
}

function livePricePer1M(
	perToken: string | null | undefined,
): number | undefined {
	if (!perToken) return undefined;
	const n = parseFloat(perToken);
	return Number.isFinite(n) ? n * 1_000_000 : undefined;
}

function formatPrice(per1M: number): string {
	if (per1M < 0.01) return `$${per1M.toFixed(3)}`;
	return `$${per1M.toFixed(2)}`;
}

export function LiveModelDetail({
	slug,
	live,
}: {
	slug: string;
	live: LiveModelDetail;
}) {
	const name = liveDisplayName(slug);
	const ctx = live.context_length
		? `${formatContextLength(live.context_length)} (${live.context_length.toLocaleString()} tokens)`
		: "—";
	const provider = normalizeProvider(live.provider);
	const providerStyle = PROVIDER_COLORS[provider] ?? PROVIDER_COLORS.Venice;
	const tier: Tier =
		live.category === "budget" ||
		live.category === "mid" ||
		live.category === "premium" ||
		live.category === "frontier"
			? live.category
			: "mid";
	const tierStyle = TIER_COLORS[tier];
	const caps: Capability[] = deriveCapabilities(
		slug,
		name,
		undefined,
		undefined,
	);

	const inputPricePer1M = livePricePer1M(live.pricing?.prompt);
	const outputPricePer1M = livePricePer1M(live.pricing?.completion);
	const inputPrice = formatPrice(inputPricePer1M ?? 0);
	const outputPrice = formatPrice(outputPricePer1M ?? 0);

	const liveCurlExample = `curl https://api.oma-ai.com/v1/chat/completions \\
	-H "Content-Type: application/json" \\
	-H "Authorization: Bearer $OMA_API_KEY" \\
	-d '{
	"model": "${encodeURIComponent(slug)}",
	"messages": [
	{ "role": "user", "content": "Hello, how are you?" }
	],
	"max_tokens": 150,
	"temperature": 0.7
	}'`;

	const livePythonExample = `import os
import openai

client = openai.OpenAI(
	api_key=os.getenv("OMA_API_KEY"),
	base_url="https://api.oma-ai.com/v1"
)

response = client.chat.completions.create(
	model="${encodeURIComponent(slug)}",
	messages=[
	{"role": "user", "content": "Hello, how are you?"}
	],
	max_tokens=150,
	temperature=0.7
)

print(response.choices[0].message.content)`;

	const liveJsExample = `import OpenAI from "openai";

const client = new OpenAI({
	apiKey: process.env.OMA_API_KEY,
	baseURL: "https://api.oma-ai.com/v1"
});

const response = await client.chat.completions.create({
	model: "${encodeURIComponent(slug)}",
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
							href={playgroundHrefForModel({ id: slug })}
							className="btn-primary inline-flex items-center justify-center gap-2 px-6 py-3 text-base font-semibold w-fit"
						>
							<Play className="h-4 w-4 fill-current" aria-hidden="true" /> Try
							in Playground
						</Link>
					</div>

					<div className="flex flex-wrap items-center gap-2 mb-3">
						<span
							className={`inline-flex items-center px-2.5 py-1 rounded-[var(--radius-md)] border text-[10px] font-mono uppercase tracking-wider ${providerStyle.bg} ${providerStyle.text} ${providerStyle.border}`}
						>
							{provider}
						</span>
						<span
							className={`inline-flex items-center px-2.5 py-1 rounded-[var(--radius-md)] border text-[10px] font-mono uppercase tracking-wider ${tierStyle.bg} ${tierStyle.text} ${tierStyle.border}`}
						>
							{TIER_LABELS[tier]}
						</span>
					</div>
					<h1 className="h1-page text-text-bright mb-3">{name}</h1>
					<p className="text-lg text-text-secondary max-w-3xl">
						Live catalog entry. Open it in the chat to try it, or call it
						directly via <code className="font-mono">/v1/chat/completions</code>
						.
					</p>
				</header>

				<div className="grid gap-6 sm:grid-cols-3 mb-10">
					<Stat label="Input" value={inputPrice} unit="/ 1M tokens" />
					<Stat label="Output" value={outputPrice} unit="/ 1M tokens" />
					<Stat label="Context window" value={ctx} unit="" />
				</div>

				{live.architecture && (
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
									{live.architecture.input_modalities.map((mod, index) => (
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
									{live.architecture.output_modalities.map((mod, index) => (
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
				)}

				{live.supported_parameters && (
					<section aria-labelledby="parameters-heading" className="mb-10">
						<h2
							id="parameters-heading"
							className="font-mono text-xs uppercase tracking-widest text-text-muted mb-3"
						>
							Supported Parameters
						</h2>
						<div className="overflow-hidden rounded-[var(--radius-xl)] border border-border/50 bg-surface">
							<div className="grid gap-2 p-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
								{live.supported_parameters.map((param) => (
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
							Parameters supported by this model for text generation.
						</p>
					</section>
				)}

				{caps.length > 0 && (
					<section aria-labelledby="capabilities-heading" className="mb-10">
						<h2
							id="capabilities-heading"
							className="font-mono text-xs uppercase tracking-widest text-text-muted mb-3"
						>
							Capabilities (inferred)
						</h2>
						<ul className="flex flex-wrap gap-2">
							{caps.map((c) => (
								<li
									key={c}
									className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-accent/30 bg-accent-dim text-xs font-medium text-accent"
								>
									{CAPABILITY_ICONS[c]}
									{CAPABILITY_LABELS[c]}
								</li>
							))}
						</ul>
						<p className="text-xs text-text-muted mt-2">
							Derived from the model ID; verify against provider docs if
							accuracy matters.
						</p>
					</section>
				)}

				<section aria-labelledby="model-id-heading" className="mb-10">
					<h2
						id="model-id-heading"
						className="font-mono text-xs uppercase tracking-widest text-text-muted mb-3"
					>
						Upstream model ID
					</h2>
					<code className="inline-block px-3 py-2 rounded-[var(--radius-md)] border border-border bg-surface text-sm font-mono text-accent">
						{slug}
					</code>
					<p className="text-xs text-text-muted mt-2">
						Use this ID in the <code className="font-mono">model</code> field of
						your <code className="font-mono">/v1/chat/completions</code>
						{" "}
						request, or pass <code className="font-mono">?model={slug}</code> in
						the chat URL.
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
							<pre className="text-xs font-mono bg-[color-mix(in_srgb,var(--color-background)_90%,transparent)] p-3 rounded-[var(--radius-sm)] overflow-auto">
								<code>{liveCurlExample}</code>
							</pre>
						</div>
						<div className="bg-surface rounded-[var(--radius-xl)] border border-border/50 p-4">
							<h3 className="font-mono text-sm uppercase tracking-widest text-text-muted mb-2">
								Python
							</h3>
							<pre className="text-xs font-mono bg-[color-mix(in_srgb,var(--color-background)_90%,transparent)] p-3 rounded-[var(--radius-sm)] overflow-auto">
								<code>{livePythonExample}</code>
							</pre>
						</div>
						<div className="bg-surface rounded-[var(--radius-xl)] border border-border/50 p-4">
							<h3 className="font-mono text-sm uppercase tracking-widest text-text-muted mb-2">
								JavaScript
							</h3>
							<pre className="text-xs font-mono bg-[color-mix(in_srgb,var(--color-background)_90%,transparent)] p-3 rounded-[var(--radius-sm)] overflow-auto">
								<code>{liveJsExample}</code>
							</pre>
						</div>
					</div>
				</section>

				<div className="flex flex-wrap gap-3 pt-6 border-t border-border">
					<Link
						href={playgroundHrefForModel({ id: slug })}
						className="btn-primary"
					>
						Use in Playground →
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
			</div>
		</div>
	);
}
