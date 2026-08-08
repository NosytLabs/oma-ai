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
import { Play } from "lucide-react";

// Derive canonical/OG host from env so preview/staging don't emit prod tags.
const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://oma-ai.com";
import {
 MODELS,
 deriveCapabilities,
 formatContextLength,
 normalizeProvider,
 PROVIDER_COLORS,
 TIER_COLORS,
 type Capability,
 type Model,
 type Tier,
} from "@/lib/models-data";

/** SSG: pre-render the hand-picked models in the static fallback catalog. */
export function generateStaticParams() {
 return MODELS.map((m) => ({ slug: m.id }));
}

/** Allow non-pre-rendered slugs (the long-tail models served by
 * `/v1/models`) to render on demand instead of 404'ing. The page body
 * falls back to a minimal view for slugs that aren't in the static
 * curated catalog. */
export const dynamicParams = true;

/** Raw entry shape actually returned by `GET /v1/models` (OpenAI-style:
 * per-token USD strings under `pricing`, context under `context_length`). */
type LiveModelDetail = {
 id: string;
 category?: "budget" | "mid" | "premium" | "frontier" | string;
 context_length?: number | null;
 provider?: string;
 pricing?: { prompt?: string; completion?: string | null };
 architecture?: {
 input_modalities: string[];
 output_modalities: string[];
 };
 supported_parameters?: string[];
};

/** "qwen3-235b-a22b-instruct" → "Qwen3 235b A22b Instruct" (matches the
 * humanization used by the /models listing for long-tail entries). */
function liveDisplayName(id: string): string {
 return id
 .replace(/^(openai|minimax|together|deepinfra|venice)\//i, "")
 .split(/[-_]/)
 .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : ""))
 .filter(Boolean)
 .join(" ");
}

/** `fetchLiveModel` is called once from `generateMetadata` and again from the
 * page body. Wrapping with React's `cache()` dedupes both calls within a
 * single request — same slug shares one network round-trip — while leaving
 * the `revalidate: 300` cache policy in place for cross-request reuse. */
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

