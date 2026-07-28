"use client";

/**
 * Footer
 * =====
 * Single source of truth for site map links and the deployment
 * signature shown in the bottom bar.
 *
 * Build-time constants (`CURRENT_YEAR`, `LAST_DEPLOY`) are hard-coded
 * because any `new Date()` call at render time will produce
 * server/client hydration mismatches when midnight UTC rolls over
 * between SSR and hydration. Bump in source on each deploy.
 *
 * `suppressHydrationWarning` must sit on the exact element whose text
 * can differ (the build-date `<span>`), not an ancestor — React only
 * suppresses mismatches for the element's own direct text. A stale
 * server bundle (constant bumped while `next dev` is running) otherwise
 * throws a hydration error on every page.
 *
 * Layout (desktop, lg+):
 *   ┌────────────────────────────────────────────────────────────────┐
 *   │  Logo · tagline · socials                  (3 cols of nav)     │
 *   ├────────────────────────────────────────────────────────────────┤
 *   │  © 2026 · github                                             │
 *   └────────────────────────────────────────────────────────────────┘
 *
 * Layout (mobile):
 *   Brand stack, then a 2-column nav grid (Product | Resources),
 *   then the legal row, then the bottom bar.
 */

import {
	ArrowUpRight,
	Boxes,
	Terminal,
	Tag,
	FileText,
	Network,
	Activity,
	Newspaper,
	Gavel,
	ShieldCheck,
} from "lucide-react";
import { m } from "@/lib/framer-motion-client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { OmaLogo } from "@/components/ui/oma-logo";
import { EASE_SPRING, fadeUp, StaggerReveal } from "@/lib/motion";
import { useWallet } from "@/components/wallet-provider";
import { ApiStatus } from "./api-status";

type FooterLink = {
	label: string;
	href: string;
	icon?: React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;
};

type FooterSection = {
	title: string;
	links: FooterLink[];
};

const PRODUCT: FooterSection = {
	title: "Product",
	links: [
		{ label: "Models", href: "/models", icon: Boxes },
		{ label: "Playground", href: "/chat", icon: Terminal },
		{ label: "Pricing", href: "/pricing", icon: Tag },
		{ label: "Docs", href: "/docs", icon: FileText },
		{ label: "Compare", href: "/compare" },
		{ label: "About", href: "/about" },
	],
};

const TOOLS: FooterSection = {
	title: "Tools",
	links: [
		{ label: "Network", href: "/network", icon: Network },
		{ label: "Observability", href: "/observability", icon: Activity },
		{ label: "Changelog", href: "/changelog", icon: Newspaper },
	],
};

function accountSection(isAuthenticated: boolean): FooterSection {
	return {
		title: "Account",
		links: isAuthenticated
			? [
					{ label: "Dashboard", href: "/dashboard" },
					{ label: "Settings", href: "/settings" },
					{ label: "Credits", href: "/dashboard/credits" },
				]
			: [
					{ label: "Dashboard", href: "/dashboard" },
					{ label: "Settings", href: "/settings" },
					{ label: "Sign in to OMA", href: "/login" },
				],
	};
}

const LEGAL: FooterSection = {
	title: "Legal",
	links: [
		{ label: "Terms", href: "/terms", icon: Gavel },
		{ label: "Privacy", href: "/privacy", icon: ShieldCheck },
		{ label: "Contact", href: "/contact" },
	],
};

// Brand icons (removed from lucide-react 1.x)
function GithubIcon({ className }: { className?: string }) {
	return (
		<svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
			<path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
		</svg>
	);
}

function TwitterIcon({ className }: { className?: string }) {
	return (
		<svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
			<path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
		</svg>
	);
}

const SOCIAL_LINKS = [
	{
		label: "GitHub",
		href: "https://github.com/NosytLabs/oma-ai",
		icon: GithubIcon,
		handle: "NosytLabs/oma-ai",
	},
	{
		label: "Twitter",
		href: "https://twitter.com/oma_ai",
		icon: TwitterIcon,
		handle: "@oma_ai",
	},
];

const CURRENT_YEAR = 2026;
const LAST_DEPLOY = "2026-07-26";

