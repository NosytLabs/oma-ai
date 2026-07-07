"use client";

/**
 * Footer
 * =====
 * Single source of truth for site map links, social links, and the
 * deployment signature shown in the bottom bar.
 *
 * Build-time constants (`CURRENT_YEAR`, `LAST_DEPLOY`) are hard-coded
 * because any `new Date()` call at render time will produce
 * server/client hydration mismatches when midnight UTC rolls over
 * between SSR and hydration. Bump in source on each deploy.
 *
 * Layout (desktop, lg+):
 *   ┌────────────────────────────────────────────────────────────────┐
 *   │  Logo · tagline · socials                  (4 cols of nav)     │
 *   ├────────────────────────────────────────────────────────────────┤
 *   │  © 2026 · MIT · base chain · API status · github               │
 *   └────────────────────────────────────────────────────────────────┘
 *
 * Layout (mobile, sm and below):
 *   Brand stack, then a 2-column nav grid (Product | Tools, etc.),
 *   then the social row, then the legal / deploy row.
 */

import {
	Github,
	Twitter,
	BookOpen,
	ArrowUpRight,
	Boxes,
	Terminal,
	Tag,
	FileText,
	Network,
	Activity,
	Newspaper,
	ArrowLeftRight,
	Info,
	Key,
	Zap,
	Settings,
	HelpCircle,
	LifeBuoy,
	Activity as PulseIcon,
	Gavel,
	ShieldCheck,
} from "lucide-react";
import { m } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { OmaLogo } from "@/components/ui/oma-logo";
import { EASE_SPRING, fadeUp, StaggerReveal } from "@/lib/motion";
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

/* ---------- Static data ---------- */

const PRODUCT: FooterSection = {
	title: "Product",
	links: [
		{ label: "models", href: "/models", icon: Boxes },
		{ label: "chat", href: "/chat", icon: Terminal },
		{ label: "pricing", href: "/pricing", icon: Tag },
		{ label: "docs", href: "/docs", icon: FileText },
	],
};

const TOOLS: FooterSection = {
	title: "Tools",
	links: [
		{ label: "network", href: "/network", icon: Network },
		{ label: "observability", href: "/observability", icon: Activity },
		{ label: "changelog", href: "/changelog", icon: Newspaper },
		{ label: "swap", href: "/swap", icon: ArrowLeftRight },
		{ label: "blog", href: "/blog", icon: BookOpen },
		{ label: "about", href: "/about", icon: Info },
	],
};

const ACCOUNT: FooterSection = {
	title: "Account",
	links: [
		{ label: "dashboard", href: "/dashboard", icon: Key },
		{ label: "deposit", href: "/deposit", icon: Zap },
		{ label: "settings", href: "/settings", icon: Settings },
	],
};

const RESOURCES: FooterSection = {
	title: "Resources",
	links: [
		{ label: "docs", href: "/docs", icon: FileText },
		{ label: "faq", href: "/faq", icon: HelpCircle },
		{ label: "support", href: "/support", icon: LifeBuoy },
		{ label: "status", href: "/status", icon: PulseIcon },
	],
};

const LEGAL: FooterSection = {
	title: "Legal",
	links: [
		{ label: "terms", href: "/terms", icon: Gavel },
		{ label: "privacy", href: "/privacy", icon: ShieldCheck },
		{ label: "disclosures", href: "/disclosures", icon: FileText },
	],
};

const FOOTER_SECTIONS: FooterSection[] = [
	PRODUCT,
	TOOLS,
	ACCOUNT,
	RESOURCES,
	LEGAL,
];

const SOCIAL_LINKS = [
	{
		label: "GitHub",
		href: "https://github.com/oma-ai",
		icon: Github,
		handle: "oma-ai",
	},
	{
		label: "Twitter",
		href: "https://twitter.com/oma_ai",
		icon: Twitter,
		handle: "@oma_ai",
	},
];

