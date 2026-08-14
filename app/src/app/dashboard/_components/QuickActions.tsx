"use client";

import { m } from "@/lib/framer-motion-client";
import { springs } from "@/lib/animation";
import type { LucideIcon } from "lucide-react";
import {
	ArrowUpRight,
	BookOpen,
	Coins,
	Shield,
	Terminal,
} from "lucide-react";
import Link from "next/link";

interface QuickAction {
	href: string;
	label: string;
	description: string;
	icon: LucideIcon;
	external?: boolean;
}

/** Common next steps after sign-in. Image/video generation was removed
 *  in R8 — the playground is text + multimodal LLM only. */
const ACTIONS: QuickAction[] = [
	{
		href: "/chat",
		label: "Open playground",
		description: "Chat with free OMA-AI models",
		icon: Terminal,
	},
	{
		href: "/deposit",
		label: "Buy credits",
		description: "Top up via card or USDC on Base",
		icon: Coins,
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
		<div className={`mb-8 bg-surface/30 border border-border rounded-[var(--radius-lg)] shadow-[var(--shadow-md)] relative overflow-hidden transition-colors duration-200 ease-out hover:border-accent/40 ${className}`}>
			<div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-accent/40 via-accent/20 to-transparent" />
			<div className="p-6">
				<div className="mb-6 flex items-center justify-between">
					<div>
						<h2 className="text-[14.5px] font-bold text-text-bright tracking-tight">
							Quick actions
						</h2>
						<p className="mt-1 text-[11px] font-mono text-text-muted uppercase tracking-wider">
							Common next steps
						</p>
					</div>
				</div>
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
					{ACTIONS.map((action, i) => {
						const Icon = action.icon;
						const inner = (
							<div className="group flex h-full flex-col gap-3 rounded-[var(--radius-md)] border border-border bg-void p-5 transition-[background-color,border-color,box-shadow,color,transform] duration-200 hover:border-accent/40 hover:bg-surface/50 hover:shadow-[0_4px_20px_-10px_var(--color-accent-glow)] active:scale-[0.97]">
								<div className="flex items-center gap-2">
									<div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-sm)] border border-accent/20 bg-accent/5 text-accent transition-colors duration-200 ease-out group-hover:border-accent/50 group-hover:bg-accent/10 group-hover:shadow-[0_0_10px_-2px_var(--color-accent-glow)]">
										<Icon className="h-5 w-5" aria-hidden="true" />
									</div>
									<ArrowUpRight
										className="ml-auto h-4 w-4 text-text-muted opacity-0 transition-[background-color,border-color,box-shadow,color,transform] duration-200 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:text-accent"
										aria-hidden="true"
									/>
								</div>
								<div className="mt-3">
									<div className="text-sm font-semibold text-text-bright transition-colors duration-200 ease-out group-hover:text-accent">
										{action.label}
									</div>
									<div className="mt-1.5 text-xs text-text-muted transition-colors duration-200 ease-out group-hover:text-text-secondary">
										{action.description}
									</div>
								</div>
							</div>
						);
						return (
							<m.div
								key={action.href}
								initial={{ opacity: 0, y: 8, scale: 0.99 }}
								animate={{ opacity: 1, y: 0, scale: 1 }}
								transition={{ delay: 0.05 * i, ...springs.soft }}
							>
								{action.external ? (
									<a
										href={action.href}
										target="_blank"
										rel="noopener noreferrer"
										aria-label={`${action.label} (opens in new tab)`}
										className="block h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-void rounded-[var(--radius-md)]"
									>
										{inner}
									</a>
								) : (
									<Link
										href={action.href}
										aria-label={action.label}
										className="block h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-void rounded-[var(--radius-md)]"
									>
										{inner}
									</Link>
								)}
							</m.div>
						);
					})}
				</div>
			</div>
		</div>
	);
}
