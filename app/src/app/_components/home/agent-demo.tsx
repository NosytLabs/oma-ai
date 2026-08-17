"use client";
/**
	* Homepage section — brainless-inspired agent session demo (OMA-themed).
	*/

import { AgentSessionDemo } from "@/components/marketing/AgentSessionDemo";
import { Reveal } from "@/app/_components/home/reveal";
import { SectionHeader } from "@/app/_components/home/section-header";

export function AgentDemoSection() {
	return (
		<section
			aria-labelledby="agent-demo-headline"
			className="relative border-t border-border-subtle bg-surface/50 py-14 sm:py-18 lg:py-22"
		>
			<div className="container-page">
				<div className="grid grid-cols-[minmax(0,1fr)] items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-20 w-full">
					<Reveal>
						<SectionHeader
							id="agent-demo-headline"
							eyebrow="Agents"
							eyebrowVariant="caps"
							headline={
								<>
									Looks like a coding agent.
									<br />
									<span className="text-text-secondary">
										Runs on your gateway.
									</span>
								</>
							}
							subhead="Claude Code, Codex, Grok-style UIs all speak OpenAI. Point baseURL at OMA — multi-provider routing, USDC metering, no lock-in."
						/>
						<ul className="mt-10 space-y-4 text-base text-text-secondary">
							{[
								"Drop-in OpenAI SDK / any agent that takes a base URL",
								"Budget → frontier routing with circuit-breaker failover",
								"Pay per use in USDC — or x402 for agent wallets",
							].map((item) => (
								<li key={item} className="flex items-center gap-3">
									<span
										className="h-2 w-2 shrink-0 rounded-full bg-accent"
										aria-hidden="true"
									/>
									{item}
								</li>
							))}
						</ul>
					</Reveal>

					<Reveal>
						<div className="rounded-[var(--radius-2xl)] border border-border bg-panel p-2 shadow-xl ring-1 ring-white/5">
							<AgentSessionDemo />
						</div>
					</Reveal>
				</div>
			</div>
		</section>
	);
}
