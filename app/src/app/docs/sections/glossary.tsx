import { ArrowUpRight, BookOpen, Sparkles } from "lucide-react";
import Link from "next/link";
import { MODEL_COUNT } from "@/lib/models-data";
import { AnimatedSection, SectionHeading } from "./shared";

/**
	* Docs glossary — points to the canonical novice-friendly /glossary page
	* and the model catalog instead of duplicating the long definition list.
	* Keeps /docs focused on the technical reference; /glossary carries the
	* alphabetized plain-language definitions.
	*/
export function GlossarySection() {
	return (
		<AnimatedSection delay={550}>
			<SectionHeading
				id="glossary"
				icon={<BookOpen className="h-5 w-5 text-accent" />}
				title="Glossary & models"
				subtitle="Plain-language terms live on /glossary; the full model catalog with pricing lives on /models."
			/>

			{/* Anchor target for DocsSearch (`glossary-defs`). Full definitions
			 * live at /glossary; this just gives the search modal something
			 * to scroll to so the URL hash is shareable. */}
			<div id="glossary-defs" className="mt-6 grid gap-4 sm:grid-cols-2">
				<Link
					href="/glossary"
					className="group flex items-start gap-3 rounded-[var(--radius-xl)] border border-border bg-panel shadow-[var(--shadow-md)] p-5 transition-transform duration-200 ease-out hover:border-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.97]"
				>
					<BookOpen className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
					<div className="min-w-0">
						<p className="text-sm font-semibold text-text-bright group-hover:text-accent transition-colors duration-200 ease-out">
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
					href="/models"
					className="group flex items-start gap-3 rounded-[var(--radius-xl)] border border-border bg-panel shadow-[var(--shadow-md)] p-5 transition-transform duration-200 ease-out hover:border-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.97]"
				>
					<Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
					<div className="min-w-0">
						<p className="text-sm font-semibold text-text-bright group-hover:text-accent transition-colors duration-200 ease-out">
							Capabilities
						</p>
						<p className="text-[12.5px] leading-relaxed text-text-secondary">
							Catalog of {MODEL_COUNT}+ curated chat models with live pricing,
							context windows, and provider routing. Compare models before
							you call the API.
						</p>
						<span className="mt-2 inline-flex items-center gap-1 text-[12px] font-mono text-accent">
							Open /models <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
						</span>
					</div>
				</Link>
			</div>
		</AnimatedSection>
	);
}
