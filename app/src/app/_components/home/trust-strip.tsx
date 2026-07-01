"use client";

/**
 * TrustStrip — section 2 of the homepage.
 * Compact logo row BELOW the hero. Monochrome icons inherit color from
 * parent text class so we tint via utility classes.
 */

import { Reveal, RevealStagger } from "@/app/_components/home/reveal";
import { TRUST_LOGOS } from "@/app/_components/home/_icons";

export function TrustStrip() {
	return (
		<section
			aria-label="Ecosystem integrations"
			className="relative border-y border-border-subtle bg-[var(--color-surface)]/40 py-10 sm:py-12"
		>
			<div className="container-page">
				<Reveal>
					<p className="text-center text-xs uppercase tracking-[0.18em] font-mono text-text-muted mb-8">
						Works with the tools you ship on
					</p>
				</Reveal>
				<RevealStagger
					className="grid grid-cols-3 sm:grid-cols-6 gap-x-4 gap-y-6 items-center justify-items-center text-text-muted"
					amount={0.3}
				>
					{TRUST_LOGOS.map(({ name, Component }) => (
						<div
							key={name}
							className="flex items-center justify-center hover:text-text-secondary transition-colors duration-200"
						>
							<Component title={name} className="h-6 w-6 sm:h-7 sm:w-7" />
							<span className="sr-only">{name}</span>
						</div>
					))}
				</RevealStagger>
			</div>
		</section>
	);
}