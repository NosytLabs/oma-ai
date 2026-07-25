"use client";

import { m } from "@/lib/framer-motion-client";
import {
	Bug,
	ChevronRight,
	Code2,
	Coins,
	FileText,
	Lightbulb,
} from "lucide-react";
import { useState } from "react";
import { ThinkingOrb } from "thinking-orbs";

interface Preset {
	id: string;
	label: string;
	description: string;
	icon: typeof Code2;
	prompt: string;
	model?: string;
}

const PRESETS: Preset[] = [
	{
		id: "explain-code",
		label: "Explain code",
		description: "Line-by-line walkthrough",
		icon: Lightbulb,
		prompt:
			"Explain this code line by line, as if teaching a junior developer:\n\n```python\ndef merge_sort(arr):\n    if len(arr) <= 1:\n        return arr\n    mid = len(arr) // 2\n    left = merge_sort(arr[:mid])\n    right = merge_sort(arr[mid:])\n    return merge(left, right)\n```",
	},
	{
		id: "fix-bug",
		label: "Fix a bug",
		description: "Find and explain the issue",
		icon: Bug,
		prompt:
			"What's wrong with this code and how do I fix it?\n\n```javascript\nconst nums = [1, 2, 3, 4, 5];\nconst result = nums.filter(n => n % 2 = 0);\nconsole.log(result);\n```",
	},
	{
		id: "summarize",
		label: "Summarize text",
		description: "Bullet-point summary",
		icon: FileText,
		prompt:
			"Summarize this in 3 concise bullet points, focusing on actionable takeaways:\n\nThe rise of edge computing is transforming how we architect distributed systems. By processing data closer to the source, organizations can reduce latency by 50-70%, lower bandwidth costs, and enable real-time decision-making. However, edge deployments introduce complexity in data consistency, security patching, and observability. Companies like Cloudflare and Fastly are leading the charge with serverless edge platforms that abstract away infrastructure management while providing sub-millisecond cold start times.",
	},
	{
		id: "write-sql",
		label: "Write SQL",
		description: "Natural language to query",
		icon: Code2,
		prompt:
			"Write a SQL query to find the top 5 customers by total spending in the last 30 days, including their name, email, and order count. Assume tables: customers (id, name, email), orders (id, customer_id, total, created_at).",
	},
];

interface EmptyStateProps {
	onPreset: (prompt: string, model?: string) => void;
}

export function ChatEmptyState({ onPreset }: EmptyStateProps) {
	const [hoveredId, setHoveredId] = useState<string | null>(null);

	return (
		<div className="flex flex-col items-center justify-center text-center px-4 py-8 md:py-12">
			<m.div
				initial={{ scale: 0.9, opacity: 0 }}
				animate={{ scale: 1, opacity: 1 }}
				transition={{ duration: 0.3 }}
				className="mb-6 flex h-14 w-14 items-center justify-center rounded-xl border border-accent/25 bg-accent/8 shadow-[0_0_24px_-10px_var(--color-accent-glow)]"
			>
				<span className="text-xl font-mono text-accent" aria-hidden="true">
					{">"}_
				</span>
			</m.div>

			<m.h2
				initial={{ y: 16, opacity: 0 }}
				animate={{ y: 0, opacity: 1 }}
				transition={{ delay: 0.1 }}
				className="mb-2 text-xl font-semibold tracking-tight text-text-bright"
			>
				Chat with any model
			</m.h2>
			<m.p
				initial={{ y: 16, opacity: 0 }}
				animate={{ y: 0, opacity: 1 }}
				transition={{ delay: 0.15 }}
				className="mb-1 max-w-md font-mono text-xs text-text-muted"
			>
				OpenAI-compatible · metered in USDC
			</m.p>
			<m.p
				initial={{ y: 16, opacity: 0 }}
				animate={{ y: 0, opacity: 1 }}
				transition={{ delay: 0.2 }}
				className="mb-6 max-w-md text-sm text-text-secondary"
			>
				Pick a starter prompt, or type below. Responses stream live.
			</m.p>

			{/* Thinking-orb hint — subtle composing-state dot above the starter grid. */}
			<m.div
				initial={{ opacity: 0, scale: 0.9 }}
				animate={{ opacity: 1, scale: 1 }}
				transition={{ delay: 0.22, duration: 0.4 }}
				className="mb-3 flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-text-muted"
				aria-hidden="true"
			>
				<ThinkingOrb state="composing" size={20} theme="auto" />
				<span>ready to compose</span>
			</m.div>

			<m.div
				initial={{ y: 16, opacity: 0 }}
				animate={{ y: 0, opacity: 1 }}
				transition={{ delay: 0.25 }}
				className="grid w-full max-w-md grid-cols-2 gap-2"
			>
				{PRESETS.map((preset, i) => {
					const Icon = preset.icon;
					const isHovered = hoveredId === preset.id;
					return (
						<m.button
							key={preset.id}
							type="button"
							initial={{ opacity: 0, y: 8 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: 0.3 + i * 0.04 }}
							onMouseEnter={() => setHoveredId(preset.id)}
							onMouseLeave={() => setHoveredId(null)}
							onClick={() => onPreset(preset.prompt, preset.model)}
							className="
                flex min-h-[48px] items-start gap-2.5 rounded-lg border border-border
                bg-surface/60 px-3 py-3 text-left transition-all duration-200
                hover:border-accent/40 hover:bg-surface
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
                focus-visible:ring-offset-2 focus-visible:ring-offset-void
              "
						>
							<Icon
								className={`mt-0.5 h-3.5 w-3.5 shrink-0 transition-colors duration-200 ${
									isHovered ? "text-accent" : "text-text-muted"
								}`}
							/>
							<div className="min-w-0 flex-1">
								<div className="flex items-center gap-1">
									<span
										className={`text-[11px] font-semibold transition-colors duration-200 ${
											isHovered ? "text-text-bright" : "text-text-secondary"
										}`}
									>
										{preset.label}
									</span>
									<ChevronRight
										className={`h-2.5 w-2.5 transition-all duration-200 ${
											isHovered
												? "translate-x-0 text-accent opacity-100"
												: "-translate-x-1 text-text-muted opacity-0"
										}`}
									/>
								</div>
								<span className="mt-0.5 block text-[10px] leading-tight text-text-muted">
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
				transition={{ delay: 0.5 }}
				className="mt-4 flex items-center gap-1.5 text-[10px] text-text-muted"
			>
				<Coins className="h-2.5 w-2.5 text-accent" aria-hidden="true" />
				Starters route to budget models — cost stays tiny
			</m.div>
		</div>
	);
}
