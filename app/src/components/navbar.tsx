"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { getActiveChatSignInModel, saveChatDraftForSignIn, subscribeChatSignInModel } from "@/lib/chat-signin-draft";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { OmaNavLockup } from "@/components/ui/oma-logo";
import { useAuth } from "@/lib/hooks/useAuth";
import { isCurrentNavLink, primaryLinks } from "./navbar/_lib/nav-links";
import { NavbarMobileMenu } from "./navbar/NavbarMobileMenu";
import { NavbarToolsDropdown } from "./navbar/NavbarToolsDropdown";
import { NavbarUserMenu } from "./navbar/NavbarUserMenu";
import { ThemeToggle } from "./ThemeToggle";

export function Navbar() {
	const { isAuthenticated, isDemo, evmAddress, signOut, isPending, user } = useAuth();
	const [mobileOpen, setMobileOpen] = useState(false);
	const [toolsOpen, setToolsOpen] = useState(false);
	const mobileToggleRef = useRef<HTMLButtonElement>(null);
	const pathname = usePathname() ?? "/";
	const loginHref = `/login?next=${encodeURIComponent(pathname)}`;
	const isConnected = isAuthenticated && !isDemo;

	useEffect(() => {
		setMobileOpen(false);
		setToolsOpen(false);
	}, [pathname, search]);

	useEffect(() => {
		const media = window.matchMedia("(min-width: 1024px)");
		const closeOnResize = () => {
			setMobileOpen(false);
			setToolsOpen(false);
		};
		media.addEventListener("change", closeOnResize);
		return () => media.removeEventListener("change", closeOnResize);
	}, []);

	return (
		<header className="sticky top-0 z-50 border-b border-border bg-void/95 font-mono backdrop-blur-md">
			<nav aria-label="Main navigation" className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
				<div className="flex min-w-0 items-center gap-4 lg:gap-6">
					<Link href="/" aria-label="OMA home" className="inline-flex min-h-11 shrink-0 items-center rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
						<OmaNavLockup size="sm" />
					</Link>
					<div className="hidden items-center gap-1 lg:flex">
						<ul className="flex items-center gap-1">
							{primaryLinks.map((link) => {
								const isActive = isCurrentNavLink(pathname, link.href);
								return (
									<li key={link.href}>
										<Link href={link.href} prefetch={link.href === "/models" ? undefined : false} aria-current={isActive ? "page" : undefined}
											className={`inline-flex h-11 items-center rounded-sm px-3 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${isActive ? "bg-accent-dim text-accent" : "text-text-secondary hover:bg-surface hover:text-text-bright"}`}>
											{link.label}
										</Link>
									</li>
								);
							})}
						</ul>
						<NavbarToolsDropdown open={toolsOpen} onOpenChange={setToolsOpen} />
					</div>
				</div>
				<div className="flex shrink-0 items-center gap-1 sm:gap-2">
					<ThemeToggle />
					{isPending ? (
						<div className="h-10 w-20 animate-pulse rounded-sm border border-border bg-surface" aria-label="Loading account" role="status" />
					) : isConnected ? (
						<NavbarUserMenu evmAddress={evmAddress} email={user?.email ?? null} onSignOut={() => signOut({ callbackURL: "/" })} />
					) : (
						<Link href={loginHref} aria-label="Sign in or create an account" className="btn-mono btn-primary inline-flex px-3 text-xs sm:px-4">Sign in</Link>
					)}
					<button ref={mobileToggleRef} type="button" onClick={() => setMobileOpen(!mobileOpen)}
						className="inline-flex h-11 w-11 items-center justify-center rounded-sm text-text-secondary transition-colors hover:bg-surface hover:text-text-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent lg:hidden"
						aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"} aria-expanded={mobileOpen} aria-controls="mobile-menu">
						{mobileOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
					</button>
				</div>
				<NavbarMobileMenu open={mobileOpen} onOpenChange={setMobileOpen} toggleRef={mobileToggleRef} isConnected={isConnected} loginHref={loginHref} onDisconnect={() => signOut({ callbackURL: "/" })} />
			</nav>
		</header>
	);
}
