"use client";

import React from "react";
import Link from "next/link";
import { ModelLogo } from "@/components/ui/model-logo";
import {
	PROVIDER_COLORS,
	MODALITY_LABELS,
	type Model,
} from "@/lib/models-data";
import { InViewFade } from "@/components/motion/in-view-fade";

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

	return (
		<InViewFade key={model.id} delay={index * 0.05} spring>
			<Link
				href={`/models/${model.id}`}
				className="group relative rounded-[var(--radius-xl)] border border-border bg-panel p-5 transition-transform duration-200 ease-out hover:border-accent/40 shadow-[var(--shadow-md)] active:scale-[0.97] h-full flex flex-col"
			>
				<div className="flex items-start justify-between gap-3">
					<div className="min-w-0 flex-1 flex items-start gap-3">
						<ModelLogo
							modelId={model.id}
							size={36}
							className="mt-0.5 shadow-sm rounded-[var(--radius-lg)]"
						/>
						<div className="min-w-0 flex-1">
							<p className="text-[15px] font-semibold tracking-tight text-text-bright truncate">
								{model.name ?? "Unknown"}
							</p>
							<p className="text-[11px] text-text-muted mt-1 font-mono truncate">
								{model.id}
							</p>
						</div>
					</div>
					<div className="flex flex-col items-end gap-1.5 shrink-0">
						{model.provider && (
							<span
								className={`px-2 py-0.5 rounded-sm text-[9.5px] font-mono font-bold uppercase tracking-wider border ${providerStyle.bg} ${providerStyle.text} ${providerStyle.border}`}
							>
								{model.provider}
							</span>
						)}
						{model.modality && model.modality !== "chat" && (
							<span className="px-2 py-0.5 rounded-sm text-[9.5px] font-mono font-bold uppercase tracking-wider border border-blue/30 bg-blue/10 text-blue">
								{MODALITY_LABELS[model.modality]}
							</span>
						)}
					</div>
				</div>

				<div className="mt-4 flex flex-wrap gap-2">
					<div className="flex flex-wrap gap-1.5" aria-label="Modalities">
						{inModalities.includes("text") && (
							<span
								title="Text input"
								className="px-2 py-0.5 rounded-sm text-[9.5px] font-mono font-bold uppercase tracking-wider bg-surface text-text-secondary border border-border"
							>
								T IN
							</span>
						)}
						{inModalities.includes("image") && (
							<span
								title="Image input"
								className="px-2 py-0.5 rounded-sm text-[9.5px] font-mono font-bold uppercase tracking-wider bg-surface text-text-secondary border border-border"
							>
								I IN
							</span>
						)}
						{inModalities.includes("audio") && (
							<span
								title="Audio input"
								className="px-2 py-0.5 rounded-sm text-[9.5px] font-mono font-bold uppercase tracking-wider bg-surface text-text-secondary border border-border"
							>
								A IN
							</span>
						)}
						{inModalities.includes("video") && (
							<span
								title="Video input"
								className="px-2 py-0.5 rounded-sm text-[9.5px] font-mono font-bold uppercase tracking-wider bg-surface text-text-secondary border border-border"
							>
								V IN
							</span>
						)}
						{outModalities.includes("image") && (
							<span
								title="Image output"
								className="px-2 py-0.5 rounded-sm text-[9.5px] font-mono font-bold uppercase tracking-wider bg-blue/10 text-blue border border-blue/30"
							>
								IMAGE
							</span>
						)}
						{outModalities.includes("audio") && (
							<span
								title="Audio output"
								className="px-2 py-0.5 rounded-sm text-[9.5px] font-mono font-bold uppercase tracking-wider bg-violet/10 text-violet border border-violet/30"
							>
								AUDIO
							</span>
						)}
						{outModalities.includes("video") && (
							<span
								title="Video output"
								className="px-2 py-0.5 rounded-sm text-[9.5px] font-mono font-bold uppercase tracking-wider bg-amber/10 text-amber border border-amber/30"
							>
								VIDEO
							</span>
						)}
						{outModalities.includes("embeddings") && (
							<span
								title="Embeddings output"
								className="px-2 py-0.5 rounded-sm text-[9.5px] font-mono font-bold uppercase tracking-wider bg-tertiary/10 text-tertiary border border-tertiary/30"
							>
								EMBED
							</span>
						)}
					</div>

					<div className="flex flex-wrap gap-1.5">
						{model.capabilities.slice(0, 3).map((cap) => (
							<span
								key={String(cap)}
								className="px-2 py-0.5 rounded-sm text-[9.5px] font-mono font-bold uppercase tracking-wider bg-surface text-text-secondary border border-border"
							>
								{cap}
							</span>
						))}
						{model.capabilities.length > 3 && (
							<span
								className="px-2 py-0.5 rounded-sm text-[9.5px] font-mono font-bold uppercase tracking-wider text-text-muted cursor-help border border-transparent"
								title={`Additional capabilities: ${model.capabilities
									.slice(3)
									.join(", ")}`}
							>
								+{model.capabilities.length - 3}
							</span>
						)}
					</div>
				</div>

				<div className="mt-4 pt-4 border-t border-border/50 flex items-center justify-between text-xs">
					<span className="text-[11px] text-text-secondary font-mono tabular-nums">
						{model.contextLength && model.contextLength !== "0"
							? `${model.contextLength} ctx`
							: "—"}
					</span>
					<div className="flex items-center gap-2 text-[11px] font-mono tabular-nums">
						{isNonChat &&
						typeof model.pricePerUnit === "number" &&
						model.pricePerUnit > 0 ? (
							<span className="text-accent" title={`Price${model.priceUnit ?? ""}`}>
								$
								{model.pricePerUnit.toFixed(
									model.pricePerUnit < 0.1 ? 4 : 3,
								)}
								{model.priceUnit ?? ""}
							</span>
						) : (
							<>
								<span className="text-accent" aria-hidden="true">
									$
									{typeof model.inputPricePer1M === "number"
										? model.inputPricePer1M < 0.01
											? model.inputPricePer1M.toFixed(4)
											: model.inputPricePer1M.toFixed(2)
										: "—"}
								</span>
								<span className="text-text-muted" aria-hidden="true">
									&middot;
								</span>
								<span className="text-text-secondary" aria-hidden="true">
									$
									{typeof model.outputPricePer1M === "number"
										? model.outputPricePer1M < 0.01
											? model.outputPricePer1M.toFixed(4)
											: model.outputPricePer1M.toFixed(2)
										: "—"}
								</span>
							</>
						)}
					</div>
				</div>
				<span className="sr-only">
					{isNonChat && typeof model.pricePerUnit === "number"
						? `Price ${model.pricePerUnit.toFixed(model.pricePerUnit < 0.1 ? 4 : 3)}${model.priceUnit ?? ""}`
						: `Input $${typeof model.inputPricePer1M === "number" ? model.inputPricePer1M.toFixed(model.inputPricePer1M < 0.01 ? 4 : 2) : "?"} per 1M tokens, output $${typeof model.outputPricePer1M === "number" ? model.outputPricePer1M.toFixed(model.outputPricePer1M < 0.01 ? 4 : 2) : "?"} per 1M tokens`}
				</span>
			</Link>
		</InViewFade>
	);
};
