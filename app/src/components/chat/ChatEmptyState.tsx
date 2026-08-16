"use client";

import { m } from "@/lib/framer-motion-client";
import { springs } from "@/lib/animation";
import {
	Bug,
	ChevronRight,
	Code2,
	Coins,
	FileText,
	Lightbulb,
} from "lucide-react";
import { useMemo, useState } from "react";

interface Preset {
	id: string;
	label: string;
	description: string;
	icon: typeof Code2;
	prompt: string;
	model?: string;
	/**
	 * Optional model-family hints. Each hint is a lowercase substring
	 * matched against the current model id. A preset with no hints
	 * matches every model (the legacy behavior).
	 */
	modelHints?: readonly string[];
	/** Static Tailwind hue classes applied on hover (bg + border tint). */
	tint: string;
}

const PRESETS: Preset[] = [
	{
		id: "explain-code",
		label: "Explain code",
		description: "Line-by-line walkthrough",
		icon: Lightbulb,
		tint: "bg-violet/10 border-violet/30",
		modelHints: ["claude", "opus", "sonnet", "haiku"],
		prompt:
			"Explain this code line by line, as if teaching a junior developer:\n\n```python\ndef merge_sort(arr):\n if len(arr) <= 1:\n return arr\n mid = len(arr) // 2\n left = merge_sort(arr[:mid])\n right = merge_sort(arr[mid:])\n return merge(left, right)\n```",
	},
	{
		id: "fix-bug",
		label: "Fix a bug",
		description: "Find and explain the issue",
		icon: Bug,
		tint: "bg-warning/10 border-warning/30",
		modelHints: ["gpt", "openai", "codex", "qwen", "coder"],
		prompt:
			"What's wrong with this code and how do I fix it?\n\n```javascript\nconst nums = [1, 2, 3, 4, 5];\nconst result = nums.filter(n => n % 2 = 0);\n```",
	},
	{
		id: "summarize",
		label: "Summarize text",
		description: "Bullet-point summary",
		icon: FileText,
		tint: "bg-secondary/10 border-secondary/30",
		modelHints: ["gemini", "flash", "pro", "llama", "mistral"],
		prompt:
			"Summarize this in 3 concise bullet points, focusing on actionable takeaways:\n\nThe rise of edge computing is transforming how we architect distributed systems. By processing data closer to the source, organizations can reduce latency by 50-70%, lower bandwidth costs, and enable real-time decision-making. However, edge deployments introduce complexity in data consistency, security patching, and monitoring. Companies like Cloudflare and Fastly are leading the charge with serverless edge platforms that abstract away infrastructure management while providing sub-millisecond cold start times.",
	},
	{
		id: "write-sql",
		label: "Write SQL",
		description: "Natural language to query",
		icon: Code2,
		tint: "bg-accent/10 border-accent/30",
		// Universal — every modern LLM writes decent SQL.
		prompt:
			"Write a SQL query to find the top 5 customers by total spending in the last 30 days, including their name, email, and order count. Assume tables: customers (id, name, email), orders (id, customer_id, total, created_at).",
	},
];

interface EmptyStateProps {
	onPreset: (prompt: string, model?: string) => void;
	/**
	 * The currently selected model id (e.g. "claude-sonnet-4-20250514").
	 * When provided, presets tagged with `modelHints` filter to those
	 * that match the current model. When omitted, every preset shows.
	 */
	currentModel?: string;
}

