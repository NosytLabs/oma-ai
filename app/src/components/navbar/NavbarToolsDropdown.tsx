"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useNavDisclosure } from "./_hooks/useNavDisclosure";
import { isCurrentNavLink, primaryLinks, toolsLinks } from "./_lib/nav-links";

interface NavbarToolsDropdownProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function NavbarToolsDropdown({ open, onOpenChange }: NavbarToolsDropdownProps) {
	const pathname = usePathname() ?? "/";
	const { containerRef, toggleRef, panelRef, onKeyDown, onBlur } = useNavDisclosure(open, onOpenChange);
	const isToolsActive = !primaryLinks.some((link) => isCurrentNavLink(pathname, link.href)) &&
		toolsLinks.some((link) => isCurrentNavLink(pathname, link.href));

	return (
		<div ref={containerRef} onKeyDown={onKeyDown} onBlur={onBlur} className="relative hidden lg:block">
			<button
				ref={toggleRef}
				type="button"
				onClick={() => onOpenChange(!open)}
				aria-expanded={open}
				aria-controls="tools-menu"
				aria-label="Tools menu"
				className={`inline-flex h-11 items-center gap-1.5 rounded-sm px-3 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
					isToolsActive || open ? "bg-accent-dim text-accent" : "text-text-secondary hover:bg-surface hover:text-text-bright"
				}`}
			>
				Tools
				<ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
			</button>
			{open && (
				<div ref={panelRef} id="tools-menu" className="absolute left-0 top-full z-[60] mt-2 w-72 rounded-md border border-border bg-void p-2 shadow-xl shadow-overlay">
					<ul className="space-y-1">
						{toolsLinks.map((link) => {
							const Icon = link.icon;
							const isActive = isCurrentNavLink(pathname, link.href);
							return (
								<li key={link.href}>
									<Link href={link.href} prefetch={false} onClick={() => onOpenChange(false)} aria-current={isActive ? "page" : undefined}
										className={`flex min-h-11 items-start gap-3 rounded-sm px-3 py-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${isActive ? "bg-accent-dim text-accent" : "text-text-secondary hover:bg-surface hover:text-text-bright"}`}>
										<Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
										<span>
											<span className="block text-xs">{link.label}</span>
											<span className="mt-1 block text-[11px] leading-relaxed text-text-muted">{link.desc}</span>
										</span>
									</Link>
								</li>
							);
						})}
					</ul>
				</div>
			)}
		</div>
	);
}