/** Per-token USD string → $/1M tokens, or undefined when absent. */
function livePricePer1M(perToken: string | null | undefined): number | undefined {
 if (!perToken) return undefined;
 const n = parseFloat(perToken);
 return Number.isFinite(n) ? n * 1_000_000 : undefined;
}

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
 url: `${SITE_URL}/models/${model.id}`,
 images: [{ url: "/og-image.webp", width: 1280, height: 720 }],
 },
 twitter: { card: "summary_large_image", title, description },
 alternates: { canonical: `${SITE_URL}/models/${model.id}` },
 };
 }
 // Long-tail model from the live catalog — minimal metadata.
 const live = await fetchLiveModel(slug);
 if (!live) return { title: "Model not found" };
 const name = liveDisplayName(slug);
 return {
 title: name,
 description: `${name} — served via the OMA gateway. ${formatLivePrice(livePricePer1M(live.pricing?.prompt))}/M input, ${formatLivePrice(livePricePer1M(live.pricing?.completion))}/M output.`,
 alternates: { canonical: `${SITE_URL}/models/${slug}` },
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

function formatContextWithVisual(contextLength: number | string | undefined | null): string {
 if (!contextLength) return "—";
 const num = typeof contextLength === "string" ? parseInt(contextLength.replace(/[^\d]/g, ""), 10) : contextLength;
 if (!Number.isFinite(num) || num <= 0) return "—";
 
 // Approximate pages: assuming ~250 words per page, ~1.5 tokens per word
 const wordsPerPage = 250;
 const tokensPerWord = 1.5;
 const tokensPerPage = wordsPerPage * tokensPerWord;
 const pages = Math.round(num / tokensPerPage);

 if (pages >= 1000) {
 return `${Math.round(pages / 1000)}k pages (${num.toLocaleString()} tokens)`;
 }
 return `${pages} pages (${num.toLocaleString()} tokens)`;
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
 // rather than 404 — `/v1/models` returns the curated catalog (22 models
 // today), all of which the /models listing links to detail pages for.
 const live = await fetchLiveModel(slug);
 if (!live) notFound();
 return <LiveModelDetail slug={slug} live={live} />;
}

function StaticModelDetail({ model }: { model: Model }) {
 const tier = TIER_COLORS[model.tier];
 const provider = PROVIDER_COLORS[model.provider];
 const inputPrice = formatPrice(model.inputPricePer1M);
 const outputPrice = formatPrice(model.outputPricePer1M);

 // Code example strings — extracted out of JSX so curly braces in the JSON
 // body aren't interpreted as JSX expressions (was causing TS1005 errors).
 const curlExample = `curl https://api.oma-ai.com/v1/chat/completions \\
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

 const pythonExample = `import openai

client = openai.OpenAI(
 api_key=os.getenv("OMA_API_KEY"),
 base_url="https://api.oma-ai.com/v1"
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

 const jsExample = `import OpenAI from "openai";

const client = new OpenAI({
 apiKey: process.env.OMA_API_KEY,
 baseURL: "https://api.oma-ai.com/v1"
});

const response = await client.chat.completions.create({
 model: "${model.id}",
 messages: [
 { role: "user", content: "Hello, how are you?" }
 ],
 max_tokens: 150,
 temperature: 0.7
});

// console.log(response.choices[0].message.content);`;

 return (
 <div className="min-h-screen bg-void">
 <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-12">
 <nav aria-label="Breadcrumb" className="mb-6 text-xs text-text-muted">
 <Link href="/models" className="hover:text-accent transition-colors duration-200 ease-out">
 ← All models
 </Link>
 </nav>

 <header className="mb-10">
 {/* Prominent Try in Playground CTA */}
 <div className="mb-6">
 <Link
 href={`/chat?model=${model.id}`}
 className="btn-primary w-full md:w-auto px-6 py-3 flex items-center justify-center gap-2 text-base font-semibold"
 >
 <Play className="h-4 w-4 fill-current" aria-hidden="true" /> Try in Playground
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
 value={formatContextWithVisual(model.contextLength)}
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
 {/* In a real implementation, we'd get actual modality data */}
 <span className="px-2 py-0.5 rounded-[var(--radius-sm)] text-[9px] font-medium bg-surface text-text-secondary border border-border/50">
 Text
 </span>
 </span>
 </div>
 <div className="flex items-center gap-3">
 <span className="text-text-muted font-mono">Output:</span>
 <span className="flex flex-wrap gap-1">
 <span className="px-2 py-0.5 rounded-[var(--radius-sm)] text-[9px] font-medium bg-surface text-text-secondary border border-border/50">
 Text
 </span>
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
 {["temperature", "top_p", "max_tokens", "stream", "frequency_penalty", "presence_penalty", "stop", "tools", "tool_choice"].map((param) => (
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
 your <code className="font-mono">/v1/chat/completions</code>{""}
 request, or pass{""}
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
 <h3 className="font-mono text-sm uppercase tracking-widest text-text-muted mb-2">cURL</h3>
 <pre className="text-xs font-mono bg-[color-mix(in_srgb,var(--color-background)_90%,transparent)] p-3 rounded-[var(--radius-sm)] overflow-auto"><code>{curlExample}</code></pre>
 </div>
 <div className="bg-surface rounded-[var(--radius-xl)] border border-border/50 p-4">
 <h3 className="font-mono text-sm uppercase tracking-widest text-text-muted mb-2">Python</h3>
 <pre className="text-xs font-mono bg-[color-mix(in_srgb,var(--color-background)_90%,transparent)] p-3 rounded-[var(--radius-sm)] overflow-auto"><code>{pythonExample}</code></pre>
 </div>
 <div className="bg-surface rounded-[var(--radius-xl)] border border-border/50 p-4">
 <h3 className="font-mono text-sm uppercase tracking-widest text-text-muted mb-2">JavaScript</h3>
 <pre className="text-xs font-mono bg-[color-mix(in_srgb,var(--color-background)_90%,transparent)] p-3 rounded-[var(--radius-sm)] overflow-auto"><code>{jsExample}</code></pre>
 </div>
 </div>
 </section>

 <div className="flex flex-wrap gap-3 pt-6 border-t border-border">
 <Link href={`/chat?model=${model.id}`} className="btn-primary">
 Use in Playground →
 </Link>
<Link
	href="/pricing"
	className="btn-secondary"
>
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

/** Minimal detail view for long-tail models served by `/v1/models`. We don't
 * have rich provider metadata for these — show what we have plus capabilities
 * derived from the model ID so users see something useful rather than a wall
 * of "—". */
function LiveModelDetail({
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
 const caps: Capability[] = deriveCapabilities(slug, name, undefined, undefined);
 
 // Format prices for display
 const inputPricePer1M = livePricePer1M(live.pricing?.prompt);
 const outputPricePer1M = livePricePer1M(live.pricing?.completion);
 const inputPrice = formatPrice(inputPricePer1M ?? 0);
 const outputPrice = formatPrice(outputPricePer1M ?? 0);

 // Code example strings — extracted out of JSX so curly braces in the JSON
 // body aren't interpreted as JSX expressions (was causing TS1005 errors).
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
});

// console.log(response.choices[0].message.content);`;

 return (
 <div className="min-h-screen bg-void">
 <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-12">
 <nav aria-label="Breadcrumb" className="mb-6 text-xs text-text-muted">
 <Link href="/models" className="hover:text-accent transition-colors duration-200 ease-out">
 ← All models
 </Link>
 </nav>

 <header className="mb-10">
 {/* Prominent Try in Playground CTA */}
 <div className="mb-6">
 <Link
 href={`/chat?model=${encodeURIComponent(slug)}`}
 className="btn-primary w-full md:w-auto px-6 py-3 flex items-center justify-center gap-2 text-base font-semibold"
 >
 <Play className="h-4 w-4 fill-current" aria-hidden="true" /> Try in Playground
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
 <Stat
 label="Input"
 value={inputPrice}
 unit="/ 1M tokens"
 />
 <Stat
 label="Output"
 value={outputPrice}
 unit="/ 1M tokens"
 />
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
 your <code className="font-mono">/v1/chat/completions</code>{""}
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
 <h3 className="font-mono text-sm uppercase tracking-widest text-text-muted mb-2">cURL</h3>
 <pre className="text-xs font-mono bg-[color-mix(in_srgb,var(--color-background)_90%,transparent)] p-3 rounded-[var(--radius-sm)] overflow-auto"><code>{liveCurlExample}</code></pre>
 </div>
 <div className="bg-surface rounded-[var(--radius-xl)] border border-border/50 p-4">
 <h3 className="font-mono text-sm uppercase tracking-widest text-text-muted mb-2">Python</h3>
 <pre className="text-xs font-mono bg-[color-mix(in_srgb,var(--color-background)_90%,transparent)] p-3 rounded-[var(--radius-sm)] overflow-auto"><code>{livePythonExample}</code></pre>
 </div>
 <div className="bg-surface rounded-[var(--radius-xl)] border border-border/50 p-4">
 <h3 className="font-mono text-sm uppercase tracking-widest text-text-muted mb-2">JavaScript</h3>
 <pre className="text-xs font-mono bg-[color-mix(in_srgb,var(--color-background)_90%,transparent)] p-3 rounded-[var(--radius-sm)] overflow-auto"><code>{liveJsExample}</code></pre>
 </div>
 </div>
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
	className="btn-secondary"
>
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
			<div className="text-2xl font-bold font-mono tabular-nums text-text-bright">{value}</div>
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
							className="block p-4 rounded-[var(--radius-lg)] border border-border/50 bg-surface hover:border-accent/40 transition-colors duration-200 ease-out"
						>
							<div className="text-sm font-semibold text-text-bright">
								{m.name}
							</div>
							<div className="text-xs text-text-muted mt-1 font-mono tabular-nums">
								{m.provider} · {formatPrice(m.inputPricePer1M)}/M in ·{""}
								{formatPrice(m.outputPricePer1M)}/M out
							</div>
						</Link>
					</li>
				))}
			</ul>
		</section>
	);
}