export function Footer() {
	const pathname = usePathname() ?? "";
	const { isAuthenticated } = useWallet();
	const FOOTER_SECTIONS: FooterSection[] = [
		PRODUCT,
		TOOLS,
		accountSection(isAuthenticated),
		LEGAL,
	];

	// /chat is a viewport-locked app surface — a footer below it forces a
	// scroll that pushes the composer off-screen.
	if (pathname === "/chat" || pathname.startsWith("/chat/")) {
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
				<StaggerReveal
					className="grid gap-x-10 gap-y-10 pt-14 pb-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]"
					stagger={0.04}
				>
					{/* BRAND COLUMN */}
					<m.div
						variants={fadeUp}
						className="flex max-w-sm flex-col gap-5"
					>
						<Link
							href="/"
							prefetch={false}
							className="group inline-flex items-center gap-2.5 w-fit focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm"
						>
							<m.span
								whileHover={{ y: -2 }}
								transition={EASE_SPRING}
								className="inline-flex transition-[filter] duration-300 group-hover:drop-shadow-[0_0_6px_var(--color-accent)]"
							>
								<OmaLogo size="sm" />
							</m.span>
							<span className="text-sm text-text-bright font-semibold tracking-tight">
								oma
							</span>
						</Link>

						<p className="text-[13px] leading-relaxed text-text-secondary">
							One gateway. Every model. No lock-in. OpenAI-compatible inference
							paid per request in USDC on Base.
						</p>

						{/* Social row */}
						<div className="flex flex-wrap items-center gap-2">
							{SOCIAL_LINKS.map((s) => {
								const Icon = s.icon;
								return (
									<m.a
										key={s.label}
										href={s.href}
										target="_blank"
										rel="noopener noreferrer"
										aria-label={`${s.label} · ${s.handle} (opens in new tab)`}
										whileHover={{ y: -1 }}
										transition={EASE_SPRING}
										className="group inline-flex items-center gap-2 rounded-sm border border-border bg-surface/40 px-3 py-1.5 text-[11px] text-text-secondary transition-colors hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
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
									</m.a>
								);
							})}
						</div>

						<div className="flex items-center gap-3 text-[11px] text-text-muted">
							<ApiStatus showRetryButton={false} />
						</div>
					</m.div>

					{/* NAV COLUMNS */}
					<m.nav
						variants={fadeUp}
						aria-label="Footer navigation"
						className="grid grid-cols-2 gap-x-5 gap-y-7 sm:grid-cols-3 lg:grid-cols-4"
					>
						{FOOTER_SECTIONS.map((section) => (
							<div key={section.title} className="min-w-0">
								<p className="mb-3 text-[10px] font-mono uppercase tracking-[0.18em] text-text-muted font-semibold">
									{section.title}
								</p>
								<ul className="flex flex-col gap-1">
									{section.links.map((link) => {
										const isCurrent =
											pathname === link.href ||
											(pathname.startsWith(`${link.href}/`) &&
												link.href.length > 1);
										const Icon = link.icon;
										return (
											<li key={link.label}>
												<Link
													href={link.href}
													prefetch={false}
													aria-current={isCurrent ? "page" : undefined}
													className={`group/link inline-flex items-center gap-2 rounded-sm px-1.5 py-1.5 -ml-1.5 text-[12px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
														isCurrent
															? "text-accent bg-accent-dim"
															: "text-text-secondary hover:text-accent hover:bg-surface/60"
													}`}
												>
													{Icon && (
														<Icon
															className={`h-3.5 w-3.5 shrink-0 transition-transform ${
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
					</m.nav>
				</StaggerReveal>

				{/* BOTTOM BAR */}
				<div className="border-t border-border-subtle">
					<div className="flex flex-col gap-3 py-5 text-[11px] text-text-muted sm:flex-row sm:items-center sm:justify-between">
						<p className="font-mono tabular-nums">
							<span className="text-text-secondary">©</span>{" "}
							<span suppressHydrationWarning>{CURRENT_YEAR}</span>{" "}
							<span className="text-text-tertiary">·</span>{" "}
							<span>MIT licensed</span>{" "}
							<span className="text-text-tertiary">·</span>{" "}
							<span>base mainnet</span>{" "}
							<span className="text-text-tertiary">·</span>{" "}
							<span>
								build{" "}
								<span
									suppressHydrationWarning
									className="text-text-secondary"
								>
									{LAST_DEPLOY}
								</span>
							</span>
						</p>

						<div className="flex flex-wrap items-center gap-x-4 gap-y-2 font-mono">
							<a
								href="https://github.com/NosytLabs/oma-ai"
								target="_blank"
								rel="noopener noreferrer"
								className="inline-flex items-center gap-1 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm"
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
