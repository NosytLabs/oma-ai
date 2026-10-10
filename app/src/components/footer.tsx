"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { OmaNavLockup } from "@/components/ui/oma-logo";
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
		{ label: "Status", href: "/status" },
		{ label: "Changelog", href: "/changelog" },
		{ label: "Privacy", href: "/privacy" },
		{ label: "Terms", href: "/terms" },
	],
};

export function Footer() {
	const pathname = usePathname() ?? "/";
	const { isAuthenticated, isDemo } = useAuth();
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
										className={`inline-flex min-h-8 min-w-6 items-center rounded-sm py-1 text-xs leading-relaxed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${active ? "text-accent" : "text-text-secondary hover:text-accent"}`}>{link.label}</Link></li>;
								})}
							</ul>
						</div>)}
					</nav>
				</div>
				<p className="border-t border-border py-5 font-mono text-[11px] text-text-muted">© <span suppressHydrationWarning>{CURRENT_YEAR}</span> OMA by NosytLabs</p>
			</div>
		</footer>
	);
}
