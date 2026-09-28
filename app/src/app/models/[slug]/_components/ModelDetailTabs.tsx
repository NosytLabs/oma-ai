"use client";

import { useId, useRef, type KeyboardEvent } from "react";

/** A shared, keyboard-operable tab strip for the detail and example panels. */
export function ModelDetailTabs<T extends string>({
	label, tabs, selected, onSelect, prefix,
}: {
	label: string;
	tabs: readonly { id: T; label: string }[];
	selected: T;
	onSelect: (tab: T) => void;
	prefix: string;
}) {
	const refs = useRef<(HTMLButtonElement | null)[]>([]);
	const labelId = useId();
	function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
		let next = index;
		if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
		else if (event.key === "ArrowLeft") next = (index + tabs.length - 1) % tabs.length;
		else if (event.key === "Home") next = 0;
		else if (event.key === "End") next = tabs.length - 1;
		else return;
		event.preventDefault();
		onSelect(tabs[next].id);
		refs.current[next]?.focus();
	}
	return (
		<div className="flex gap-1 overflow-x-auto border-b border-border" role="tablist" aria-labelledby={labelId}>
			<span id={labelId} className="sr-only">{label}</span>
			{tabs.map((tab, index) => (
				<button
					key={tab.id}
					ref={(element) => { refs.current[index] = element; }}
					type="button"
					role="tab"
					id={`${prefix}-tab-${tab.id}`}
					aria-controls={`${prefix}-panel-${tab.id}`}
					aria-selected={selected === tab.id}
					tabIndex={selected === tab.id ? 0 : -1}
					onClick={() => onSelect(tab.id)}
					onKeyDown={(event) => onKeyDown(event, index)}
					className={`min-h-12 shrink-0 border-b-2 px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent ${selected === tab.id ? "border-accent text-text-bright" : "border-transparent text-text-muted hover:text-text-bright"}`}
				>
					{tab.label}
				</button>
			))}
		</div>
	);
}
