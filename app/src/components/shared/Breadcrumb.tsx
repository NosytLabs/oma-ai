"use client";

import { ChevronRight, Home } from "lucide-react";
import Link from "next/link";
import { cn } from "@/components/ui/utils";

interface BreadcrumbItem {
	label: string;
	href?: string;
}

interface BreadcrumbProps {
	items: BreadcrumbItem[];
	className?: string;
}

/**
	* Breadcrumb — navigation breadcrumb for deep routes.
	* Renders a chain of links; the last item is non-linked (current page).
	*/
export function Breadcrumb({ items, className }: BreadcrumbProps) {
	return (
		<nav
			aria-label="Breadcrumb"
			className={cn(
				"flex items-center gap-1.5 text-sm font-mono text-text-muted mb-6",
				className,
			)}
		>
			<Link
				href="/"
				className="inline-flex h-6 w-6 items-center justify-center -m-1 hover:text-[var(--color-accent)] transition-colors duration-200 ease-out"
				aria-label="Home"
			>
				<Home className="h-3.5 w-3.5" />
			</Link>
			{items.map((item, i) => (
				<span key={item.href ?? item.label} className="flex items-center gap-1.5">
					<ChevronRight className="h-3 w-3 text-text-muted/50" aria-hidden="true" />
					{i < items.length - 1 && item.href ? (
						<Link
							href={item.href}
							className="inline-flex min-h-6 items-center -my-1 hover:text-[var(--color-accent)] transition-colors duration-200 ease-out"
						>
							{item.label}
						</Link>
					) : (
						<span className="text-text-secondary">{item.label}</span>
					)}
				</span>
			))}
		</nav>
	);
}
