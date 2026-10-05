"use client";

import { cn } from "@/components/ui/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { OmaNavLockup } from "@/components/ui/oma-logo";
import { useApiHealth } from "@/components/api-status";
import { useAuth } from "@/lib/hooks/useAuth";
import { accountLinks, isCurrentNavLink, isCurrentPath, primaryLinks, toolsLinks } from "./navbar/_lib/nav-links";

type FooterSection = {
	title: string;
	links: { label: string; href: string }[];
};

const CURRENT_YEAR = new Date().getFullYear();
const COMPANY: FooterSection = {
	title: "Company",
	links: [
		{ label: "About", href: "/about" },
		{ label: "Contact", href: "/contact" },
		// Status moved out of the Company column to a top-level item with a
		// live status dot (see Footer) — liveness is the point of that link,
		// and it only reads as such next to a live indicator.
		{ label: "Changelog", href: "/changelog" },
		{ label: "Privacy", href: "/privacy" },
		{ label: "Terms", href: "/terms" },
	],
};

/**
 * Social profiles.
 *
 * Only accounts that are confirmed to exist are listed — a dead social link
 * is worse than no social link. `github.com/NosytLabs` is the repository
 * owner (package.json `repository`, README, SECURITY.md advisory links,
 * json-ld `sameAs`), so it is the one entry we can vouch for. X / Discord /
 * Farcaster handles are intentionally absent: no repo doc or canonical URL
 * confirms them, so they are NOT rendered rather than guessed at.
 *
 * 44x44 hit targets, aria-label on each icon (the icon itself is decorative),
 * and rel="noopener noreferrer" on every external destination.
 */

/**
 * GitHub mark.
 *
 * NOT a lucide icon: lucide-react 1.50 removed the brand-icon set (it has no
 * `Github` export at all — see the package's icon list), and substituting a
 * generic glyph like `CodeXml` for a recognisable brand mark is worse than
 * inlining the official mark. This is the standard GitHub octocat path,
 * sized/stroked to match the lucide icons used elsewhere in the footer.
 */
function GitHubMark({ className }: { className?: string }) {
	return (
		<svg
			viewBox="0 0 24 24"
			fill="currentColor"
			aria-hidden="true"
			className={cn("h-4 w-4", className)}
		>
			<path d="M12 .5C5.37.5 0 5.78 0 12.29c0 5.21 3.44 9.63 8.2 11.19.6.11.82-.26.82-.58l-.01-2.05c-3.34.72-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.74.08-.73.08-.73 1.21.08 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.5.99.11-.78.42-1.3.76-1.6-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.13-.3-.54-1.52.11-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6.01 0c2.29-1.55 3.3-1.23 3.3-1.23.65 1.66.24 2.88.12 3.18.77.84 1.23 1.91 1.23 3.22 0 4.61-2.8 5.62-5.48 5.92.43.37.82 1.1.82 2.22l-.01 3.29c0 .32.21.7.82.58A11.77 11.77 0 0 0 24 12.29C24 5.78 18.63.5 12 .5Z" />
		</svg>
	);
}

const SOCIAL_LINKS = [
	{
		href: "https://github.com/NosytLabs",
		label: "OMA on GitHub",
		Icon: GitHubMark,
	},
] as const;

const STATUS_DOT_CLASS: Record<"checking" | "online" | "offline", string> = {
	checking: "bg-warning",
	online: "bg-success",
	offline: "bg-error",
};

const STATUS_TEXT: Record<"checking" | "online" | "offline", string> = {
	checking: "checking",
	online: "operational",
	offline: "degraded",
};

