"use client";

import { ChevronDown, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { formatAddress } from "@/lib/utils";
import { useNavDisclosure } from "./_hooks/useNavDisclosure";
import { accountLinks, isCurrentNavLink } from "./_lib/nav-links";
import { NavbarSignOut } from "./NavbarSignOut";

interface NavbarUserMenuProps {
	evmAddress: string | null;
	email?: string | null;
	onSignOut: () => Promise<void>;
}

export function NavbarUserMenu({ evmAddress, email, onSignOut }: NavbarUserMenuProps) {
	const [open, setOpen] = useState(false);
	const pathname = usePathname() ?? "/";
	const { containerRef, toggleRef, panelRef, onKeyDown, onBlur } = useNavDisclosure(open, setOpen);
	const identity = evmAddress ? formatAddress(evmAddress) : email ?? "Account";

	useEffect(() => { setOpen(false); }, [pathname]);

	return (
		<div ref={containerRef} onKeyDown={onKeyDown} onBlur={onBlur} className="relative">
			<button ref={toggleRef} type="button" onClick={() => setOpen(!open)} aria-label="Account menu" aria-expanded={open} aria-controls="user-menu"
				className={`inline-flex h-11 items-center gap-2 rounded-sm border px-3 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${open ? "border-accent/60 bg-surface text-accent" : "border-border text-text-secondary hover:bg-surface hover:text-text-bright"}`}>
				<UserRound className="h-4 w-4" aria-hidden="true" />
				<span className="hidden max-w-28 truncate sm:inline">{identity}</span>
				<ChevronDown className={`hidden h-3 w-3 transition-transform sm:block ${open ? "rotate-180" : ""}`} aria-hidden="true" />
			</button>
			{open && (
				<div ref={panelRef} id="user-menu" className="absolute right-0 z-[60] mt-2 w-64 max-w-[calc(100vw-2rem)] rounded-md border border-border bg-void p-2 shadow-xl shadow-overlay">
					<div className="mb-1 border-b border-border px-3 pb-3 pt-2">
						<p className="text-[11px] text-text-muted">Signed in as</p>
						<p className="mt-1 truncate text-xs text-text-bright" title={evmAddress ?? email ?? undefined}>{evmAddress ?? email ?? "OMA account"}</p>
					</div>
					<ul>
						{accountLinks.map((link) => {
							const Icon = link.icon;
							const active = isCurrentNavLink(pathname, link.href);
							return <li key={link.href}><Link href={link.href} onClick={() => setOpen(false)} aria-current={active ? "page" : undefined}
								className={`flex min-h-11 items-center gap-3 rounded-sm px-3 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${active ? "bg-accent-dim text-accent" : "text-text-secondary hover:bg-surface hover:text-text-bright"}`}>
								<Icon className="h-4 w-4" aria-hidden="true" />{link.label}
							</Link></li>;
						})}
					</ul>
					<div className="mt-1 border-t border-border pt-1"><NavbarSignOut onSignOut={onSignOut} onComplete={() => setOpen(false)} /></div>
				</div>
			)}
		</div>
	);
}
