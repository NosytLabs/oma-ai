"use client";

import { m, useReducedMotion } from "framer-motion";
import { Github, Menu, Settings, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { OmaLogo } from "@/components/ui/oma-logo";
import { useWallet } from "@/components/wallet-context";
import { EASE_SPRING, Magnetic } from "@/lib/motion";
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
import { ImprovedConnectButton as Web3ConnectButton } from "./ui/ImprovedConnectButton";

const build = process.env.NEXT_PUBLIC_BUILD_SHA?.slice(0, 7) ?? "dev";

export function Navbar() {
	const { evmAddress, isConnected, disconnect, authMethod, accountNumber } =
		useWallet();
	const [mobileOpen, setMobileOpen] = useState(false);
	const [toolsOpen, setToolsOpen] = useState(false);
	const [scrolled, setScrolled] = useState(false);
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
	useEffect(() => {
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

	const section = sectionLabelFor(pathname);

	return (
		<header
			className={`sticky top-0 left-0 right-0 z-50 border-b font-mono transition-colors duration-300 ${
				scrolled
					? "glass-strong border-border-bright"
					: "border-border bg-void/95 backdrop-blur-md"
			}`}
		>
			<nav aria-label="Main navigation" className="w-full">
				<div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-2 px-4 sm:px-6">
					{/* LEFT: logo + section breadcrumb + primary links + tools dropdown */}
					<div className="flex min-w-0 items-center gap-2 sm:gap-3">
						<Magnetic strength={6}>
							<Link
								href="/"
								className="inline-flex shrink-0 items-center gap-2 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
								aria-label="OMA home"
							>
								<OmaLogo size="sm" />
								<span className="text-sm font-semibold text-text-bright tracking-tight">
									oma
								</span>
							</Link>
						</Magnetic>

						<span
							aria-hidden="true"
							className="hidden xl:inline-block h-3 w-px bg-border"
						/>

						<span
							className="hidden xl:inline-flex min-w-0 items-center gap-1 text-[11px] sm:text-xs text-text-muted tabular-nums"
							aria-label={`Current section: ${section}`}
						>
							<span className="text-text-tertiary">~/</span>
							<span className="truncate text-text-secondary">{section}</span>
						</span>

						{/* Primary links (desktop) */}
						<ul className="hidden md:flex items-center gap-0.5">
							{primaryLinks.map((link) => {
								const Icon = link.icon;
								const isActive = isCurrentPath(pathname, link.href);
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
												className={`relative inline-flex h-9 items-center gap-1.5 rounded-sm px-2.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
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
														transition={{
															type: "spring",
															stiffness: 260,
															damping: 24,
														}}
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
					<div className="flex shrink-0 items-center gap-1 sm:gap-2">
						<m.a
							href="https://github.com/oma-ai"
							target="_blank"
							rel="noopener noreferrer"
							aria-label="GitHub repository (opens in new tab)"
							whileHover={prefersReduced ? undefined : { y: -1 }}
							whileTap={prefersReduced ? undefined : { scale: 0.94 }}
							transition={EASE_SPRING}
							className="hidden md:inline-flex h-9 w-9 items-center justify-center rounded-sm text-text-tertiary transition-colors hover:bg-surface hover:text-text-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
						>
							<Github className="h-4 w-4" />
						</m.a>

						<ThemeToggle />

						<m.div
							whileHover={prefersReduced ? undefined : { y: -1 }}
							whileTap={prefersReduced ? undefined : { scale: 0.94 }}
							transition={EASE_SPRING}
							className="inline-block"
						>
							<Link
								href="/settings"
								aria-label="Settings"
								className="inline-flex h-9 w-9 items-center justify-center rounded-sm text-text-tertiary transition-colors hover:bg-surface hover:text-text-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
							>
								<Settings className="h-4 w-4" aria-hidden="true" />
							</Link>
						</m.div>

						<div className="hidden xl:flex items-center">
							<ApiStatus />
						</div>

						{isConnected ? (
							<NavbarUserMenu
								evmAddress={evmAddress}
								authMethod={authMethod}
								accountNumber={accountNumber ?? null}
								onDisconnect={disconnect}
							/>
						) : (
							<Magnetic strength={6}>
								<Web3ConnectButton />
							</Magnetic>
						)}

						{/* Mobile toggle */}
						<button
							ref={mobileToggleRef}
							type="button"
							onClick={() => setMobileOpen(!mobileOpen)}
							className="inline-flex h-10 w-10 items-center justify-center rounded-sm text-text-secondary transition-colors hover:bg-surface hover:text-text-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent md:hidden"
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

				{/* Mobile menu — extracted component */}
				<NavbarMobileMenu
					open={mobileOpen}
					onOpenChange={setMobileOpen}
					toggleRef={mobileToggleRef}
					isConnected={isConnected}
					section={section}
					build={build}
					onDisconnect={disconnect}
				/>
			</nav>
		</header>
	);
}
