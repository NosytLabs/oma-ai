"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { InViewFade } from "@/components/motion/in-view-fade";

type FAQItem = { q: string; a: string };
type FAQGroup = { heading: string; items: FAQItem[] };

const FAQ_LINK_ROUTES = new Set([
	"/chat",
	"/contact",
	"/deposit",
	"/docs",
	"/docs#x402",
	"/docs#quickstart",
	"/getting-started",
	"/glossary",
	"/models",
	"/pricing",
	"/privacy",
]);

const PATH_TOKEN_RE =
	/(\/[a-z0-9-]+(?:\.[a-z0-9-]+)?(?:#[a-z0-9-]+)?(?:\/[a-z0-9-]+(?:\.[a-z0-9-]+)?)*)/g;

function AnswerText({ text }: { text: string }) {
	return (
		<>
			{text.split(PATH_TOKEN_RE).map((part, i) => {
				if (!part.startsWith("/")) return part;
				if (FAQ_LINK_ROUTES.has(part)) {
					return (
						<Link
							key={i}
							href={part}
							className="text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent"
						>
							{part}
						</Link>
					);
				}
				return (
					<code
						key={i}
						className="rounded-[var(--radius-sm)] bg-surface px-1 py-0.5 font-mono text-[0.85em] text-text-secondary"
					>
						{part}
					</code>
				);
			})}
		</>
	);
}

export function FAQContent({ groups }: { groups: FAQGroup[] }) {
	const [query, setQuery] = useState("");

	const filtered = useMemo(() => {
		if (!query.trim()) return groups;
		const q = query.toLowerCase();
		return groups
			.map((g) => ({
				...g,
				items: g.items.filter(
					(item) =>
						item.q.toLowerCase().includes(q) ||
						item.a.toLowerCase().includes(q),
				),
			}))
			.filter((g) => g.items.length > 0);
	}, [groups, query]);

	const totalResults = filtered.reduce((n, g) => n + g.items.length, 0);

	return (
		<>
			<div className="relative mt-8">
				<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" aria-hidden="true" />
				<input
					type="search"
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					placeholder="Search questions..."
					aria-label="Search FAQ questions"
					className="w-full rounded-[var(--radius-lg)] border border-border bg-surface/60 py-3 pl-10 pr-10 text-sm text-text-bright placeholder:text-text-muted focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/30 transition-colors duration-200"
				/>
				{query && (
					<button
						type="button"
						onClick={() => setQuery("")}
						className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-bright transition-colors"
						aria-label="Clear search"
					>
						<X className="h-4 w-4" />
					</button>
				)}
			</div>

			{query && (
				<p className="mt-3 text-xs font-mono text-text-muted">
					{totalResults} result{totalResults !== 1 ? "s" : ""} for &ldquo;{query}&rdquo;
				</p>
			)}

			<div className="mt-8 space-y-10">
				{filtered.length === 0 && (
					<p className="text-center text-sm text-text-muted py-8">
						No questions match your search. Try a different term or{" "}
						<Link href="/contact" className="text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent">
							contact us
						</Link>.
					</p>
				)}
				{filtered.map((group, gi) => (
					<InViewFade key={group.heading} delay={Math.min(gi * 0.05, 0.25)}>
						<section aria-labelledby={group.heading.replace(/\W+/g, "-").toLowerCase()}>
							<h2
								id={group.heading.replace(/\W+/g, "-").toLowerCase()}
								className="section-eyebrow-caps mb-4"
							>
								{group.heading}
							</h2>
							<div className="space-y-3">
								{group.items.map((item) => (
									<details
										key={item.q}
										className="group border border-border bg-surface/60 hover:border-accent/30 transition-colors duration-200 ease-out rounded-[var(--radius-lg)] overflow-hidden"
									>
										<summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 text-sm font-medium text-text-bright hover:text-accent transition-colors duration-200 ease-out [&::-webkit-details-marker]:hidden">
											{item.q}
											<span className="shrink-0 text-text-muted transition-transform duration-200 group-open:rotate-45 text-lg leading-none" aria-hidden="true">
												+
											</span>
										</summary>
										<div className="px-4 pb-4 text-sm leading-relaxed text-text-secondary">
											<AnswerText text={item.a} />
										</div>
									</details>
								))}
							</div>
						</section>
					</InViewFade>
				))}
			</div>
		</>
	);
}
