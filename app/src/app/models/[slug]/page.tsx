import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import {
	CAPABILITY_ICONS,
	CAPABILITY_LABELS,
} from "@/app/models/_lib/capabilities";
import { TIER_LABELS } from "@/app/models/_lib/labels";
import { DEFAULT_API_URL } from "@/lib/config";
import {
	MODELS,
	type Model,
	PROVIDER_COLORS,
	TIER_COLORS,
} from "@/lib/models-data";

/** SSG: pre-render the hand-picked models in the static fallback catalog. */
export function generateStaticParams() {
	return MODELS.map((m) => ({ slug: m.id }));
}

/** Allow non-pre-rendered slugs (the long-tail models served by
 *  `/v1/models`) to render on demand instead of 404'ing. The page body
 *  falls back to a minimal view for slugs that aren't in the static
 *  curated catalog. */
export const dynamicParams = true;

/** Raw entry shape actually returned by `GET /v1/models` (OpenAI-style:
 *  per-token USD strings under `pricing`, context under `context_length`). */
type LiveModelDetail = {
	id: string;
	category?: "budget" | "mid" | "premium" | "frontier" | string;
	context_length?: number | null;
	provider?: string;
	pricing?: { prompt?: string; completion?: string | null };
};

/** Per-token USD string → $/1M tokens, or undefined when absent. */
function livePricePer1M(perToken: string | null | undefined): number | undefined {
	if (!perToken) return undefined;
	const n = parseFloat(perToken);
	return Number.isFinite(n) ? n * 1_000_000 : undefined;
}

/** "qwen3-235b-a22b-instruct" → "Qwen3 235b A22b Instruct" (matches the
 *  humanization used by the /models listing for long-tail entries). */
function liveDisplayName(id: string): string {
	return id
		.replace(/^(openai|minimax|together|deepinfra)\//i, "")
		.split(/[-_]/)
		.map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : ""))
		.filter(Boolean)
		.join(" ");
}

/** `fetchLiveModel` is called once from `generateMetadata` and again from the
 *  page body. Wrapping with React's `cache()` dedupes both calls within a
 *  single request — same slug shares one network round-trip — while leaving
 *  the `revalidate: 300` cache policy in place for cross-request reuse. */
const fetchLiveModel = cache(
	async (slug: string): Promise<LiveModelDetail | null> => {
		const apiBase = DEFAULT_API_URL;
		try {
			const res = await fetch(`${apiBase}/v1/models`, {
				// Cache at the Next.js layer for 5 minutes so SSG-style routes don't
				// hammer the API on every request, but stale enough to pick up new
				// catalog entries promptly.
				next: { revalidate: 300 },
			});
			if (!res.ok) return null;
			const json = (await res.json()) as { data?: LiveModelDetail[] };
			const match = json.data?.find((m) => m.id === slug);
			return match ?? null;
		} catch {
			return null;
		}
	},
);

export async function generateMetadata({
	params,
}: {
	params: Promise<{ slug: string }>;
}): Promise<Metadata> {
	const { slug } = await params;
	const model = MODELS.find((m) => m.id === slug);
	if (model) {
		// Root template appends "· OMA" — don't bake the brand in here too.
		const title = `${model.name} · ${model.provider}`;
		const description = `${model.description} ${formatPrice(model.inputPricePer1M)}/M input, ${formatPrice(model.outputPricePer1M)}/M output, ${model.contextLength} context.`;
		return {
			title,
			description,
			openGraph: {
				title,
				description,
				url: `https://oma-ai.com/models/${model.id}`,
				images: [{ url: "/og-image.webp", width: 1280, height: 720 }],
			},
			twitter: { card: "summary_large_image", title, description },
			alternates: { canonical: `https://oma-ai.com/models/${model.id}` },
		};
	}
	// Long-tail model from the live catalog — minimal metadata.
	const live = await fetchLiveModel(slug);
	if (!live) return { title: "Model not found" };
	const name = liveDisplayName(slug);
	return {
		title: name,
		description: `${name} — served via the OMA gateway. ${formatLivePrice(livePricePer1M(live.pricing?.prompt))}/M input, ${formatLivePrice(livePricePer1M(live.pricing?.completion))}/M output.`,
		alternates: { canonical: `https://oma-ai.com/models/${slug}` },
	};
}

