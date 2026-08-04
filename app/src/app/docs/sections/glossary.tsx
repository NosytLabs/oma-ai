import { ArrowUpRight, BookOpen, Sparkles } from "lucide-react";
import Link from "next/link";
import { AnimatedSection, SectionHeading } from "./shared";

/**
 * Docs glossary — points to the canonical novice-friendly /glossary page
 * and the new /capabilities matrix instead of duplicating the long
 * definition list. Keeps /docs focused on the technical reference;
 * /glossary carries the alphabetized plain-language definitions.
 */
export function GlossarySection() {
	return (
		<AnimatedSection delay={550}>
			<SectionHeading
				id="glossary"
				icon={<BookOpen className="h-5 w-5 text-accent" />}
				title="Glossary & capabilities"
				subtitle="Plain-language terms live on /glossary; the modality × payment-rail matrix lives on /capabilities."
			/>

			<div className="mt-6 grid gap-4 sm:grid-cols-2">
				<Link
					href="/glossary"
					className="group flex items-start gap-3 rounded-xl border border-border bg-panel p-5 transition-colors hover:border-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
				>
					<BookOpen className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
					<div className="min-w-0">
						<p className="text-sm font-semibold text-text-bright group-hover:text-accent transition-colors">
							Glossary
						</p>
						<p className="mt-1 text-[12.5px] leading-relaxed text-text-secondary">
							API, model, token, context window, embedding, USDC, SIWE, x402,
							EIP-3009, MCP, A2A, A2UI, llms.txt — alphabetized and explained
							without jargon.
						</p>
						<span className="mt-2 inline-flex items-center gap-1 text-[12px] font-mono text-accent">
							Open /glossary <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
						</span>
					</div>
				</Link>
				<Link
					href="/capabilities"
					className="group flex items-start gap-3 rounded-xl border border-border bg-panel p-5 transition-colors hover:border-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
				>
					<Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
					<div className="min-w-0">
						<p className="text-sm font-semibold text-text-bright group-hover:text-accent transition-colors">
							Capabilities
						</p>
						<p className="mt-1 text-[12.5px] leading-relaxed text-text-secondary">
							Chat, image, video, and web search — all OpenAI-compatible.
							Three payment rails (card, USDC, x402). Six protocols
							(OpenAI, Anthropic, A2A, A2UI, MCP, x402).
						</p>
						<span className="mt-2 inline-flex items-center gap-1 text-[12px] font-mono text-accent">
							Open /capabilities <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
						</span>
					</div>
				</Link>
			</div>
		</AnimatedSection>
	);
}
