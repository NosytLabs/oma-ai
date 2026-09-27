"use client";

import Link from "next/link";
import type React from "react";
import { MessageSquare } from "lucide-react";
import { InViewFade } from "@/components/motion/in-view-fade";
import { ModelLogo } from "@/components/ui/model-logo";
import {
	MODALITY_LABELS,
	formatPricePerMillion,
	type Model,
	PROVIDER_COLORS,
} from "@/lib/models-data";

interface ModelCardProps {
	model: Model;
	index: number;
}

export const ModelCard: React.FC<ModelCardProps> = ({ model, index }) => {
	if (!model?.id) return null;

	const providerStyle =
		PROVIDER_COLORS[model.provider] ?? PROVIDER_COLORS.Venice;
	const inModalities = model.inputModalities ?? ["text"];
	const outModalities = model.outputModalities ?? ["text"];
	const isNonChat = model.modality !== "chat";

	// "text" input is universal — every catalog model accepts it — so it
	// adds no information and just fills the row with identical badges.
	// Likewise "chat" is the default capability of every chat-tier model
	// and is already conveyed by the modality label; showing it as a badge
	// duplicates the same signal. Only render the informative bits.
	const nonTextInputs = inModalities.filter((m) => m !== "text");
	const nonTextOutputs = outModalities.filter((m) => m !== "text");
	const displayCaps = (model.capabilities ?? []).filter(
		(cap) => cap !== "chat" || isNonChat,
	);
	const hasBadges =
		nonTextInputs.length > 0 || nonTextOutputs.length > 0 || displayCaps.length > 0;

	// `available: false` means the backing provider's key is missing or a
	// placeholder, so the model 503s. Flag it and drop the "Try in chat"
	// dead-end rather than advertising something that cannot run. An omitted
	// flag means "no signal" (static fallback catalog) and stays available.
	const unavailable = model.available === false;

	return (
		<InViewFade key={model.id} delay={index * 0.05} eager>
			<article className="group relative rounded-[var(--radius-xl)] border border-border bg-panel p-5 transition-[border-color,transform] duration-200 ease-out hover:border-accent/40 shadow-[var(--shadow-md)] active:scale-[0.97] h-full flex flex-col">
				<div className="mb-4 flex flex-col gap-3">
					<div className="min-w-0 flex-1 flex items-start gap-3">
						<ModelLogo
							modelId={model.id}
							size={36}
							className="mt-0.5 shadow-sm rounded-[var(--radius-lg)]"
						/>
						<div className="min-w-0 flex-1">
							<Link
								href={`/models/${model.id}`}
								className="flex min-h-6 items-center rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-panel"
							>
								<p className="text-[15px] font-semibold tracking-tight text-text-bright break-words leading-snug transition-colors group-hover:text-accent">
									{model.name ?? "Unknown"}
								</p>
							</Link>
							<p className="text-[11px] text-text-muted mt-1.5 font-mono break-all">
								{model.id}
							</p>
						</div>
					</div>
					<div className="flex flex-wrap items-center gap-2">
						{model.provider && (
							<span
								className={`px-2.5 py-1 rounded-sm text-[9.5px] font-mono font-bold uppercase tracking-wider border ${providerStyle.bg} ${providerStyle.text} ${providerStyle.border}`}
							>
								{model.provider}
							</span>
						)}
						{model.modality && model.modality !== "chat" && (
							<span className="px-2.5 py-1 rounded-sm text-[9.5px] font-mono font-bold uppercase tracking-wider border border-blue/30 bg-blue/10 text-blue">
								{MODALITY_LABELS[model.modality]}
							</span>
						)}
						{unavailable && (
							<span
								title="This model is currently unavailable. Prices are listed for reference; check availability before sending a request."
								className="px-2.5 py-1 rounded-sm text-[9.5px] font-mono font-bold uppercase tracking-wider border border-amber/30 bg-amber/10 text-amber"
							>
								Unavailable
							</span>
						)}
					</div>
				</div>

				{hasBadges && (
					<div className="mt-4 flex flex-wrap gap-2">
						<div className="flex flex-wrap gap-2">
							{Array.from(
								new Set([...nonTextInputs, ...nonTextOutputs]),
							).map((m) => {
							if (m === "text" || m === "chat") return null;
							const isOutput = nonTextOutputs.includes(m);
							const isInput = nonTextInputs.includes(m);
							const badge =
								m === "image"
									? { label: "Image", title: isOutput ? "Outputs images" : "Accepts image input", cls: "bg-blue/10 text-blue border-blue/30" }
									: m === "audio"
										? { label: "Audio", title: isOutput ? "Outputs audio" : "Accepts audio input", cls: "bg-violet/10 text-violet border-violet/30" }
										: m === "video"
											? { label: "Video", title: isOutput ? "Outputs video" : "Accepts video input", cls: "bg-amber/10 text-amber border-amber/30" }
											: m === "embeddings"
												? { label: "Embed", title: "Outputs embeddings", cls: "bg-tertiary/10 text-tertiary border-tertiary/30" }
												: null;
							if (!badge) return null;
							// Input-only modalities keep the neutral chip style;
							// anything with an output leg gets the colored chip.
							const neutral = !isOutput || isInput;
							return (
								<span
									key={`${m}-${isOutput ? "out" : "in"}`}
									title={badge.title}
									className={`px-2.5 py-1 rounded-sm text-[9.5px] font-mono font-bold uppercase tracking-wider border ${
										neutral ? "bg-surface text-text-secondary border-border" : badge.cls
									}`}
								>
									{badge.label}
								</span>
							);
						})}
					</div>

					<div className="flex flex-wrap gap-2">
						{displayCaps.slice(0, 3).map((cap) => (
							<span
								key={String(cap)}
								className="px-2.5 py-1 rounded-sm text-[9.5px] font-mono font-bold uppercase tracking-wider bg-surface text-text-secondary border border-border"
							>
								{cap}
							</span>
						))}
						{displayCaps.length > 3 && (
							<span
								className="px-2.5 py-1 rounded-sm text-[9.5px] font-mono font-bold uppercase tracking-wider text-text-muted cursor-help border border-transparent"
								title={`Additional capabilities: ${displayCaps
									.slice(3)
									.join(", ")}`}
							>
								+{displayCaps.length - 3}
							</span>
						)}
					</div>
				</div>
				)}

				<div className="mt-auto pt-4 border-t border-border/50 flex flex-wrap items-center justify-between gap-2 text-xs">
					<span className="text-[11px] text-text-secondary font-mono tabular-nums">
						{model.contextLength && model.contextLength !== "0"
							? `${model.contextLength} ctx`
							: "—"}
					</span>
					<div className="flex items-center gap-2 text-[11px] font-mono tabular-nums">
						{/* An unavailable model's price must not keep the accent
						    colour: that green is the buy signal, and a visitor
						    commits on the price, not the badge. The badge and the
						    CTA below already say "Unavailable" -- the price has
						    to agree with them. Verified live: the dead card
						    painted rgb(70,211,154), byte-identical to the live
						    card's. Output is muted too, but not struck, so the
						    "input . output" pair stays readable as a pair. */}
						{isNonChat &&
						typeof model.pricePerUnit === "number" &&
						model.pricePerUnit > 0 ? (
							<span
								className={unavailable ? "text-text-muted line-through" : "text-accent"}
								title={`Price${model.priceUnit ?? ""}`}
							>
								${model.pricePerUnit.toFixed(model.pricePerUnit < 0.1 ? 4 : 3)}
								{model.priceUnit ?? ""}
							</span>
						) : (
							<>
								<span
									className={
										unavailable ? "text-text-muted line-through" : "text-accent"
									}
									aria-hidden="true"
								>
									{typeof model.inputPricePer1M === "number" ? formatPricePerMillion(model.inputPricePer1M) : "—"}
								</span>
								<span className="text-text-muted" aria-hidden="true">
									&middot;
								</span>
								<span
									className={unavailable ? "text-text-muted" : "text-text-secondary"}
									aria-hidden="true"
								>
									{typeof model.outputPricePer1M === "number" ? formatPricePerMillion(model.outputPricePer1M) : "—"}
								</span>
							</>
						)}
					</div>
				</div>
				<span className="sr-only">
					{isNonChat && typeof model.pricePerUnit === "number"
						? `Price ${model.pricePerUnit.toFixed(model.pricePerUnit < 0.1 ? 4 : 3)}${model.priceUnit ?? ""}`
						: `Input ${typeof model.inputPricePer1M === "number" ? formatPricePerMillion(model.inputPricePer1M) : "?"} per 1M tokens, output ${typeof model.outputPricePer1M === "number" ? formatPricePerMillion(model.outputPricePer1M) : "?"} per 1M tokens`}
				</span>
				{unavailable ? (
					<p className="mt-3 text-[11px] font-mono font-semibold uppercase tracking-wider text-text-muted">
						Temporarily offline
					</p>
				) : (
					<div className="mt-3">
						<Link href={`/chat?model=${model.id}`} className="inline-flex min-h-6 items-center gap-1.5 rounded-sm text-[11px] font-mono font-semibold uppercase tracking-wider text-accent/70 hover:text-accent transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-panel">
							<MessageSquare className="h-3 w-3" aria-hidden="true" />
							Try in chat
						</Link>
					</div>
				)}
			</article>
		</InViewFade>
	);
};
