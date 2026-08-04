import { ArrowUpRight, BookOpen, HelpCircle, MessageCircle } from "lucide-react";
import Link from "next/link";
import { AnimatedSection, SectionHeading } from "./shared";

/**
 * Docs FAQ — points to the canonical novice-friendly /faq and /glossary
 * pages instead of duplicating their content. The /docs surface is the
 * technical reference; user-facing Q&A and term definitions live at
 * /faq and /glossary so they can be indexed and translated independently.
 */
export function FAQSection() {
	return (
		<AnimatedSection delay={500}>
			<SectionHeading
				id="faq"
				icon={<HelpCircle className="h-5 w-5 text-accent" />}
				title="Questions answered in plain language"
				subtitle="Beginner-friendly Q&A and an alphabetized glossary live on their own pages — kept in sync with the developer reference."
			/>

			<div className="mt-6 grid gap-4 sm:grid-cols-2">
				<Link
					href="/faq"
					className="group flex items-start gap-3 rounded-xl border border-border bg-panel p-5 transition-colors hover:border-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
				>
					<MessageCircle className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
					<div className="min-w-0">
						<p className="text-sm font-semibold text-text-bright group-hover:text-accent transition-colors">
							FAQ
						</p>
						<p className="mt-1 text-[12.5px] leading-relaxed text-text-secondary">
							Plain-language answers for first-time users and developers —
							accounts, API keys, USDC, x402, tokens, models, privacy, and
							how to start.
						</p>
						<span className="mt-2 inline-flex items-center gap-1 text-[12px] font-mono text-accent">
							Open /faq <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
						</span>
					</div>
				</Link>
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
							Every AI + crypto term explained in plain language — tokens,
							context windows, USDC, Base, x402, EIP-3009, MCP, A2A, A2UI,
							llms.txt, and more.
						</p>
						<span className="mt-2 inline-flex items-center gap-1 text-[12px] font-mono text-accent">
							Open /glossary <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
						</span>
					</div>
				</Link>
			</div>
		</AnimatedSection>
	);
}
