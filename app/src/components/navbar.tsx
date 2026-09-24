"use client";

import { BorderBeam } from "border-beam";
import { m, useReducedMotion } from "@/lib/framer-motion-client";
import { Menu, Settings, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { OmaNavLockup } from "@/components/ui/oma-logo";
import { GithubIcon } from "@/components/ui/brand-icons";
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

export function Navbar() {
	const {
		isAuthenticated,
		isDemo,
		evmAddress,
		signOut,
		isPending,
		user,
	} = useAuth();
	const [mobileOpen, setMobileOpen] = useState(false);
	const [toolsOpen, setToolsOpen] = useState(false);
	const [scrolled, setScrolled] = useState(false);
	const [mounted, setMounted] = useState(false);
	const mobileToggleRef = useRef<HTMLButtonElement | null>(null);
	const pathname = usePathname();
	const prefersReduced = useReducedMotion();

	// Close transient nav UI on every route change.
	useEffect(() => {
		setMobileOpen(false);
		setToolsOpen(false);
	}, [pathname]);

	useEffect(() => {
		const media = window.matchMedia("(min-width: 1024px)");
		const closeOnDesktop = (event: MediaQueryListEvent) => {
			if (event.matches) setMobileOpen(false);
		};
		media.addEventListener("change", closeOnDesktop);
		return () => media.removeEventListener("change", closeOnDesktop);
	}, []);

	// Scroll-driven glass + border glow. Passive + rAF-throttled.
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
	const onPrimaryLink = primaryLinks.some((l) =>
		isCurrentPath(pathname ?? "/", l.href),
	);
	const loginHref = `/login?next=${encodeURIComponent(pathname ?? "/")}`;

	return (
		<header
			className={`sticky top-0 left-0 right-0 z-50 transition-[background-color,border-color,box-shadow,backdrop-filter] duration-200 font-mono ${
				scrolled
					? "border-b border-border-bright bg-[color-mix(in_srgb,var(--color-void)_85%,transparent)] backdrop-blur-xl shadow-sm"
					: "border-b border-border bg-void/90 backdrop-blur-md"
			}`}
		>
			<nav aria-label="Main navigation" className="w-full">
				{/* Two-cluster bar: brand/links | actions. lg+ shows desktop links;
				    below lg the hamburger opens the mobile menu (avoids tablet crush). */}
				<div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
					{/* LEFT */}
					<div className="flex min-w-0 items-center gap-2 lg:gap-4">
						<Magnetic strength={6}>
							<div className="relative inline-flex items-center">
								<Link
									href="/"
									className="group relative z-[1] inline-flex min-h-10 min-w-11 shrink-0 items-center rounded-[var(--radius-md)] px-1 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
									aria-label="OMA home"
								>
									<span className="inline-flex transition-[filter,color] duration-300 group-hover:drop-shadow-[0_0_8px_var(--color-accent-glow)] [&_span]:group-hover:text-accent">
										<OmaNavLockup size="sm" />
									</span>
								</Link>
								{!isAuthenticated && mounted && (
									<BorderBeam
										size="sm"
										duration={3}
										theme="auto"
										className="pointer-events-none absolute -inset-x-1 -inset-y-0.5 rounded-[var(--radius-lg)]"
									>
										<div className="h-full w-full rounded-[var(--radius-lg)]" />
									</BorderBeam>
								)}
							</div>
						</Magnetic>

						{/* Section label — wide screens only, not on primary links */}
						{!onPrimaryLink && (
							<span
								className="hidden xl:inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-[11px] text-text-muted tabular-nums sm:text-xs"
								aria-label={`Current section: ${section}`}
							>
								<span className="text-text-tertiary">~/</span>
								<span className="text-text-secondary">{section}</span>
							</span>
						)}

						{/* Primary links — large screens only */}
						<ul className="hidden items-center lg:flex">
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
												className={`relative inline-flex h-11 items-center gap-1.5 rounded-sm px-3 text-[13px] transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
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

						<NavbarToolsDropdown open={toolsOpen} onOpenChange={setToolsOpen} />
					</div>

					{/* RIGHT — single cluster so justify-between never interleaves items */}
					<div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
						<div className="hidden lg:flex items-center px-1">
							<ApiStatus />
						</div>

						<m.a
							href="https://github.com/NosytLabs"
							target="_blank"
							rel="noopener noreferrer"
							aria-label="GitHub repository (opens in new tab)"
							whileHover={prefersReduced ? undefined : { y: -1 }}
							whileTap={prefersReduced ? undefined : { scale: 0.94 }}
							transition={EASE_SPRING}
							className="hidden h-11 w-11 items-center justify-center rounded-sm text-text-tertiary transition-colors duration-200 ease-out hover:bg-surface hover:text-text-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent lg:inline-flex"
						>
							<GithubIcon className="h-4 w-4" />
						</m.a>

						<ThemeToggle />

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

						<span
							aria-hidden="true"
							className="mx-0.5 hidden h-4 w-px bg-border/60 lg:inline-block"
						/>

						{isPending ? (
							// Skeleton sized to the signed-out "Get API key" CTA
							// (btn-mono: min-h-10) so the swap to real content
							// doesn't shift the navbar.
							<div
								className="h-10 w-36 animate-pulse rounded-sm border border-border bg-surface"
								aria-label="Loading account"
								role="status"
							/>
						) : isAuthenticated && !isDemo ? (
							<NavbarUserMenu
								evmAddress={evmAddress}
								email={user?.email ?? null}
								onSignOut={() => signOut({ callbackURL: "/" })}
							/>
						) : (
							<Magnetic strength={6}>
								<Link
									href={loginHref}
									aria-label="Sign in or create an account"
									className="btn-mono btn-primary inline-flex px-2.5 text-[11px] sm:px-4 sm:text-xs"
								>
									<span className="sm:hidden">Sign in</span>
									<span className="hidden sm:inline">Sign in / Sign up</span>
									<svg
										className="hidden h-3 w-3 sm:block"
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
						)}

						{/* Hamburger below lg — full desktop nav starts at lg */}
						<button
							ref={mobileToggleRef}
							type="button"
							onClick={() => setMobileOpen(!mobileOpen)}
							className="inline-flex h-11 w-11 items-center justify-center rounded-sm border border-border bg-surface-elevated text-text-secondary transition-[background-color,border-color,color,transform] duration-200 ease-out hover:bg-surface-hi hover:text-text-bright active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent lg:hidden"
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
				</div>

				<NavbarMobileMenu
					open={mobileOpen}
					onOpenChange={setMobileOpen}
					toggleRef={mobileToggleRef}
					isConnected={isAuthenticated && !isDemo}
					section={section}
					onDisconnect={() => signOut({ callbackURL: "/" })}
				/>
			</nav>
		</header>
	);
}
