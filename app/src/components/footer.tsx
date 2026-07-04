"use client";

import { m } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { OmaLogo } from "@/components/ui/oma-logo";
import { EASE_SPRING, fadeUp, StaggerReveal } from "@/lib/motion";
import { ApiStatus } from "./api-status";

type FooterLink = { label: string; href: string };

type FooterSection = {
	title: string;
	links: FooterLink[];
};

// Grouped site index. Section order = reading order on the page.
// Groups mirror the navbar: Product + Tools + Account + Resources + Legal.
const FOOTER_SECTIONS: FooterSection[] = [
	{
		title: "Product",
		links: [
			{ label: "models", href: "/models" },
			{ label: "chat", href: "/chat" },
			{ label: "pricing", href: "/pricing" },
			{ label: "image gen", href: "/image-generation" },
			{ label: "video gen", href: "/video-generation" },
		],
	},
	{
		title: "Tools",
		links: [
			{ label: "swap", href: "/swap" },
			{ label: "about", href: "/about" },
		],
	},
	{
		title: "Account",
		links: [
			{ label: "dashboard", href: "/dashboard" },
			{ label: "deposit", href: "/deposit" },
			{ label: "settings", href: "/settings" },
		],
	},
	{
		title: "Resources",
		links: [
			{ label: "docs", href: "/docs" },
			{ label: "blog", href: "/blog" },
			{ label: "faq", href: "/faq" },
			{ label: "support", href: "/support" },
		],
	},
	{
		title: "Legal",
		links: [
			{ label: "terms", href: "/terms" },
			{ label: "privacy", href: "/privacy" },
			{ label: "crypto payments", href: "/deposit" },
		],
	},
];

/**
 * Footer
 * ===
 * Build-time constants are baked into both server and client bundles, so
 * they cannot drift across the SSR/CSR boundary.
 *
 * `CURRENT_YEAR` and `LAST_DEPLOY` are hard-coded for the same reason:
 * any code path that calls `new Date()` at render time will produce
 * server/client mismatches when midnight UTC rolls over between the SSR
 * render and the client hydration (both within the same calendar day in
 * the user's locale). Updating these in source control once per deploy
 * is a small price for clean hydration.
 */
const CURRENT_YEAR = 2026;
const LAST_DEPLOY = "2026-07-02";

export function Footer() {
	const pathname = usePathname() ?? "";
	return (
		<footer
			aria-label="Site footer"
			className="relative overflow-hidden border-t border-border bg-void font-mono"
		>
			{/* Top border glow — thin gradient hairline */}
			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent"
			/>

			{/* Background depth — animated grid masked to fade at edges */}
			<div
				aria-hidden="true"
				className="bg-grid-animated mask-radial pointer-events-none absolute inset-0 -z-10 opacity-[0.12]"
			/>

			<div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-10">
				<StaggerReveal
					className="grid gap-10 lg:grid-cols-[2fr_3fr]"
					stagger={0.04}
				>
					<m.div variants={fadeUp} className="flex flex-col gap-4">
						<Link
							href="/"
							className="inline-flex items-center gap-2 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm w-fit"
						>
							<m.span
								whileHover={{ y: -2 }}
								transition={EASE_SPRING}
								className="inline-flex transition-[filter] duration-500 group-hover:drop-shadow-[0_0_6px_var(--color-accent)]"
							>
								<OmaLogo size="sm" />
							</m.span>
							<span className="text-sm text-text-bright font-semibold">
								oma
							</span>
							<span className="text-text-muted text-xs">·sys</span>
						</Link>
						<p className="text-xs text-text-secondary leading-relaxed max-w-md">
							Permissionless AI inference. One key, every model, pay in crypto.
							<br />
							Try any endpoint with x402 — no signup, no email, no card.
							<br />
							Base chain · mainnet. Built and operated by the OMA collective.
						</p>
						<div className="flex items-center gap-3 text-[11px] text-text-muted">
							<ApiStatus showRetryButton={false} />
							<span className="hidden sm:inline">·</span>
							<a
								href="https://github.com/oma-ai"
								target="_blank"
								rel="noopener noreferrer"
								className="hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm transition-colors"
							>
								github.com/oma-ai
							</a>
							<span>·</span>
							<a
								href="https://twitter.com/oma_ai"
								target="_blank"
								rel="noopener noreferrer"
								className="hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm transition-colors"
							>
								@oma_ai
							</a>
						</div>
					</m.div>

					<m.nav
						variants={fadeUp}
						aria-label="Footer navigation"
						className="text-[11px]"
					>
						<p className="text-text-muted mb-3 uppercase tracking-widest text-[10px]">
							Index
						</p>
						<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-4 gap-y-6">
							{FOOTER_SECTIONS.map((section) => (
								<div key={section.title} className="min-w-0">
									<p className="text-accent mb-2 uppercase tracking-widest text-[9px] font-semibold">
										{section.title}
									</p>
									<ul className="flex flex-col gap-1">
										{section.links.map((link) => {
											const isCurrent =
												pathname === link.href ||
												pathname.startsWith(`${link.href}/`);
											return (
												<li key={link.label}>
													<Link
														href={link.href}
														aria-current={isCurrent ? "page" : undefined}
														className="group/link inline-flex items-center gap-1.5 text-text-secondary hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm transition-colors py-1"
													>
														<m.span
															aria-hidden="true"
															initial={false}
															className="text-text-muted transition-[color,transform] duration-200 group-hover/link:text-accent group-hover/link:translate-x-0.5"
														>
															·
														</m.span>
														<span>{link.label}</span>
													</Link>
												</li>
											);
										})}
									</ul>
								</div>
							))}
						</div>
					</m.nav>
				</StaggerReveal>

				<div className="mt-10 pt-5 border-t border-border text-[10px] text-text-muted leading-relaxed">
					<p suppressHydrationWarning>
						© {CURRENT_YEAR} OMA AI · base mainnet
						{process.env.NEXT_PUBLIC_BUILD_SHA
							? ` · build ${process.env.NEXT_PUBLIC_BUILD_SHA.slice(0, 7)}`
							: ""}{" "}
						· last deploy {LAST_DEPLOY}
					</p>
				</div>
			</div>
		</footer>
	);
}
