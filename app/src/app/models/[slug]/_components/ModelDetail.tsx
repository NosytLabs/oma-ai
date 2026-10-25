"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, MessageSquare, Wrench, Radio } from "lucide-react";
import { ModelLogo } from "@/components/ui/model-logo";
import { CAPABILITY_ICONS, CAPABILITY_LABELS } from "@/app/models/_lib/capabilities";
import { TIER_LABELS } from "@/app/models/_lib/labels";
import { formatPricePerMillion, type Model } from "@/lib/models-data";
import { isFreeChatModel } from "@/lib/model-utils";
import { playgroundHrefForModel } from "@/lib/playground-href";
import { Stat, RelatedModels } from "./ModelDetailShared";
import { ModelApiExamples } from "./ModelApiExamples";
import { ModelDetailTabs } from "./ModelDetailTabs";

const DETAIL_TABS = [{ id: "overview", label: "Overview" }, { id: "api", label: "API examples" }] as const;
const badgeClass = "inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-border bg-surface px-3 py-2 text-sm text-text-secondary";

export interface ModelRouteDetails {
	model: Model;
	availability: boolean | null;
	supportedParameters?: string[];
	supportsTools?: boolean;
	supportsStreaming?: boolean;
}

export function ModelDetail({ routes, ...initial }: ModelRouteDetails & { routes?: ModelRouteDetails[] }) {
	const [selectedRouteId, setSelectedRouteId] = useState(initial.model.id);
	useEffect(() => {
		function selectLinkedProvider() {
			const id = window.location.hash.slice(1);
			if (routes?.some((route) => route.model.id === id)) setSelectedRouteId(id);
		}
		selectLinkedProvider();
		window.addEventListener("hashchange", selectLinkedProvider);
		return () => window.removeEventListener("hashchange", selectLinkedProvider);
	}, [routes]);
	const { model, availability, supportedParameters, supportsTools, supportsStreaming } =
		routes?.find((route) => route.model.id === selectedRouteId) ?? initial;
	const [tab, setTab] = useState<(typeof DETAIL_TABS)[number]["id"]>("overview");
	const unavailable = availability === false;
	const unverified = model.metadataVerification?.status === "unverified";
	// The curated registry calls tool-capable models "agents". Present that
	// as the concrete API feature, and let an explicit live flag override it.
	const toolCalling = supportsTools ?? model.capabilities.includes("agents");
	const description = model.description.endsWith("— chat / language served by OMA.")
		? "Connect this model to your app through OMA’s OpenAI-compatible API."
		: model.description;
	return (
		<div className="bg-void">
			<div className="container-page py-10 sm:py-14">
				<nav aria-label="Breadcrumb" className="mb-7">
					<Link href="/models" className="inline-flex min-h-9 items-center gap-2 text-sm text-text-muted transition-colors hover:text-text-bright">
						<ArrowLeft className="h-4 w-4" aria-hidden="true" /> All models
					</Link>
				</nav>
				{routes && routes.length > 1 && (
					<section aria-labelledby="provider-routes-heading" className="mb-8 rounded-[var(--radius-xl)] border border-border bg-panel p-5">
						<h2 id="provider-routes-heading" className="font-display text-xl font-medium text-text-bright">Choose a provider</h2>
						<p className="mt-2 text-sm text-text-secondary">Compare this model’s providers. Each provider has its own API ID, pricing, limits and availability.</p>
						<div className="mt-4 grid gap-3 sm:grid-cols-2">
							{routes.map((route) => (
								<button key={route.model.id} id={route.model.id} type="button" aria-pressed={selectedRouteId === route.model.id} onClick={() => { setSelectedRouteId(route.model.id); window.history.replaceState(null, "", `#${route.model.id}`); }} className={`rounded-[var(--radius-lg)] border p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${selectedRouteId === route.model.id ? "border-accent bg-accent/5" : "border-border bg-surface"}`}>
									<span className="block font-medium text-text-bright">{route.model.provider}</span>
									<span className="mt-1 block text-sm text-text-secondary">{formatPricePerMillion(route.model.inputPricePer1M)}/M input · {formatPricePerMillion(route.model.outputPricePer1M)}/M output</span>
									<span className="mt-1 block text-xs text-text-muted">{route.availability === false ? "Currently unavailable" : route.availability === true ? "Enabled" : "Availability unconfirmed"}</span>
								</button>
							))}
						</div>
					</section>
				)}

				<header className="mb-8 flex flex-col justify-between gap-6 lg:flex-row lg:items-start">
					<div className="min-w-0 max-w-3xl">
						<div className="mb-4 flex flex-wrap items-center gap-3 text-xs text-text-secondary">
							<span className="section-eyebrow-caps">AI model</span>
							<span className="text-border" aria-hidden="true">/</span>
							<span>Served by {model.provider}</span>
							<span className="rounded-full border border-border px-2.5 py-1">{TIER_LABELS[model.tier]}</span>
						</div>
						<div className="flex items-center gap-4">
							<ModelLogo modelId={model.id} size={48} />
							<h1 className="font-display text-3xl font-medium leading-tight tracking-tight text-text-bright sm:text-5xl">{model.name}</h1>
						</div>
						<p className="mt-4 max-w-2xl text-base leading-relaxed text-text-secondary sm:text-lg">{description}</p>
					</div>
					<div className="flex shrink-0 flex-col items-start gap-3 lg:items-end lg:pt-9">
						{unavailable ? (
							<span className="rounded-[var(--radius-md)] border border-amber/30 bg-amber/10 px-4 py-3 text-sm font-medium text-amber">Currently unavailable</span>
						) : (
							<Link href={playgroundHrefForModel(model.id)} className="btn-primary inline-flex items-center justify-center gap-2">
								<MessageSquare className="h-4 w-4" aria-hidden="true" /> Try in chat
							</Link>
						)}
						<Link href="/pricing" className="inline-flex min-h-8 items-center text-sm text-text-secondary hover:text-accent">Compare pricing →</Link>
					</div>
				</header>

				{availability !== true && (
					<p role="status" className={`mb-6 rounded-[var(--radius-lg)] border px-4 py-3 text-sm leading-relaxed ${unavailable ? "border-amber/25 bg-amber/5 text-text-secondary" : "border-border bg-panel text-text-muted"}`}>
						{unavailable ? model.unavailableReason ?? "This model is not accepting requests right now. Pricing and API examples remain available for reference." : "Live availability could not be confirmed. Catalog details are shown for reference; availability is checked when you start a chat."}
					</p>
				)}

				<div className="mb-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
					<Stat label="Input price" value={formatPricePerMillion(model.inputPricePer1M)} unit="USD per 1M tokens" />
					<Stat label="Output price" value={formatPricePerMillion(model.outputPricePer1M)} unit="USD per 1M tokens" />
					<Stat label="Context window" value={unverified ? "Unverified" : model.contextLength} unit={unverified ? `OMA configured limit: ${model.contextTokens.toLocaleString("en-US")} tokens` : `${model.contextTokens.toLocaleString("en-US")} tokens`} />
					<Stat label="Maximum output" value={unverified ? "Unverified" : model.maxOutputTokens?.toLocaleString("en-US") ?? "Not specified"} unit={unverified ? `OMA configured limit: ${model.maxOutputTokens?.toLocaleString("en-US") ?? "not specified"} tokens` : "tokens per response"} />
				</div>
				<p className="mb-8 text-xs leading-relaxed text-text-muted">
					{isFreeChatModel(model.id) ? "Free in website chat within the daily limit. API usage is billed at the rates above." : "Pay for the tokens you use. Chat and API usage draw from your account credits."}
				</p>
				{model.metadataVerification && (
					<p className="mb-8 break-words text-xs leading-relaxed text-text-muted">
						{model.metadataVerification.note}{" "}
						<a href={model.metadataVerification.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">Provider catalog</a>{" "}
						checked {model.metadataVerification.verifiedAt}.
					</p>
				)}

				<ModelDetailTabs label="Model details" tabs={DETAIL_TABS} selected={tab} onSelect={setTab} prefix="model" />
				<div role="tabpanel" id="model-panel-overview" aria-labelledby="model-tab-overview" hidden={tab !== "overview"} tabIndex={0} className="pt-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
					<div className="grid gap-5 lg:grid-cols-2">
						<section aria-labelledby="capabilities-heading" className="rounded-[var(--radius-xl)] border border-border bg-panel p-5 sm:p-6">
							<h2 id="capabilities-heading" className="font-display text-xl font-medium text-text-bright">{unverified ? "Configured features" : "Capabilities"}</h2>
							{unverified && <p className="mt-3 text-sm leading-relaxed text-text-muted">Provider support is unverified. Features and modalities below reflect OMA configuration.</p>}
							<ul className="mt-4 flex flex-wrap gap-2">
								{model.capabilities.filter((capability) => capability !== "agents").map((capability) => <li key={capability} className={badgeClass}>{CAPABILITY_ICONS[capability]}{CAPABILITY_LABELS[capability]}{unverified ? " (configured)" : ""}</li>)}
								{toolCalling && <li className={badgeClass}><Wrench className="h-3.5 w-3.5" aria-hidden="true" />Tool calling{unverified ? " (configured)" : ""}</li>}
								{supportsStreaming === true && <li className={badgeClass}><Radio className="h-3.5 w-3.5" aria-hidden="true" />Streaming{unverified ? " (configured)" : ""}</li>}
							</ul>
							<dl className="mt-6 space-y-3 border-t border-border pt-5 text-sm">
								<div className="flex items-start justify-between gap-4"><dt className="text-text-muted">{unverified ? "Configured input" : "Input"}</dt><dd className="text-right capitalize text-text-secondary">{(model.inputModalities ?? ["text"]).join(", ") || "Not specified"}</dd></div>
								<div className="flex items-start justify-between gap-4"><dt className="text-text-muted">{unverified ? "Configured output" : "Output"}</dt><dd className="text-right capitalize text-text-secondary">{(model.outputModalities ?? ["text"]).join(", ") || "Not specified"}</dd></div>
								{model.privacy && <div className="flex items-start justify-between gap-4"><dt className="text-text-muted">Provider privacy</dt><dd className="text-right capitalize text-text-secondary">{model.privacy}</dd></div>}
								{model.extendedPricing && <div className="flex items-start justify-between gap-4"><dt className="text-text-muted">Above {model.extendedPricing.contextTokenThreshold.toLocaleString("en-US")} input tokens</dt><dd className="text-right text-text-secondary">{formatPricePerMillion(model.extendedPricing.inputPricePer1M)}/M input · {formatPricePerMillion(model.extendedPricing.outputPricePer1M)}/M output</dd></div>}
							</dl>
						</section>
						<section aria-labelledby="model-id-heading" className="min-w-0 rounded-[var(--radius-xl)] border border-border bg-panel p-5 sm:p-6">
							<h2 id="model-id-heading" className="font-display text-xl font-medium text-text-bright">API model ID</h2>
							<code className="mt-4 block break-all rounded-[var(--radius-md)] border border-border bg-void p-3 text-sm text-text-bright">{model.id}</code>
							<p className="mt-3 text-sm leading-relaxed text-text-secondary">Use this ID in the <code className="font-mono">model</code> field of your chat completion request.</p>
							{model.modelId !== model.id && <p className="mt-3 break-words text-xs text-text-muted">Upstream reference: <code>{model.modelId}</code></p>}
							<Link href="/docs" className="mt-4 inline-flex min-h-9 items-center text-sm font-medium text-accent hover:underline">API documentation →</Link>
						</section>
					</div>
					{supportedParameters && supportedParameters.length > 0 && (
						<section aria-labelledby="parameters-heading" className="mt-5 rounded-[var(--radius-xl)] border border-border bg-panel p-5 sm:p-6">
							<h2 id="parameters-heading" className="font-display text-xl font-medium text-text-bright">{unverified ? "Configured parameters" : "Supported parameters"}</h2>
							<ul className="mt-4 flex flex-wrap gap-2">{supportedParameters.map((parameter) => <li key={parameter} className={badgeClass}><code>{parameter}</code></li>)}</ul>
						</section>
					)}
					<RelatedModels current={model} />
				</div>
				<div role="tabpanel" id="model-panel-api" aria-labelledby="model-tab-api" hidden={tab !== "api"} className="pt-6">
					<ModelApiExamples modelId={model.id} name={model.name} />
				</div>
			</div>
		</div>
	);
}
