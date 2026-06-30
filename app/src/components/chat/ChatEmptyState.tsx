"use client";

import { m } from "framer-motion";
import {
	Bug,
	ChevronRight,
	Code2,
	Coins,
	FileText,
	Lightbulb,
} from "lucide-react";
import { useState } from "react";

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
				className="w-14 h-14 flex items-center justify-center mb-6 border border-border"
			>
				<span className="text-xl text-success font-mono">{">"}_</span>
			</m.div>

			<m.h2
				initial={{ y: 16, opacity: 0 }}
				animate={{ y: 0, opacity: 1 }}
				transition={{ delay: 0.1 }}
				className="text-xl font-mono font-bold text-text mb-2 tracking-tight"
			>
				OMA PLAYGROUND
			</m.h2>
			<m.p
				initial={{ y: 16, opacity: 0 }}
				animate={{ y: 0, opacity: 1 }}
				transition={{ delay: 0.15 }}
				className="text-text-muted text-xs font-mono max-w-md mb-1"
			>
				{"// QUERY THE GATEWAY"}
			</m.p>
			<m.p
				initial={{ y: 16, opacity: 0 }}
				animate={{ y: 0, opacity: 1 }}
				transition={{ delay: 0.2 }}
				className="text-text-muted/60 text-[10px] font-mono max-w-md mb-6"
			>
				Pick a quick prompt below, or just start typing
			</m.p>

			<m.div
				initial={{ y: 16, opacity: 0 }}
				animate={{ y: 0, opacity: 1 }}
				transition={{ delay: 0.25 }}
				className="grid grid-cols-2 gap-2 w-full max-w-md"
			>
				{PRESETS.map((preset, i) => {
					const Icon = preset.icon;
					const isHovered = hoveredId === preset.id;
					return (
						<m.button
							key={preset.id}
							initial={{ opacity: 0, y: 8 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: 0.3 + i * 0.04 }}
							onMouseEnter={() => setHoveredId(preset.id)}
							onMouseLeave={() => setHoveredId(null)}
							onClick={() => onPreset(preset.prompt, preset.model)}
							className="
                flex items-start gap-2.5 px-3 py-3 bg-void border border-border
                text-left transition-all duration-200
                hover:border-success/40 hover:bg-surface
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
                focus-visible:ring-offset-2 focus-visible:ring-offset-void
                min-h-[44px]
              "
						>
							<Icon
								className={`w-3.5 h-3.5 shrink-0 mt-0.5 transition-colors duration-200 ${
									isHovered ? "text-success" : "text-text-muted"
								}`}
							/>
							<div className="flex-1 min-w-0">
								<div className="flex items-center gap-1">
									<span
										className={`text-[11px] font-mono font-bold transition-colors duration-200 ${
											isHovered ? "text-text" : "text-text-secondary"
										}`}
									>
										{preset.label}
									</span>
									<ChevronRight
										className={`w-2.5 h-2.5 transition-all duration-200 ${
											isHovered
												? "text-success opacity-100 translate-x-0"
												: "text-text-muted opacity-0 -translate-x-1"
										}`}
									/>
								</div>
								<span className="text-[9px] font-mono text-text-muted leading-tight block mt-0.5">
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
				className="flex items-center gap-1 mt-4 text-[9px] font-mono text-text-muted/50"
			>
				<Coins className="w-2.5 h-2.5" />
				Quick prompts use budget models — cost is negligible
			</m.div>
		</div>
	);
}
