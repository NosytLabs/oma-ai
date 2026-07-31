import {
	Activity,
	Box,
	FileText,
	GitCompare,
	type LucideIcon,
	Network,
	Newspaper,
	ShieldCheck,
	Tag,
	Terminal,
} from "lucide-react";

export interface NavItem {
	href: string;
	label: string;
	icon: LucideIcon;
	desc?: string;
	/** When true, only admins see this link. */
	adminOnly?: boolean;
}

export interface NavGroup {
	title: string;
	caption: string;
	links: NavItem[];
}

/** Primary nav — visible at all times on desktop, used in the mobile menu. */
export const primaryLinks: NavItem[] = [
	{ href: "/models", label: "Models", icon: Box, desc: "Browse the catalog" },
	{
		href: "/chat",
		label: "Playground",
		icon: Terminal,
		desc: "Chat · image · video",
	},
	{ href: "/pricing", label: "Pricing", icon: Tag, desc: "Transparent cost" },
	{ href: "/docs", label: "Docs", icon: FileText, desc: "API reference" },
	{
		href: "/compare",
		label: "Compare",
		icon: GitCompare,
		desc: "vs Portkey, LiteLLM, OpenRouter",
	},
];

/** Tools dropdown — secondary, off the primary path. */
export const toolsLinks: NavItem[] = [
	{
		href: "/network",
		label: "Network",
		icon: Network,
		desc: "Programmable primitives",
	},
	{
		href: "/observability",
		label: "Observability",
		icon: Activity,
		desc: "Live system metrics",
	},
	{
		href: "/changelog",
		label: "Changelog",
		icon: Newspaper,
		desc: "Release notes",
	},
	{
		href: "/admin",
		label: "Admin",
		icon: ShieldCheck,
		desc: "Operator dashboard",
		adminOnly: true,
	},
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
/** Mobile account card — only true account surfaces (not docs). */
export const accountHrefs = [
	"/dashboard",
	"/deposit",
	"/settings",
	"/login",
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
