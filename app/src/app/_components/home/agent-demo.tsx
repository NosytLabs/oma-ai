"use client";

/**
 * Homepage section — brainless-inspired agent session demo (OMA-themed).
 */

import dynamic from "next/dynamic";
import { Reveal } from "@/app/_components/home/reveal";
import { SectionHeader } from "@/app/_components/home/section-header";
import { Skeleton } from "@/components/ui/Skeleton";

const AgentSessionDemo = dynamic(
	() =>
		import("@/components/marketing/AgentSessionDemo").then(
			(m) => m.AgentSessionDemo,
		),
	{
		ssr: false,
		loading: () => (
			<Skeleton className="h-[380px] w-full rounded-xl border border-border" />
		),
	},
);

export function AgentDemoSection() {
	return (
		<section
			aria-labelledby="agent-demo-headline"
			className="relative border-t border-border-subtle py-16 sm:py-20"
		>
			<div className="container-page">
				<div className="grid min-w-0 grid-cols-1 items-start gap-10 lg:grid-cols-[1fr_1.15fr] lg:gap-14 w-full">
					<Reveal>
						<SectionHeader
							id="agent-demo-headline"
							eyebrow="Agents"
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
						<ul className="mt-8 space-y-3 text-sm text-text-secondary">
							{[
								"Drop-in OpenAI SDK / any agent that takes a base URL",
								"Budget → frontier routing with circuit-breaker failover",
								"Pay per token in USDC — or x402 for agent wallets",
							].map((item) => (
								<li key={item} className="flex items-start gap-2">
									<span
										className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
										aria-hidden="true"
									/>
									{item}
								</li>
							))}
						</ul>
					</Reveal>

					<Reveal>
						<AgentSessionDemo />
					</Reveal>
				</div>
			</div>
		</section>
	);
}
