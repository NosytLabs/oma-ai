import {
	BookOpen,
	Bot,
	Box,
	CircleHelp,
	Coins,
	FileText,
	type LucideIcon,
	Network,
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
	{ href: "/models", label: "Models", icon: Box, desc: "Browse the catalog" },
	{
		href: "/chat",
		label: "Chat",
		icon: Terminal,
		desc: "Multimodal LLM playground",
	},
	{ href: "/pricing", label: "Pricing", icon: Tag, desc: "Transparent cost" },
	{ href: "/docs", label: "Docs", icon: FileText, desc: "API reference" },
];

/** Tools dropdown — secondary, off the primary path. */
export const toolsLinks: NavItem[] = [
	{
		href: "/deposit",
		label: "Buy credits",
		icon: Coins,
		desc: "USDC on Base · card when enabled",
	},
	{
		href: "/docs#endpoints",
		label: "API Reference",
		icon: Network,
		desc: "Every endpoint, live",
	},
	{
		href: "/docs#integrations",
		label: "Agents & IDEs",
		icon: Bot,
		desc: "OpenCode · Claude Code · Cursor",
	},
	{
		href: "/getting-started",
		label: "Get started",
		icon: BookOpen,
		desc: "5-minute walkthrough",
	},
	{
		href: "/faq",
		label: "FAQ",
		icon: CircleHelp,
		desc: "Common questions",
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
		caption: "compare · learn · ops",
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
	"/admin",
	"/login",
] as const;

export function isCurrentPath(pathname: string, href: string): boolean {
	const currentPath = pathname.split(/[?#]/, 1)[0] || "/";
	const routePath = href.split(/[?#]/, 1)[0] || "/";
	return currentPath === routePath || currentPath.startsWith(`${routePath}/`);
}

export function sectionLabelFor(pathname: string): string {
	if (pathname === "/" || pathname === "") return "home";
	const matched = primaryLinks.find((link) =>
		isCurrentPath(pathname, link.href),
	);
	if (matched) return matched.label;
	const toolsMatched = toolsLinks.find((link) =>
		isCurrentPath(pathname, link.href),
	);
	if (toolsMatched) return toolsMatched.label;
	const segment = pathname.split("/").filter(Boolean)[0];
	return segment ?? "home";
}
