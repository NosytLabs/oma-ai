"use client";

import { m } from "@/lib/framer-motion-client";
import type { LucideIcon } from "lucide-react";
import {
	ArrowUpRight,
	BookOpen,
	Image as ImageIcon,
	Shield,
	Terminal,
	Video as VideoIcon,
} from "lucide-react";
import Link from "next/link";

interface QuickAction {
	href: string;
	label: string;
	description: string;
	icon: LucideIcon;
	external?: boolean;
}

const ACTIONS: QuickAction[] = [
	{
		href: "/chat",
		label: "Open playground",
		description: "Chat with free OMA-AI models",
		icon: Terminal,
	},
	{
		href: "/chat?mode=image",
		label: "Generate image",
		description: "Text → image (credits)",
		icon: ImageIcon,
	},
	{
		href: "/chat?mode=video",
		label: "Generate video",
		description: "Text → video (credits)",
		icon: VideoIcon,
	},
	{
		href: "/docs",
		label: "Read the docs",
		description: "REST + x402 reference",
		icon: BookOpen,
		external: true,
	},
	{
		href: "/settings?tab=privacy",
		label: "Privacy & data",
		description: "Export, clear history",
		icon: Shield,
	},
];

interface QuickActionsProps {
	className?: string;
}

/**
 * Compact "what can I do next" row for the dashboard overview. Reduces the
 * "I have an account, now what?" gap between sign-in and first request.
 */
export function QuickActions({ className = "" }: QuickActionsProps) {
	return (
		<div className={`mb-8 border border-border/60 bg-surface rounded-[12px] p-6 shadow-sm ${className}`}>
			<div className="mb-5 flex items-center justify-between">
				<div>
					<h2 className="text-[14.5px] font-bold text-text-bright tracking-tight">
						Quick actions
					</h2>
					<p className="mt-1 text-[11px] font-mono text-text-muted uppercase tracking-wider">
						Common next steps
					</p>
				</div>
			</div>
			<div className="grid grid-cols-1 gap-px bg-border/80 rounded-md overflow-hidden sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
				{ACTIONS.map((action, i) => {
					const Icon = action.icon;
					const inner = (
						<div className="group flex h-full flex-col gap-3 bg-void p-5 transition-colors hover:bg-surface/60">
							<div className="flex items-center gap-2">
								<div className="flex h-8 w-8 items-center justify-center rounded-[6px] border border-accent/25 bg-accent/10 text-accent transition-colors group-hover:border-accent/50 group-hover:bg-accent/20">
									<Icon className="h-4 w-4" aria-hidden="true" />
								</div>
								<ArrowUpRight
									className="ml-auto h-4 w-4 text-text-muted opacity-0 transition-all duration-200 group-hover:opacity-100 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-accent"
									aria-hidden="true"
								/>
							</div>
							<div className="mt-2">
								<div className="text-[13px] font-bold tracking-wide text-text-bright">
									{action.label}
								</div>
								<div className="mt-1 text-[11px] leading-relaxed text-text-muted">
									{action.description}
								</div>
							</div>
						</div>
					);
					return (
						<m.div
							key={action.href}
							initial={{ opacity: 0, y: 8 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.25, delay: 0.05 * i }}
						>
							{action.external ? (
								<a
									href={action.href}
									target="_blank"
									rel="noopener noreferrer"
									aria-label={`${action.label} (opens in new tab)`}
									className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
								>
									{inner}
								</a>
							) : (
								<Link
									href={action.href}
									aria-label={action.label}
									className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
								>
									{inner}
								</Link>
							)}
						</m.div>
					);
				})}
			</div>
		</div>
	);
}
