"use client";

import type { LucideIcon } from "lucide-react";
import {
	AlertTriangle,
	ChevronDown,
	Coins,
	Cpu,
	FileText,
	HelpCircle,
	KeyRound,
	Layers,
	Lock,
	Receipt,
	RefreshCw,
	Shield,
	Sliders,
	TrendingDown,
	Zap,
} from "lucide-react";
import { useState } from "react";

const ICON_MAP: Record<string, LucideIcon> = {
	HelpCircle,
	Coins,
	Cpu,
	Zap,
	KeyRound,
	Shield,
	Receipt,
	RefreshCw,
	Lock,
	FileText,
	Layers,
	TrendingDown,
	Sliders,
	AlertTriangle,
};

export type FAQGroup = {
	idx: string;
	name: string;
	items: { q: string; a: string; iconName: string }[];
};

function AccordionItem({
	item,
	isOpen,
	onToggle,
	index,
	groupIdx,
}: {
	item: FAQGroup["items"][number];
	isOpen: boolean;
	onToggle: () => void;
	index: number;
	groupIdx: string;
}) {
	const buttonId = `faq-button-${groupIdx}-${index}`;
	const panelId = `faq-panel-${groupIdx}-${index}`;
	const Icon = ICON_MAP[item.iconName] ?? HelpCircle;
	return (
		<div className="border-b border-border last:border-b-0">
			<button
				id={buttonId}
				onClick={onToggle}
				type="button"
				className="flex w-full items-center justify-between gap-4 py-4 sm:py-5 text-left transition-colors hover:text-text-bright focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
				aria-expanded={isOpen}
				aria-controls={panelId}
			>
				<span className="flex items-center gap-3 min-w-0">
					<span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-accent/20 bg-accent/5">
						<Icon className="h-4 w-4 text-accent" aria-hidden={true} />
					</span>
					<span className="font-medium text-text-bright text-[14px] sm:text-[15px]">
						{item.q}
					</span>
				</span>
				<ChevronDown
					className={`h-4 w-4 shrink-0 text-text-muted transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
					aria-hidden="true"
				/>
			</button>
			<div
				id={panelId}
				role="region"
				aria-labelledby={buttonId}
				className={`overflow-hidden transition-all duration-300 ${isOpen ? "max-h-[600px] pb-5" : "max-h-0"}`}
			>
				<div className="pl-11 sm:pl-12 pr-2 text-[13.5px] sm:text-sm text-text-secondary leading-relaxed">
					{item.a}
				</div>
			</div>
		</div>
	);
}

export function FAQClient({ groups }: { groups: FAQGroup[] }) {
	const [openMap, setOpenMap] = useState<Record<string, boolean>>(() => {
		const init: Record<string, boolean> = {};
		groups.forEach((g) => {
			init[`${g.idx}-0`] = true;
		});
		return init;
	});

	const toggle = (key: string) => {
		setOpenMap((prev) => ({ ...prev, [key]: !prev[key] }));
	};

	return (
		<div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
			<div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,18rem)] items-start">
				<div className="space-y-10 sm:space-y-12 min-w-0">
					{groups.map((g) => (
						<section
							key={g.idx}
							id={`group-${g.idx}`}
							aria-labelledby={`group-${g.idx}-heading`}
						>
							<header className="mb-4">
								<h2
									id={`group-${g.idx}-heading`}
									className="font-display text-xl sm:text-2xl font-bold tracking-tight text-text-bright"
								>
									{g.name}
								</h2>
								<p className="text-[12.5px] sm:text-[13px] text-text-muted mt-1">
									{g.items.length} question{g.items.length === 1 ? "" : "s"}
								</p>
							</header>

							<div className="rounded-xl border border-border bg-surface px-4 sm:px-5">
								{g.items.map((item, i) => {
									const key = `${g.idx}-${i}`;
									return (
										<AccordionItem
											key={key}
											item={item}
											index={i}
											groupIdx={g.idx}
											isOpen={!!openMap[key]}
											onToggle={() => toggle(key)}
										/>
									);
								})}
							</div>
						</section>
					))}
				</div>

				<aside className="lg:sticky lg:top-24 self-start border border-border bg-surface rounded-xl p-5 sm:p-6">
					<h3 className="font-display text-base font-semibold text-text-bright mb-4">
						Quick links
					</h3>
					<ul className="space-y-2.5 text-[13px]">
						{groups.map((g) => (
							<li key={g.idx}>
								<a
									href={`#group-${g.idx}`}
									className="text-text-secondary hover:text-accent transition-colors"
								>
									{g.name}
								</a>
							</li>
						))}
					</ul>
					<div className="mt-5 pt-5 border-t border-border space-y-2 text-[12px] text-text-muted">
						<p>
							<span className="text-text-secondary font-medium">Auth:</span>{" "}
							Wallet (SIWE)
						</p>
						<p>
							<span className="text-text-secondary font-medium">
								Settlement:
							</span>{" "}
							USDC on Base
						</p>
						<p>
							<span className="text-text-secondary font-medium">Contact:</span>{" "}
							hello@oma-ai.com
						</p>
					</div>
				</aside>
			</div>
		</div>
	);
}
