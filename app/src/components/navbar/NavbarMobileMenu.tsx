"use client";

import { LogIn, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type RefObject, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useFocusTrap } from "@/lib/hooks/useFocusTrap";
import { accountLinks, isCurrentNavLink, mobileGroups } from "./_lib/nav-links";
import { NavbarSignOut } from "./NavbarSignOut";

interface NavbarMobileMenuProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	toggleRef: RefObject<HTMLButtonElement | null>;
	isConnected: boolean;
	loginHref: string;
	onDisconnect?: () => void | Promise<void>;
}

export function NavbarMobileMenu({ open, onOpenChange, toggleRef, isConnected, loginHref, onDisconnect }: NavbarMobileMenuProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const pathname = usePathname() ?? "/";
	const [mounted, setMounted] = useState(false);
	const groups = [...mobileGroups, {
		title: "Account",
		links: isConnected
			? accountLinks.filter((link) => !mobileGroups.some((group) => group.links.some((item) => item.href === link.href)))
			: [{ href: loginHref, label: "Sign in", icon: LogIn }],
	}];

	useFocusTrap({ active: open && mounted, containerRef, restoreFocusRef: toggleRef, onClose: () => onOpenChange(false) });

	useEffect(() => {
		if (!open) return;
		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => { document.body.style.overflow = previousOverflow; };
	}, [open]);

	useEffect(() => { setMounted(true); }, []);

	if (!mounted || !open) return null;
	return createPortal(
		<>
			<div className="motion-fade-in fixed inset-0 z-[60] bg-void/70 backdrop-blur-sm lg:hidden" aria-hidden="true" onClick={() => onOpenChange(false)} />
			<div ref={containerRef} id="mobile-menu" role="dialog" aria-modal="true" aria-labelledby="mobile-menu-title"
				className="motion-slide-in-right fixed inset-y-0 right-0 z-[70] w-full max-w-sm overflow-y-auto overscroll-contain border-l border-border bg-void px-5 pb-8 pt-4 font-mono shadow-2xl lg:hidden">
				<div className="mb-5 flex items-center justify-between">
					<h2 id="mobile-menu-title" className="font-mono text-sm font-medium text-text-bright">Navigation</h2>
					<button type="button" onClick={() => onOpenChange(false)} aria-label="Close navigation menu" className="inline-flex h-11 w-11 items-center justify-center rounded-sm text-text-secondary hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"><X className="h-5 w-5" aria-hidden="true" /></button>
				</div>
				<nav aria-label="Mobile navigation" className="space-y-5">
					{groups.map((group) => <div key={group.title}>
						<h3 className="mb-2 px-3 font-mono text-[11px] font-medium uppercase tracking-wider text-text-muted">{group.title}</h3>
						<ul className="space-y-1">
							{group.links.map((link) => {
								const Icon = link.icon;
								const active = isCurrentNavLink(pathname, link.href);
								return <li key={link.href}><Link href={link.href} prefetch={false} onClick={() => onOpenChange(false)} aria-current={active ? "page" : undefined}
									className={`flex min-h-11 items-center gap-3 rounded-sm px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${active ? "bg-accent-dim text-accent" : "text-text-secondary hover:bg-surface hover:text-text-bright"}`}>
									<Icon className="h-4 w-4 shrink-0" aria-hidden="true" /><span>{link.label}</span>
								</Link></li>;
							})}
						</ul>
					</div>)}
				</nav>
				{isConnected && onDisconnect && <div className="mt-4 border-t border-border pt-2"><NavbarSignOut onSignOut={onDisconnect} onComplete={() => onOpenChange(false)} /></div>}
			</div>
		</>, document.body,
	);
}
