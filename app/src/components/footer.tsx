"use client";

/**
 * Footer
 * =====
 * Single source of truth for site map links and the copyright
 * signature shown in the bottom bar.
 *
 * The copyright year renders from `new Date().getFullYear()` with
 * `suppressHydrationWarning` on that exact `<span>` (React only
 * suppresses mismatches for the element's own direct text) so a
 * midnight-UTC rollover between SSR and hydration can't throw.
 *
 * Layout (desktop, lg+): brand column + up to 3 nav columns.
 * Mobile: brand stack, then 2-col nav (3-col from sm), then bottom bar.
 */

import {
	ArrowUpRight,
	Terminal,
	Gavel,
	ShieldCheck,
	BookMarked,
	BookOpen,
	Activity,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { OmaNavLockup } from "@/components/ui/oma-logo";
import { GithubIcon } from "@/components/ui/brand-icons";
import {
	isCurrentPath,
	primaryLinks,
	toolsLinks,
} from "./navbar/_lib/nav-links";
import { RevealStagger } from "@/app/_components/home/reveal";
import { useAuth } from "@/lib/hooks/useAuth";

type FooterLink = {
	label: string;
	href: string;
	icon?: React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;
};

type FooterSection = {
	title: string;
	links: FooterLink[];
};

// PRODUCT / DEVELOPERS / LEARN derive from the single source of truth in
// navbar/_lib/nav-links.ts to prevent link label drift. Only footer-only
// entries (Playground, Glossary, legal, account) stay local here.
const byHref = <T extends { href: string }>(
	list: T[],
	href: string,
): T | undefined => list.find((l) => l.href === href);

const PRODUCT: FooterSection = {
	title: "Product",
	links: primaryLinks.filter((l) => l.href !== "/docs"),
};

const DEVELOPERS: FooterSection = {
	title: "Developers",
	links: [
		byHref(primaryLinks, "/docs") ?? { label: "Docs", href: "/docs", icon: BookOpen },
		byHref(toolsLinks, "/docs#endpoints") ?? { label: "API Reference", href: "/docs#endpoints" },
		{ label: "Playground", href: "/chat", icon: Terminal },
	],
};

const LEARN: FooterSection = {
	title: "Learn",
	links: [
		byHref(toolsLinks, "/getting-started") ?? { label: "Get started", href: "/getting-started" },
		byHref(toolsLinks, "/faq") ?? { label: "FAQ", href: "/faq" },
		{ label: "Glossary", href: "/glossary", icon: BookMarked },
	],
};

function accountSection(isAuthenticated: boolean): FooterSection {
	return {
		title: "Account",
		links: isAuthenticated
			? [
					{ label: "Dashboard", href: "/dashboard" },
					{ label: "Settings", href: "/settings" },
					{ label: "Credits", href: "/deposit" },
				]
			: [
					{ label: "Sign in to OMA", href: "/login" },
					{ label: "Buy credits", href: "/deposit" },
				],
	};
}

const LEGAL: FooterSection = {
	title: "Legal & Trust",
	links: [
		{ label: "About", href: "/about" },
		{ label: "Privacy", href: "/privacy", icon: ShieldCheck },
		{ label: "Terms", href: "/terms", icon: Gavel },
		{ label: "Contact", href: "/contact" },
	],
};

// Operational pages — small, but expected by users comparing us to
// Venice-style competitors (both expose status + a changelog).
const OPERATIONS: FooterSection = {
	title: "Status",
	links: [
		{ label: "Live status", href: "/status", icon: Activity },
		{ label: "Changelog", href: "/changelog" },
	],
};

const SOCIAL_LINKS = [
	{
		label: "GitHub",
		href: "https://github.com/NosytLabs",
		icon: GithubIcon,
		handle: "NosytLabs",
	},
];

const CURRENT_YEAR = new Date().getFullYear();

export function Footer() {
	const pathname = usePathname() ?? "";
	const { isAuthenticated } = useAuth();
	const FOOTER_SECTIONS: FooterSection[] = [
		PRODUCT,
		DEVELOPERS,
		LEARN,
		accountSection(isAuthenticated),
		LEGAL,
		OPERATIONS,
	];

	// Viewport-locked app surfaces only — the chat composer, dashboards,
	// admin and settings shells. /login KEEPS the footer: it is a public
	// conversion route and previously rendered with no legal/nav links at
	// all (footer null ⇒ no Terms/Privacy on the sign-in path). The
	// footer's own 480px stack below the login card is intentional.
	if (
		pathname === "/chat" ||
		pathname.startsWith("/chat/") ||
		pathname === "/dashboard" ||
		pathname.startsWith("/dashboard/") ||
		pathname === "/settings" ||
		pathname.startsWith("/settings/") ||
		pathname === "/admin" ||
		pathname.startsWith("/admin/")
	) {
		return null;
	}

	return (
		<footer
			aria-label="Site footer"
			className="relative overflow-hidden border-t border-border bg-[color-mix(in_srgb,var(--color-void)_90%,var(--color-panel))]"
		>
			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent"
			/>

			<div className="container-page">
				<RevealStagger
					className="grid gap-x-10 gap-y-10 pt-14 pb-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]"
				>
					{/* BRAND COLUMN */}
					<div
						className="flex max-w-sm flex-col gap-5"
					>
						<Link
							href="/"
							prefetch={false}
							className="group inline-flex w-fit items-center rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
							aria-label="OMA home"
						>
							<span
								className="lift inline-flex transition-[filter] duration-300 group-hover:drop-shadow-[0_0_6px_var(--color-accent)] [&_span]:group-hover:text-accent"
							>
								<OmaNavLockup size="sm" />
							</span>
						</Link>

						<p className="text-[13px] leading-relaxed text-text-secondary">
							One gateway. Every model. No lock-in. OpenAI-compatible inference
							paid with USDC on Base, x402, or card when enabled.
						</p>

						{/* Social row */}
						<div className="flex flex-wrap items-center gap-2">
							{SOCIAL_LINKS.map((s) => {
								const Icon = s.icon;
								return (
									<a
										key={s.label}
										href={s.href}
										target="_blank"
										rel="noopener noreferrer"
										aria-label={`${s.label} · ${s.handle} (opens in new tab)`}
										className="lift group inline-flex items-center gap-2 rounded-sm border border-border bg-surface/40 px-3 py-1.5 text-[11px] text-text-secondary transition-colors duration-200 ease-out hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
									>
										<Icon
											className="h-3.5 w-3.5 opacity-80 group-hover:opacity-100"
											aria-hidden="true"
										/>
										<span className="font-mono">{s.handle}</span>
										<ArrowUpRight
											className="h-3 w-3 opacity-50 group-hover:opacity-100"
											aria-hidden="true"
										/>
									</a>
								);
							})}
						</div>
					</div>

					{/* NAV COLUMNS */}
					<nav
						aria-label="Footer navigation"
						className="grid w-full grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3"
					>
						{FOOTER_SECTIONS.map((section) => (
							<div key={section.title} className="min-w-0">
								{/*
									These column titles were <p> elements. Inside a
									<nav> landmark that gives assistive tech no structure to
									navigate: a screen-reader user listing headings on the page
									skipped the entire footer, and the six link groups read as
									one undifferentiated list of ~30 links. They are visual
									captions, not prose, so <h2 className="sr-only"> carries the
									structural label while the styled <p> keeps the look —
									no visual change, real heading outline.

									The sr-only h2 also carries the caption's mono type
									classes. It is invisible, so this changes no pixels, but
									it stops six serif h2s from landing on EVERY page's h2
									level: pages whose real h2s are mono kickers (/faq,
									/glossary) or mono filter labels (/models) otherwise
									measured as "h2 mixes Instrument Serif with ui-monospace"
									purely because of these structural labels. Styling the h2
									as the caption it labels keeps one family per level.
									*/}
									<h2 className="sr-only font-mono text-[10px] font-semibold uppercase tracking-[0.18em]">
									{section.title}
									</h2>
								<p
									aria-hidden="true"
									className="mb-3 text-[10px] font-mono uppercase tracking-[0.18em] text-text-muted font-semibold"
								>
									{section.title}
								</p>
								<ul className="flex flex-col gap-1">
									{section.links.map((link) => {
										const isCurrent = isCurrentPath(pathname, link.href);
										const Icon = link.icon;
										return (
											<li key={link.label}>
												<Link
													href={link.href}
													prefetch={
														link.href === "/chat" ||
														link.href === "/pricing" ||
														link.href.startsWith("/docs")
															? false
															: undefined
													}
													aria-current={isCurrent ? "page" : undefined}
													className={`group/link inline-flex items-center gap-2 rounded-sm px-1.5 py-1.5 -ml-1.5 text-[12px] transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
														isCurrent
															? "text-accent bg-accent-dim font-semibold underline underline-offset-2"
															: "text-text-secondary hover:text-accent hover:bg-surface/60 hover:underline underline-offset-2 hover:font-semibold"
													}`}
												>
													{Icon && (
														<Icon
															className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 ease-out ${
																isCurrent
																	? "text-accent"
																	: "text-text-tertiary group-hover/link:text-accent group-hover/link:translate-x-0.5"
															}`}
															aria-hidden="true"
														/>
													)}
													<span className="truncate">{link.label}</span>
												</Link>
											</li>
										);
									})}
								</ul>
							</div>
						))}
					</nav>
				</RevealStagger>

				{/* BOTTOM BAR */}
				<div className="border-t border-border-subtle">
					<div className="flex flex-col gap-3 py-5 text-[11px] text-text-muted sm:flex-row sm:items-center sm:justify-between">
						<p className="font-mono tabular-nums">
							<span className="text-text-secondary">©</span>{" "}
							<span suppressHydrationWarning aria-label="Copyright year">{CURRENT_YEAR}</span>{" "}
							<span className="text-text-tertiary">·</span>{" "}
							<span>by NosytLabs</span>{" "}
							<span className="text-text-tertiary">·</span>{" "}
							<span>MIT licensed</span>{" "}
							<span className="text-text-tertiary">·</span>{" "}
							<span>Base mainnet</span>
						</p>

						<div className="flex flex-wrap items-center gap-x-4 gap-y-2 font-mono">
							<a
								href="https://github.com/NosytLabs"
								target="_blank"
								rel="noopener noreferrer"
								aria-label="OMA on GitHub (opens in a new tab)"
								className="inline-flex min-h-6 items-center gap-1 hover:text-text transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-void rounded-sm"
							>
								github <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
							</a>
						</div>
					</div>
				</div>
			</div>
		</footer>
	);
}