const CURRENT_YEAR = 2026;
const LAST_DEPLOY = "2026-07-02";

/* ---------- Component ---------- */

export function Footer() {
	const pathname = usePathname() ?? "";

	return (
		<footer
			aria-label="Site footer"
			className="relative overflow-hidden border-t border-border bg-void font-mono"
		>
			{/* Top border glow */}
			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent"
			/>

			{/* Background depth */}
			<div
				aria-hidden="true"
				className="bg-grid-animated mask-radial pointer-events-none absolute inset-0 -z-10 opacity-[0.10]"
			/>

			<div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
				{/* ===== MAIN GRID ===== */}
				<StaggerReveal
					className="grid gap-x-8 gap-y-10 pt-12 pb-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]"
					stagger={0.04}
				>
					{/* --- BRAND COLUMN --- */}
					<m.div
						variants={fadeUp}
						className="flex flex-col gap-5 max-w-sm"
					>
						<Link
							href="/"
							aria-label="OMA · home"
							className="group inline-flex items-center gap-2.5 w-fit focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm"
						>
							<m.span
								whileHover={{ y: -2 }}
								transition={EASE_SPRING}
								className="inline-flex transition-[filter] duration-500 group-hover:drop-shadow-[0_0_6px_var(--color-accent)]"
							>
								<OmaLogo size="sm" />
							</m.span>
							<span className="text-sm text-text-bright font-semibold tracking-tight">
								oma
							</span>
							<span className="text-text-tertiary text-[10px] font-mono uppercase tracking-widest">
								/sys
							</span>
						</Link>

						<p className="text-[12.5px] leading-relaxed text-text-secondary">
							Permissionless AI inference. One key, every model — pay in
							crypto. Built on Base, deployed at the network edge.
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

						{/* Status indicator */}
						<div className="flex items-center gap-3 text-[11px] text-text-muted">
							<ApiStatus showRetryButton={false} />
						</div>
					</m.div>

					{/* --- NAV COLUMNS --- */}
					<m.nav
						variants={fadeUp}
						aria-label="Footer navigation"
						className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 lg:grid-cols-5"
					>
						{FOOTER_SECTIONS.map((section) => (
							<div key={section.title} className="min-w-0">
								<p className="mb-3 text-[10px] font-mono uppercase tracking-[0.18em] text-accent font-semibold">
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

				{/* ===== BOTTOM BAR ===== */}
				<div className="border-t border-border-subtle">
					<div className="flex flex-col gap-3 py-5 text-[11px] text-text-muted sm:flex-row sm:items-center sm:justify-between">
						<p
							suppressHydrationWarning
							className="font-mono tabular-nums"
						>
							<span className="text-text-secondary">©</span>{" "}
							<span>{CURRENT_YEAR}</span>{" "}
							<span className="text-text-tertiary">·</span>{" "}
							<span>MIT licensed</span>{" "}
							<span className="text-text-tertiary">·</span>{" "}
							<span>base mainnet</span>{" "}
							<span className="text-text-tertiary">·</span>{" "}
							<span>
								deploy{" "}
								<span className="text-text-secondary">
									{LAST_DEPLOY}
								</span>
							</span>
						</p>

						<div className="flex flex-wrap items-center gap-x-4 gap-y-2 font-mono">
							<span className="inline-flex items-center gap-1.5">
								<span
									aria-hidden="true"
									className="relative flex h-1.5 w-1.5"
								>
									<span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-60 animate-ping" />
									<span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
								</span>
								<span>all systems nominal</span>
							</span>
							<span className="text-text-tertiary">·</span>
							<a
								href="https://github.com/oma-ai"
								target="_blank"
								rel="noopener noreferrer"
								className="inline-flex items-center gap-1 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm"
							>
								github <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
							</a>
							<span className="text-text-tertiary">·</span>
							<Link
								href="/status"
								className="hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm"
							>
								status
							</Link>
						</div>
					</div>
				</div>
			</div>
		</footer>
	);
}