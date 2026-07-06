"use client";

/**
 * TrustStrip — section 2 of the homepage.
 *
 * Plain-text wordmarks for upstream providers, separated by middle dots.
 * No SVG marks (replicas of trademarked logos are unsafe and obviously
 * fake to a trained eye). A footnote clarifies that OMA routes to these
 * providers behind one OpenAI-compatible API.
 */

import { Reveal } from "@/app/_components/home/reveal";
import { TRUST_NAMES } from "@/app/_components/home/_icons";

export function TrustStrip() {
	return (
		<section
			aria-label="Routing through upstream providers"
			className="relative border-y border-border-subtle bg-[var(--color-surface)]/40 py-10 sm:py-12"
		>
			<div className="container-page">
				<Reveal>
					<p className="text-center text-xs uppercase tracking-[0.18em] font-mono text-text-muted mb-6">
						Routing through
					</p>
				</Reveal>
				<Reveal>
					<ul
						className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-text-secondary font-medium text-base sm:text-lg tracking-tight"
					>
						{TRUST_NAMES.map((name) => (
							<li key={name} className="text-text-primary">{name}</li>
						))}
					</ul>
				</Reveal>
				<Reveal>
					<p className="mt-4 text-center text-xs text-text-muted font-mono">
						OMA routes requests to these providers via one
						OpenAI-compatible API.
					</p>
				</Reveal>
			</div>
		</section>
	);
}