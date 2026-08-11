"use client";

import { BorderBeam } from "border-beam";
import { m, useReducedMotion } from "@/lib/framer-motion-client";
import { Menu, Settings, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { OmaLogo } from "@/components/ui/oma-logo";
import { useAuth } from "@/lib/hooks/useAuth";
import { Magnetic, EASE_SPRING, springs } from "@/lib/animation";
import { ApiStatus } from "./api-status";
import {
 isCurrentPath,
 primaryLinks,
 sectionLabelFor,
} from "./navbar/_lib/nav-links";
import { NavbarMobileMenu } from "./navbar/NavbarMobileMenu";
import { NavbarToolsDropdown } from "./navbar/NavbarToolsDropdown";
import { NavbarUserMenu } from "./navbar/NavbarUserMenu";
import { ThemeToggle } from "./ThemeToggle";

const build = process.env.NEXT_PUBLIC_BUILD_SHA?.slice(0, 7) ?? "dev";

export function Navbar() {
 const { isAuthenticated, isDemo, evmAddress, signOut, isAdmin } = useAuth();
 const [mobileOpen, setMobileOpen] = useState(false);
 const [toolsOpen, setToolsOpen] = useState(false);
 const [scrolled, setScrolled] = useState(false);
 const [mounted, setMounted] = useState(false);
 const mobileToggleRef = useRef<HTMLButtonElement | null>(null);
 const pathname = usePathname();
 const prefersReduced = useReducedMotion();

 // Close transient nav UI (mobile menu, tools dropdown) on every
 // route change so they don't stay open after a Next client-side
 // navigation. The user-menu manages its own state internally.
 useEffect(() => {
 setMobileOpen(false);
 setToolsOpen(false);
 }, [pathname]);

 // Scroll-driven glass + border glow. Passive + rAF-throttled.
 // Also marks `mounted` so client-only deps (e.g. BorderBeam's color-scheme
 // reads) don't cause a hydration mismatch.
 useEffect(() => {
 setMounted(true);
 let ticking = false;
 function onScroll() {
 if (ticking) return;
 ticking = true;
 requestAnimationFrame(() => {
 setScrolled(window.scrollY > 10);
 ticking = false;
 });
 }
 window.addEventListener("scroll", onScroll, { passive: true });
 onScroll();
 return () => window.removeEventListener("scroll", onScroll);
 }, []);

 const section = sectionLabelFor(pathname ?? "/");

 return (
		<header
			className={`sticky top-0 left-0 right-0 z-50 transition-[background-color,border-color,box-shadow,backdrop-filter] duration-300 font-mono ${
				scrolled
					? "border-b border-border-bright bg-[color-mix(in_srgb,var(--color-void)_85%,transparent)] backdrop-blur-xl shadow-sm"
					: "border-b border-border bg-void/90 backdrop-blur-md"
			}`}
		>
 <nav aria-label="Main navigation" className="w-full">
 <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-2 px-4 sm:px-6 lg:px-8">
 {/* LEFT: logo + section breadcrumb + primary links + tools dropdown */}
 <div className="flex min-w-0 items-center gap-1.5 sm:gap-2 lg:gap-4">
 <Magnetic strength={6}>
 <div className="relative inline-block">
 <Link
 href="/"
 className="group inline-flex shrink-0 items-center gap-2 rounded-[var(--radius-md)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
 >
 <span className="inline-flex transition-[filter] duration-300 group-hover:drop-shadow-[0_0_8px_var(--color-accent-glow)]">
 <OmaLogo size="sm" />
 </span>
 <span className="text-sm font-semibold text-text-bright tracking-tight group-hover:text-accent transition-colors duration-200 ease-out">
 oma
 </span>
 </Link>
 {!isAuthenticated && mounted && (
 <BorderBeam
 size="sm"
 duration={3}
 theme="auto"
 className="absolute inset-0 rounded-full pointer-events-none"
 >
 <div className="h-full w-full rounded-full" />
 </BorderBeam>
 )}
 </div>
 </Magnetic>

 <span
 aria-hidden="true"
 className="hidden 2xl:inline-block h-3 w-px bg-border"
 />

 {/* Section label — only show for sub-routes that aren't already
						 a primary nav link. Avoids the "~/ Playground · Playground"
						 duplication when the active page IS a primary link. */}
 {(() => {
 const onPrimaryLink = primaryLinks.some((l) =>
 isCurrentPath(pathname ?? "/", l.href),
 );
 if (onPrimaryLink) return null;
 return (
 <span
 className="hidden 2xl:inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-[11px] sm:text-xs text-text-muted tabular-nums"
 aria-label={`Current section: ${section}`}
 >
 <span className="text-text-tertiary">~/</span>
 <span className="text-text-secondary">{section}</span>
 </span>
 );
 })()}

 {/* Primary links (desktop) */}
 <ul className="hidden md:flex items-center gap-0.5">
 {primaryLinks.map((link) => {
 const Icon = link.icon;
 const isActive = isCurrentPath(pathname ?? "/", link.href);
 return (
 <li key={link.href} className="relative">
 <m.div
 whileHover={prefersReduced ? undefined : { y: -1 }}
 whileTap={prefersReduced ? undefined : { scale: 0.96 }}
 transition={EASE_SPRING}
 className="inline-block"
 >
 <Link
 href={link.href}
 aria-current={isActive ? "page" : undefined}
 className={`relative inline-flex h-9 items-center gap-1.5 rounded-sm px-2.5 text-xs transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
 isActive
 ? "text-accent"
 : "text-text-secondary hover:text-text-bright"
 }`}
 >
 {isActive && (
 <m.span
 layoutId="nav-active"
 aria-hidden="true"
className="absolute inset-0 rounded-sm bg-accent-dim"
			transition={springs.tab}
		/>
 )}
 <Icon
 className="relative z-10 h-3 w-3 opacity-70"
 aria-hidden="true"
 />
 <span className="relative z-10">{link.label}</span>
 </Link>
 </m.div>
 </li>
 );
 })}
 </ul>

 {/* Tools dropdown (desktop) — extracted component */}
 <NavbarToolsDropdown open={toolsOpen} onOpenChange={setToolsOpen} />
 </div>

 {/* RIGHT: actions */}
 <div className="flex shrink-0 items-center gap-2">
 <m.a
 href="https://github.com/NosytLabs"
 target="_blank"
 rel="noopener noreferrer"
 aria-label="GitHub repository (opens in new tab)"
 whileHover={prefersReduced ? undefined : { y: -1 }}
 whileTap={prefersReduced ? undefined : { scale: 0.94 }}
 transition={EASE_SPRING}
 className="hidden md:inline-flex h-11 w-11 items-center justify-center rounded-sm text-text-tertiary transition-colors duration-200 ease-out hover:bg-surface hover:text-text-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
 >
 <svg
 className="h-4 w-4"
 viewBox="0 0 24 24"
 fill="currentColor"
 aria-hidden="true"
 >
 <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
 </svg>
 </m.a>

 <ThemeToggle />

 {/* Settings gear only when signed in — guests use Sign in / mobile account card */}
 {isAuthenticated && !isDemo && (
 <m.div
 whileHover={prefersReduced ? undefined : { y: -1 }}
 whileTap={prefersReduced ? undefined : { scale: 0.94 }}
 transition={EASE_SPRING}
 className="inline-block"
 >
 <Link
 href="/settings"
 aria-label="Settings"
 className="inline-flex h-11 w-11 items-center justify-center rounded-sm text-text-tertiary transition-colors duration-200 ease-out hover:bg-surface hover:text-text-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
 >
 <Settings className="h-4 w-4" aria-hidden="true" />
 </Link>
 </m.div>
 )}
 </div>

 <div className="hidden xl:flex items-center ml-3 mr-1">
 <ApiStatus />
 </div>

 <span
 aria-hidden="true"
 className="hidden md:inline-block mx-1 h-4 w-px bg-border/60"
 />

	{isAuthenticated && !isDemo ? (
		<NavbarUserMenu
			evmAddress={evmAddress}
			onSignOut={signOut}
			isAdmin={isAdmin}
		/>
	) : (
		<div className="flex items-center gap-1.5 sm:gap-2">
			<Link
				href="/login"
				className="hidden sm:inline-flex h-11 items-center gap-1 px-3 text-xs font-medium text-text-secondary transition-colors duration-200 hover:text-text-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
			>
				Sign in
			</Link>
			<Magnetic strength={6}>
				<Link
					href="/login"
					className="inline-flex h-11 items-center gap-1.5 rounded-[var(--radius-md)] border border-accent/40 bg-accent px-4 text-xs font-bold text-void transition-[background-color,border-color,box-shadow,transform] duration-200 ease-out hover:bg-accent-bright hover:shadow-[0_0_18px_var(--color-accent-glow)] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
				>
					Get started
					<svg
						className="h-3 w-3"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2.5"
						aria-hidden="true"
					>
						<path
							d="M5 12h14M13 6l6 6-6 6"
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
					</svg>
				</Link>
			</Magnetic>
		</div>
	)}

	{/* Mobile toggle */}
	<button
		ref={mobileToggleRef}
		type="button"
		onClick={() => setMobileOpen(!mobileOpen)}
		className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-surface-elevated border border-border text-text-secondary transition-all duration-200 ease-out hover:bg-surface-hi hover:text-text-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent md:hidden"
		aria-label={
			mobileOpen ? "Close navigation menu" : "Open navigation menu"
		}
		aria-expanded={mobileOpen}
		aria-controls="mobile-menu"
	>
		{mobileOpen ? (
			<X className="h-4 w-4" aria-hidden="true" />
		) : (
			<Menu className="h-4 w-4" aria-hidden="true" />
		)}
	</button>
</div>

{/* Mobile menu — extracted component */}
<NavbarMobileMenu
	open={mobileOpen}
	onOpenChange={setMobileOpen}
	toggleRef={mobileToggleRef}
	isConnected={isAuthenticated && !isDemo}
	section={section}
	build={build}
	onDisconnect={signOut}
/>
</nav>
</header>
);
}
