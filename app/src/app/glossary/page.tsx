import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { InViewFade } from "@/components/motion/in-view-fade";
import { BreadcrumbListJsonLd } from "@/components/json-ld";
import { PageShell } from "@/app/_components/page-shell";
import {
	GLOSSARY_SLUGS,
	TERMS,
	slugifyTerm,
	type GlossarySlug,
} from "@/components/glossary-data";

export const metadata: Metadata = {
	title: "Glossary — AI & crypto terms, explained",
	description:
		"Every term you'll meet on OMA explained in plain language: token, context window, API key, USDC, Base, x402, streaming, embedding, and more.",
	alternates: { canonical: "/glossary" },
	openGraph: {
		title: "Glossary — AI & crypto terms, explained",
		description:
			"Token? Context window? USDC? x402? A jargon-free dictionary for the AI API world.",
		url: "/glossary",
		images: [{ url: "/og-image.png", width: 1280, height: 720, alt: "OMA Glossary" }],
	},
	robots: { index: true, follow: true },
};


const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export default function GlossaryPage() {
	const byLetter = new Map<string, { slug: GlossarySlug; term: string }[]>();
	for (const slug of GLOSSARY_SLUGS) {
		const entry = TERMS.find((item) => slugifyTerm(item.term) === slug);
		if (!entry) continue;
		const letter = entry.term[0]!.toUpperCase();
		if (!byLetter.has(letter)) byLetter.set(letter, []);
		byLetter.get(letter)!.push({ slug, term: entry.term });
	}
	return (
		<div className="relative bg-void text-text overflow-x-clip">
			<BreadcrumbListJsonLd items={[{ name: "Home", url: "/" }, { name: "Glossary", url: "/glossary" }]} />
			<div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
				<div className="absolute inset-0 bg-grid opacity-[0.35] mask-radial" />
			</div>

			<PageShell>
				<Link
					href="/"
					className="flex w-fit min-h-11 items-center gap-1.5 text-sm text-text-secondary hover:text-accent transition-colors duration-200 ease-out mb-8"
				>
					<ArrowLeft className="h-4 w-4" aria-hidden="true" />
					Home
				</Link>

				<span className="section-eyebrow-caps">Reference</span>
				<h1 className="display-headline mt-3 text-text-bright">Glossary</h1>
				<p className="page-intro max-w-2xl">
					Every term you&apos;ll meet on OMA, explained without jargon — from
					tokens and context windows to USDC and x402. New here? Pair this
					with the <Link href="/faq" className="text-accent underline underline-offset-2 decoration-accent/40 hover:decoration-accent">FAQ</Link> and{" "}
					<Link href="/getting-started" className="text-accent underline underline-offset-2 decoration-accent/40 hover:decoration-accent">getting started</Link> guide.
				</p>

				<nav aria-label="Glossary letters" className="mt-8 flex flex-wrap gap-1.5">
					{LETTERS.split("").map((l) => (
						<a
							key={l}
							href={`#${l.toLowerCase()}`}
							className={`inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius-sm)] border text-xs font-mono transition-colors duration-200 ease-out ${
								byLetter.has(l)
									? "border-accent/40 text-accent hover:bg-accent/10"
									: "border-border text-text-muted/40 pointer-events-none"
							}`}
						>
							{l}
						</a>
					))}
				</nav>

				<div className="mt-10 space-y-10">
					{LETTERS.split("").map((l, li) => {
						const items = byLetter.get(l);
						if (!items) return null;
						return (
							<InViewFade key={l} delay={Math.min(li * 0.04, 0.2)}>
								<section aria-labelledby={`letter-${l.toLowerCase()}`} id={`${l.toLowerCase()}`} className="scroll-mt-24">
									<h2
										id={`letter-${l.toLowerCase()}`}
										className="section-eyebrow-caps mb-4"
									>
										{l}
									</h2>
									<ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
										{items.map((t) => (
											<li key={t.term}>
												<Link href={`/glossary/${t.slug}`} className="flex min-h-12 items-center border-l-2 border-border pl-4 text-sm font-semibold text-text-bright transition-colors duration-200 ease-out hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
													{t.term}
												</Link>
											</li>
										))}
									</ul>
								</section>
							</InViewFade>
						);
					})}
				</div>
			</PageShell>
		</div>
	);
}
