import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { notFound } from "next/navigation";
import SITE_URL from "@/lib/site";
import { PageShell } from "@/app/_components/page-shell";
import { BreadcrumbListJsonLd } from "@/components/json-ld";
import {
	GLOSSARY_SLUGS,
	GLOSSARY_TERMS_BY_SLUG,
	RELATED_TERMS,
	type GlossarySlug,
} from "@/components/glossary-data";

export const dynamicParams = false;

export function generateStaticParams() {
	return GLOSSARY_SLUGS.map((slug) => ({ slug }));
}

/**
 * Meta descriptions are truncated by search engines at roughly 160
 * characters. Slicing blindly cuts mid-word ("…turning text into a list of numbe"),
 * which reads as broken copy in the SERP and drops the trailing call to action.
 * Cut at the last word boundary instead and drop any dangling ellipsis.
 */
const MAX_DESCRIPTION_LENGTH = 160;

export function truncateDescription(text: string, max = MAX_DESCRIPTION_LENGTH): string {
	const clean = text.replace(/\s+/g, " ").trim();
	if (clean.length <= max) return clean;
	const cut = clean.slice(0, max);
	const lastSpace = cut.lastIndexOf(" ");
	// Only fall back to the hard cut when there is no space at all — otherwise
	// a very long single token would be truncated to nothing.
	return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.!?-]+$/, "");
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
	const { slug } = await params;
	const entry = GLOSSARY_TERMS_BY_SLUG[slug as GlossarySlug];
	if (!entry) return {};
	const title = `What is ${entry.term}? · OMA glossary`;
	const description = truncateDescription(entry.def);
	return {
		title,
		description,
		alternates: { canonical: `/glossary/${slug}` },
		openGraph: { title, description, url: `/glossary/${slug}`, images: [{ url: "/og-image.png", width: 1280, height: 720, alt: "OMA glossary" }] },
		twitter: { card: "summary_large_image", images: ["/og-image.png"] },
		robots: { index: true, follow: true },
	};
}

function JsonLd({ data }: { data: object }) {
	return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}

export default async function GlossaryTermPage({ params }: { params: Promise<{ slug: string }> }) {
	const { slug } = await params;
	if (!GLOSSARY_SLUGS.includes(slug as GlossarySlug)) notFound();
	const entry = GLOSSARY_TERMS_BY_SLUG[slug as GlossarySlug];
	const related = RELATED_TERMS[slug as GlossarySlug];
	const path = `/glossary/${slug}`;
	const baseUrl = SITE_URL;
	return (
		<div className="relative bg-void text-text overflow-x-clip">
			<BreadcrumbListJsonLd items={[{ name: "Home", url: "/" }, { name: "Glossary", url: "/glossary" }, { name: entry.term, url: path }]} />
			<JsonLd data={{ "@context": "https://schema.org", "@type": "DefinedTerm", name: entry.term, description: entry.def, url: `${baseUrl}${path}`, inDefinedTermSet: { "@type": "DefinedTermSet", name: "OMA glossary", url: `${baseUrl}/glossary` } }} />
			<JsonLd data={{ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: [{ "@type": "Question", name: `What is ${entry.term}?`, acceptedAnswer: { "@type": "Answer", text: entry.def } }] }} />
			<div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10"><div className="absolute inset-0 bg-grid opacity-[0.35] mask-radial" /></div>
			<PageShell>
				<nav aria-label="Breadcrumb" className="mb-8 flex flex-wrap items-center gap-2 text-sm text-text-secondary">
					<Link href="/glossary" className="flex min-h-11 items-center gap-1.5 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"><ArrowLeft className="h-4 w-4" aria-hidden="true" />Glossary</Link>
					<span aria-hidden="true">/</span><span className="text-text-muted">{entry.term}</span>
				</nav>
				<main>
					<span className="section-eyebrow-caps">Glossary</span>
					<h1 className="display-headline mt-3 text-text-bright">What is {entry.term}?</h1>
					{entry.aka && <p className="mt-2 font-mono text-sm text-text-muted">Also known as {entry.aka}</p>}
					<p className="page-intro mt-6 max-w-3xl">{entry.def}</p>
					<section aria-labelledby="related-terms" className="mt-12 border-t border-border pt-8">
						<h2 id="related-terms" className="text-lg font-medium text-text-bright">Related terms</h2>
						<ul className="mt-4 grid gap-3 sm:grid-cols-3">
							{related.map((relatedSlug) => <li key={relatedSlug}><Link href={`/glossary/${relatedSlug}`} className="flex min-h-12 items-center justify-between border border-border px-4 text-sm font-medium text-text-bright transition-colors hover:border-accent/40 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">{GLOSSARY_TERMS_BY_SLUG[relatedSlug].term}<ArrowRight className="h-4 w-4 text-accent" aria-hidden="true" /></Link></li>)}
						</ul>
					</section>
				</main>
			</PageShell>
		</div>
	);
}