function formatPrice(per1M: number): string {
	if (per1M < 0.01) return `$${per1M.toFixed(3)}`;
	return `$${per1M.toFixed(2)}`;
}

function formatLivePrice(per1M: number | undefined): string {
	if (typeof per1M !== "number" || !Number.isFinite(per1M)) return "—";
	return formatPrice(per1M);
}

export default async function ModelDetailPage({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const { slug } = await params;
	const staticModel = MODELS.find((m) => m.id === slug);
	if (staticModel) {
		return <StaticModelDetail model={staticModel} />;
	}

	// Long-tail model from the live catalog. Fall back to a minimal page
	// rather than 404 — `/v1/models` returns 90+ entries, all of which the
	// /models listing links to detail pages for.
	const live = await fetchLiveModel(slug);
	if (!live) notFound();
	return <LiveModelDetail slug={slug} live={live} />;
}

function StaticModelDetail({ model }: { model: Model }) {
	const tier = TIER_COLORS[model.tier];
	const provider = PROVIDER_COLORS[model.provider];
	const inputPrice = formatPrice(model.inputPricePer1M);
	const outputPrice = formatPrice(model.outputPricePer1M);

	return (
		<div className="min-h-screen bg-void">
			<div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-12">
				<nav aria-label="Breadcrumb" className="mb-6 text-xs text-text-muted">
					<Link href="/models" className="hover:text-accent transition-colors">
						← All models
					</Link>
				</nav>

				<header className="mb-10">
					<div className="flex flex-wrap items-center gap-2 mb-3">
						<span
							className={`inline-flex items-center px-2.5 py-1 rounded-md border text-[10px] font-mono uppercase tracking-wider ${provider.bg} ${provider.text} ${provider.border}`}
						>
							{model.provider}
						</span>
						<span
							className={`inline-flex items-center px-2.5 py-1 rounded-md border text-[10px] font-mono uppercase tracking-wider ${tier.bg} ${tier.text} ${tier.border}`}
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
						value={model.contextLength}
						unit="tokens"
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

				<section aria-labelledby="model-id-heading" className="mb-10">
					<h2
						id="model-id-heading"
						className="font-mono text-xs uppercase tracking-widest text-text-muted mb-3"
					>
						Upstream model ID
					</h2>
					<code className="inline-block px-3 py-2 rounded-md border border-border bg-surface text-sm font-mono text-accent">
						{model.modelId}
					</code>
					<p className="text-xs text-text-muted mt-2">
						Use this ID in the <code className="font-mono">model</code> field of
						your <code className="font-mono">/v1/chat/completions</code>{" "}
						request, or pass{" "}
						<code className="font-mono">?model={model.id}</code> in the chat
						URL.
					</p>
				</section>

				<div className="flex flex-wrap gap-3 pt-6 border-t border-border">
					<Link href={`/chat?model=${model.id}`} className="btn-primary">
						Use in Playground →
					</Link>
					<Link
						href="/pricing"
						className="inline-flex items-center px-5 py-2.5 rounded-lg border border-border bg-surface text-text-bright hover:border-accent/40 transition-colors"
					>
						Compare pricing
					</Link>
					<Link
						href="/docs"
						className="inline-flex items-center px-5 py-2.5 rounded-lg text-text-secondary hover:text-accent transition-colors"
					>
						API reference
					</Link>
				</div>

				<RelatedModels current={model} />
			</div>
		</div>
	);
}

/** Minimal detail view for long-tail models served by `/v1/models`. We don't
 *  have provider/tier/capabilities metadata for these — show what we have
 *  and link to the playground so users can try the model. */
function LiveModelDetail({
	slug,
	live,
}: {
	slug: string;
	live: LiveModelDetail;
}) {
	const name = liveDisplayName(slug);
	const ctx = live.context_length
		? `${live.context_length.toLocaleString()} tokens`
		: "—";
	return (
		<div className="min-h-screen bg-void">
			<div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-12">
				<nav aria-label="Breadcrumb" className="mb-6 text-xs text-text-muted">
					<Link href="/models" className="hover:text-accent transition-colors">
						← All models
					</Link>
				</nav>

				<header className="mb-10">
					<h1 className="h1-page text-text-bright mb-3">{name}</h1>
					<p className="text-lg text-text-secondary max-w-3xl">
						Live catalog entry. Open it in the chat to try it, or call it
						directly via <code className="font-mono">/v1/chat/completions</code>
						.
					</p>
				</header>

				<div className="grid gap-6 sm:grid-cols-3 mb-10">
					<Stat
						label="Input"
						value={formatLivePrice(livePricePer1M(live.pricing?.prompt))}
						unit="/ 1M tokens"
					/>
					<Stat
						label="Output"
						value={formatLivePrice(livePricePer1M(live.pricing?.completion))}
						unit="/ 1M tokens"
					/>
					<Stat label="Context window" value={ctx} unit="" />
				</div>

				<section aria-labelledby="model-id-heading" className="mb-10">
					<h2
						id="model-id-heading"
						className="font-mono text-xs uppercase tracking-widest text-text-muted mb-3"
					>
						Upstream model ID
					</h2>
					<code className="inline-block px-3 py-2 rounded-md border border-border bg-surface text-sm font-mono text-accent">
						{slug}
					</code>
					<p className="text-xs text-text-muted mt-2">
						Use this ID in the <code className="font-mono">model</code> field of
						your <code className="font-mono">/v1/chat/completions</code>{" "}
						request, or pass <code className="font-mono">?model={slug}</code> in
						the chat URL.
					</p>
				</section>

				<div className="flex flex-wrap gap-3 pt-6 border-t border-border">
					<Link
						href={`/chat?model=${encodeURIComponent(slug)}`}
						className="btn-primary"
					>
						Use in Playground →
					</Link>
					<Link
						href="/pricing"
						className="inline-flex items-center px-5 py-2.5 rounded-lg border border-border bg-surface text-text-bright hover:border-accent/40 transition-colors"
					>
						Compare pricing
					</Link>
					<Link
						href="/docs"
						className="inline-flex items-center px-5 py-2.5 rounded-lg text-text-secondary hover:text-accent transition-colors"
					>
						API reference
					</Link>
				</div>
			</div>
		</div>
	);
}

function Stat({
	label,
	value,
	unit,
}: {
	label: string;
	value: string;
	unit: string;
}) {
	return (
		<div className="rounded-2xl border border-border/50 bg-surface p-5">
			<div className="font-mono text-[10px] uppercase tracking-widest text-text-muted mb-2">
				{label}
			</div>
			<div className="text-2xl font-bold text-text-bright">{value}</div>
			<div className="text-xs text-text-muted mt-1">{unit}</div>
		</div>
	);
}

function RelatedModels({ current }: { current: Model }) {
	// Show up to 4 other models in the same tier
	const related = MODELS.filter(
		(m) => m.tier === current.tier && m.id !== current.id,
	).slice(0, 4);
	if (related.length === 0) return null;
	return (
		<section
			aria-labelledby="related-heading"
			className="mt-12 pt-10 border-t border-border"
		>
			<h2
				id="related-heading"
				className="font-mono text-xs uppercase tracking-widest text-text-muted mb-4"
			>
				Other {TIER_LABELS[current.tier]} models
			</h2>
			<ul className="grid gap-3 sm:grid-cols-2">
				{related.map((m) => (
					<li key={m.id}>
						<Link
							href={`/models/${m.id}`}
							className="block p-4 rounded-lg border border-border/50 bg-surface hover:border-accent/40 transition-colors"
						>
							<div className="text-sm font-semibold text-text-bright">
								{m.name}
							</div>
							<div className="text-xs text-text-muted mt-1">
								{m.provider} · {formatPrice(m.inputPricePer1M)}/M in ·{" "}
								{formatPrice(m.outputPricePer1M)}/M out
							</div>
						</Link>
					</li>
				))}
			</ul>
		</section>
	);
}
