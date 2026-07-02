import {
	ArrowLeftRight,
	Box,
	FileText,
	Info,
	type LucideIcon,
	Tag,
	Terminal,
} from "lucide-react";

export interface NavItem {
	href: string;
	label: string;
	icon: LucideIcon;
	desc?: string;
}

export interface NavGroup {
	title: string;
	caption: string;
	links: NavItem[];
}

/** Primary nav — visible at all times on desktop, used in the mobile menu. */
export const primaryLinks: NavItem[] = [
	{ href: "/models", label: "models", icon: Box, desc: "browse models" },
	{ href: "/chat", label: "chat", icon: Terminal, desc: "try it live" },
	{ href: "/pricing", label: "pricing", icon: Tag, desc: "transparent cost" },
	{ href: "/docs", label: "docs", icon: FileText, desc: "api reference" },
];

/** Tools dropdown — secondary, off the primary path. */
export const toolsLinks: NavItem[] = [
	{
		href: "/swap",
		label: "swap",
		icon: ArrowLeftRight,
		desc: "token exchange",
	},
	{ href: "/about", label: "about", icon: Info, desc: "who we are" },
];

/** Group definitions for the mobile menu cards. */
export const mobileGroups: NavGroup[] = [
	{
		title: "product",
		caption: "core surfaces",
		links: primaryLinks,
	},
	{
		title: "tools",
		caption: "modality + utility",
		links: toolsLinks,
	},
];

/** Mobile-menu "account" card links. Treated as active when the current
 *  pathname is any of these (used to highlight the card outline). */
export const accountHrefs = [
	"/dashboard",
	"/deposit",
	"/settings",
	"/docs",
] as const;

export function isCurrentPath(pathname: string, href: string): boolean {
	return pathname === href || pathname.startsWith(`${href}/`);
}

export function sectionLabelFor(pathname: string): string {
	if (pathname === "/" || pathname === "") return "home";
	const matched = [...primaryLinks, ...toolsLinks].find((link) =>
		isCurrentPath(pathname, link.href),
	);
	if (matched) return matched.label.replace(/^\//, "").split("/")[0] ?? "home";
	// Fallback: extract the first path segment (e.g. '/faq' → 'faq')
	const segment = pathname.split("/").filter(Boolean)[0];
	return segment ?? "home";
}
