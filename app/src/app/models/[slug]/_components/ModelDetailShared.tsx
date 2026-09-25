import Link from "next/link";
import { formatPrice } from "@/lib/model-utils";
import { TIER_LABELS } from "@/app/models/_lib/labels";
import { MODELS, type Model } from "@/lib/models-data";



export function Stat({
	label,
	value,
	unit,
}: {
	label: string;
	value: string;
	unit: string;
}) {
	return (
		<div className="rounded-[var(--radius-lg)] border border-border/50 bg-surface p-5 transition-colors duration-200 hover:border-accent/30">
			<div className="font-mono text-[10px] uppercase tracking-widest text-text-muted mb-2">
				{label}
			</div>
			<div className="font-geometric text-[1.875rem] font-medium tabular-nums tracking-tight text-text-bright leading-none">
				{value}
			</div>
			<div className="text-xs text-text-muted mt-2">{unit}</div>
		</div>
	);
}

export function RelatedModels({ current }: { current: Model }) {
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