export function ChatEmptyState({ onPreset, currentModel }: EmptyStateProps) {
	const [hoveredId, setHoveredId] = useState<string | null>(null);

	// Filter presets by model hints; fall back to all presets when the
	// current model is missing, unknown, or no preset matches it. The
	// fallback guarantees we never render an empty grid (would look broken).
	const visiblePresets = useMemo(() => {
		if (!currentModel) return PRESETS;
		const needle = currentModel.toLowerCase();
		const matched = PRESETS.filter((p) => {
			// Universal preset (no hints declared) — show for every model.
			if (!p.modelHints || p.modelHints.length === 0) return true;
			return p.modelHints.some((hint) => needle.includes(hint));
		});
		// Fallback to ALL presets when no model-specific preset matched.
		// We require >1 so that an unknown model (only the universal
		// "Write SQL" preset matches) still surfaces every preset — otherwise
		// the grid looks empty/broken.
		return matched.length > 1 ? matched : PRESETS;
	}, [currentModel]);

	return (
		<div className="flex flex-col items-center justify-start text-center px-4 py-4 md:py-6">
			<m.div
				initial={{ scale: 0.95, opacity: 0 }}
				animate={{ scale: 1, opacity: 1 }}
				transition={springs.soft}
				className="mb-4 flex h-11 w-11 items-center justify-center rounded-[var(--radius-lg)] border border-[var(--color-accent)]/30 bg-[color-mix(in_srgb,var(--color-accent)_12%,var(--color-surface))] shadow-[0_0_24px_-6px_var(--color-accent-glow)]"
			>
				<span className="text-[18px] font-mono font-bold text-[var(--color-accent)]" aria-hidden="true">
					{">"}
				</span>
			</m.div>

			<m.h2
				initial={{ y: 12, opacity: 0 }}
				animate={{ y: 0, opacity: 1 }}
				transition={{ delay: 0.08, ...springs.soft }}
				className="mb-1.5 text-xl font-mono tracking-tight text-text-bright sm:text-2xl"
			>
				Chat with any model
			</m.h2>
			<m.p
				initial={{ y: 12, opacity: 0 }}
				animate={{ y: 0, opacity: 1 }}
				transition={{ delay: 0.12, ...springs.soft }}
				className="mb-5 max-w-md text-sm leading-relaxed text-text-secondary"
			>
				Pick a starter, or type below. Guest chats are free on OMA-AI models.
			</m.p>

			<m.div
				initial={{ y: 16, opacity: 0 }}
				animate={{ y: 0, opacity: 1 }}
				transition={{ delay: 0.25, ...springs.soft }}
				className="grid w-full max-w-xl grid-cols-2 gap-3"
			>
				{visiblePresets.map((preset, i) => {
					const Icon = preset.icon;
					const isHovered = hoveredId === preset.id;
					return (
						<m.button
							key={preset.id}
							type="button"
							initial={{ opacity: 0, y: 8 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: 0.3 + i * 0.04, ...springs.soft }}
							onMouseEnter={() => setHoveredId(preset.id)}
							onMouseLeave={() => setHoveredId(null)}
							onClick={() => onPreset(preset.prompt)}
							className={`
								group relative flex flex-col items-start gap-3 p-4 text-left
								rounded-[var(--radius-lg)] border transition-[border-color,background-color,transform,box-shadow] duration-200 ease-out active:scale-[0.97]
								${isHovered ? `${preset.tint} shadow-sm` : "bg-surface border-border hover:border-border-hi"}
								focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-void
							`}
						>
							<div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-md)] border transition-colors duration-200 ease-out ${isHovered ? "border-[var(--color-accent)]/30 bg-[color-mix(in_srgb,var(--color-accent)_10%,transparent)] text-[var(--color-accent)]" : "border-[var(--color-border)] bg-[var(--color-surface)] text-text-muted"}`}>
								<Icon
									className="h-3.5 w-3.5"
								/>
							</div>
							<div className="min-w-0 flex-1">
								<div className="flex items-center gap-1.5">
									<span
										className={`text-[12px] font-semibold tracking-wide transition-colors duration-200 ease-out ${
											isHovered ? "text-text-bright" : "text-text-secondary"
										}`}
									>
										{preset.label}
									</span>
									<ChevronRight
										className={`h-3 w-3 transition-[transform,opacity,color] duration-200 ease-out ${
											isHovered
												? "translate-x-0.5 text-[var(--color-accent)] opacity-100"
												: "-translate-x-2 text-text-muted opacity-0"
										}`}
									/>
								</div>
								<span className="mt-1 block text-[11px] leading-tight text-text-muted">
									{preset.description}
								</span>
							</div>
						</m.button>
					);
				})}
			</m.div>

			<m.div
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				transition={{ delay: 0.5, ...springs.soft }}
				className="mt-4 flex items-center gap-2 text-[11px] font-mono text-text-muted uppercase tracking-wider"
			>
				<Coins className="h-3.5 w-3.5 text-[var(--color-accent)] opacity-80" aria-hidden="true" />
				Free tier: 20 requests/day · no card needed
			</m.div>
		</div>
	);
}
