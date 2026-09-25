import type { Metadata } from "next";
import Link from "next/link";

// Defined once and reused below: without explicit openGraph/twitter blocks a
// page only sets `title`/`description`, and both social cards then fall back
// to the ROOT layout's copy — so a shared /changelog link showed the generic
// "AI inference, USDC on Base" title instead of the changelog's own.
const TITLE = "Changelog — what's new on OMA";
const DESCRIPTION =
	"Notable changes to OMA: new models, pricing updates, fixes, and features. Plain entries, newest first.";

export const metadata: Metadata = {
	title: TITLE,
	description: DESCRIPTION,
	alternates: { canonical: "/changelog" },
	openGraph: {
		title: TITLE,
		description: DESCRIPTION,
		url: "/changelog",
		images: [{ url: "/og-image.png", width: 1280, height: 720, alt: "OMA changelog" }],
	},
	twitter: {
		card: "summary_large_image",
		title: TITLE,
		description: DESCRIPTION,
		images: ["/og-image.png"],
	},
	robots: { index: true, follow: true },
};

// NOTE: keep entries newest-first. Dates are YYYY-MM-DD of the change.
// When adding an entry, consider whether /docs or /faq need a matching update.
const ENTRIES: {
	date: string;
	title: string;
	body: string;
	tags?: string[];
}[] = [
	{
		date: "2026-09-25",
		title: "FAQ expanded for teams and agents",
		body: "The FAQ grew two new sections: \"Using OMA with your tools\" (Claude Code, OpenCode, Cursor, migrating an OpenAI app, the Anthropic Messages endpoint) and \"Reliability & safety\" (provider outages, rate limits, what a provider can see).",
		tags: ["content", "site"],
	},
	{
		date: "2026-09-25",
		title: "Faster landing pages and lighter first paint",
		body: "The anonymous marketing path no longer ships the animation library: hero, scroll-reveals, navbar, footer, and mobile menu now render with plain CSS and the browser's IntersectionObserver. Framer Motion is still available inside the signed-in product areas (models, pricing, chat, dashboard) that use it. Heavy app pages also stop prefetching their chunks from the landing page, and stable public pages now serve from the edge cache instead of re-rendering on every request.",
		tags: ["perf", "site"],
	},
	{
		date: "2026-09-25",
		title: "New glossary reference is fully linked up",
		body: "The 32-term /glossary reference — What is an API key, a token, x402, a context window, and so on — now has an indexed, sitemapped detail page per term. Related-term cross-links and a shared canonical URL keep the set consistent.",
		tags: ["feature", "seo"],
	},
	{
		date: "2026-09-25",
		title: "Canonical and structured-data cleanup",
		body: "The site now uses one source of truth for its canonical origin instead of scattered per-page hardcodes, and the root head gained WebSite + Sitelinks SearchBox structured data so engines understand the site's name and search action.",
		tags: ["seo"],
	},
	{
		date: "2026-09-05",
		title: "Free website chat fixed for guests",
		body: "A non-standard parameter in our internal failover hints was rejected by the upstream inference network, which made free-tier chat stream empty replies for signed-out visitors. Failover hints are now stripped at the provider boundary — guests get real responses again.",
		tags: ["fix", "chat"],
	},
	{
		date: "2026-09-05",
		title: "Status page + changelog launched",
		body: "Two frequently-requested pages are live: /status shows live health of the site, gateway, and free chat; /changelog (this page) records notable changes going forward.",
		tags: ["feature", "site"],
	},
	{
		date: "2026-09-04",
		title: "Free tier surfaced on the homepage",
		body: "The homepage now says it up front: website chat is free, no account needed. It was always true — now it's visible.",
		tags: ["site"],
	},
	{
		date: "2026-09-04",
		title: "Design pass: page spacing + eyebrow standardization",
		body: "Unified section eyebrows, page headers, and spacing scale across marketing and product pages for a consistent read on desktop and mobile.",
		tags: ["design"],
	},
];

export default function ChangelogPage() {
	return (
		<section className="page-shell">
			<div className="container-page page-content mx-auto max-w-2xl">
				<span className="section-eyebrow-caps">Changelog</span>
				<h1 className="h1-page mt-4 text-text-bright">What&apos;s new on OMA.</h1>
				<p className="page-intro">
					Notable changes — new models, pricing, fixes, and features.
					Newest first. For API-level details, see the{" "}
					<Link href="/docs" className="text-accent underline underline-offset-4">
						API docs
					</Link>
					.
				</p>

				<ol className="mt-10 flex flex-col gap-8">
					{ENTRIES.map((e) => (
						<li
							key={e.date + e.title}
							className="border-l-2 border-border-hi pl-5"
						>
							<p className="font-mono text-xs text-text-muted">{e.date}</p>
							<h2 className="mt-1 text-lg font-semibold text-text-bright">
								{e.title}
							</h2>
							<p className="mt-2 text-sm leading-relaxed text-text-secondary">
								{e.body}
							</p>
							{e.tags && e.tags.length > 0 && (
								<p className="mt-2 flex gap-2">
									{e.tags.map((t) => (
										<span
											key={t}
											className="font-mono text-[10px] uppercase tracking-wider rounded-full border border-border-hi px-2 py-0.5 text-text-muted"
										>
											{t}
										</span>
									))}
								</p>
							)}
						</li>
					))}
				</ol>
			</div>
		</section>
	);
}