export function Footer() {
	const pathname = usePathname() ?? "/";
	const { isAuthenticated, isDemo } = useAuth();
	// Same hook + query key as the navbar chip / login page, so the footer dot
	// and every other liveness indicator agree by construction (react-query
	// dedupes on the shared ["health", "ready-v2"] key).
	const { status: apiStatus } = useApiHealth();
	const sections: FooterSection[] = [
		{ title: "Product", links: primaryLinks },
		{ title: "Resources", links: [
			...toolsLinks.filter((link) => link.href !== "/deposit"),
			{ label: "Glossary", href: "/glossary" },
		] },
		{ title: "Account", links: isAuthenticated && !isDemo ? accountLinks : [
			{ label: "Sign in", href: "/login" },
			{ label: "Buy credits", href: "/deposit" },
		] },
		COMPANY,
	];

	// Full-height application shells supply their own navigation.
	if (["/chat", "/dashboard", "/settings", "/admin"].some((href) => isCurrentPath(pathname, href))) return null;

	return (
		<footer aria-label="Site footer" className="border-t border-border bg-void">
			<div className="container-page">
				<div className="grid gap-10 py-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
					<div className="flex max-w-sm flex-col gap-3">
						<Link href="/" prefetch={false} aria-label="OMA home" className="inline-flex min-h-11 w-fit items-center rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"><OmaNavLockup size="sm" /></Link>
						<p className="text-[13px] leading-relaxed text-text-secondary">One gateway. Every model. No lock-in. OpenAI-compatible inference paid with USDC on Base, x402, or card when enabled.</p>
					</div>
					<nav aria-label="Footer navigation" className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-4">
						{sections.map((section) => <div key={section.title} className="min-w-0">
							<h2 className="mb-3 font-mono text-[11px] font-medium uppercase tracking-wider text-text-muted">{section.title}</h2>
							<ul className="space-y-1">
								{section.links.map((link) => {
									const active = isCurrentNavLink(pathname, link.href);
									return <li key={link.href}><Link href={link.href} prefetch={false} aria-current={active ? "page" : undefined}
										className={`inline-flex min-h-8 items-center rounded-sm py-1 text-xs leading-relaxed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${active ? "text-accent" : "text-text-secondary hover:text-accent"}`}>{link.label}</Link></li>;
								})}
							</ul>
						</div>)}
					</nav>
				</div>

				{/* Status sits at the top level rather than inside a link column:
				    the dot is the payload, and burying it in a 4-column grid
				    made it read as another static nav row. The dot is
				    aria-hidden so the link's accessible name stays exactly
				    "Status" (existing tests + screen-reader users); the state
				    itself is announced by the adjacent live region. */}
				<div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-border pt-6">
					<Link
						href="/status"
						prefetch={false}
						className="inline-flex min-h-11 items-center gap-2 rounded-sm text-xs text-text-secondary transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
					>
						<span
							aria-hidden="true"
							className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT_CLASS[apiStatus]}`}
						/>
						Status
					</Link>
					<span aria-live="polite" className="sr-only">
						API {STATUS_TEXT[apiStatus]}
					</span>

					{/* Social. GitHub only — see SOCIAL_LINKS for why the other
					    handles are not guessed at. */}
					<ul aria-label="Social links" className="ml-auto flex items-center gap-1">
						{SOCIAL_LINKS.map(({ href, label, Icon }) => (
							<li key={href}>
								<a
									href={href}
									target="_blank"
									rel="noopener noreferrer"
									aria-label={label}
									className="inline-flex h-11 w-11 items-center justify-center rounded-sm text-text-secondary transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
								>
									<Icon className="h-4 w-4" />
								</a>
							</li>
						))}
					</ul>
				</div>

				{/* Open-source callout. The repo is public and self-hostable;
				    saying so above the copyright is the honest thing to do —
				    and it is the one "follow us" slot that exists without a
				    backend behind it (there is no newsletter service, so no
				    subscribe form is shipped here). */}
				<p className="border-t border-border py-5 text-[13px] leading-relaxed text-text-secondary">
					OMA is open source. Read it, fork it, or self-host the gateway —{" "}
					<a
						href="https://github.com/NosytLabs/oma-ai"
						target="_blank"
						rel="noopener noreferrer"
						className="text-accent underline underline-offset-4 hover:no-underline"
					>
						the whole stack is on GitHub
					</a>
					.
				</p>

				<p className="pb-5 font-mono text-[11px] text-text-muted">© <span suppressHydrationWarning>{CURRENT_YEAR}</span> OMA by NosytLabs</p>
			</div>
		</footer>
	);
}
