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
import { TRUST_NAMES } from "@/app/_components/home/trust-names";

export function TrustStrip() {
	return (
	<div className="flex h-full flex-col justify-start border-b border-border/40 pb-10 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-10">
	<Reveal>
	<span className="section-eyebrow-caps mb-6">
		Routing through
	</span>
	</Reveal>
	<Reveal>
	<ul className="flex flex-wrap items-center justify-start gap-x-1 gap-y-2 text-text-secondary font-medium text-base sm:text-lg tracking-tight">
	{TRUST_NAMES.map((name, i) => (
	<li key={name} className="inline-flex items-center">
	{i > 0 && (
	<span
	className="mx-2.5 text-text-tertiary select-none"
	aria-hidden="true"
	>
	·
	</span>
	)}
	<span className="text-text-bright/90 transition-colors duration-200 ease-out hover:text-accent cursor-default">
	{name}
	</span>
	</li>
	))}
	</ul>
	</Reveal>
	<Reveal>
	<p className="mt-4 text-left text-xs text-text-muted font-mono leading-relaxed">
	OMA routes requests through Venice and OMA-AI via one
	OpenAI-compatible API.
	</p>
	</Reveal>
	</div>
	);
}
