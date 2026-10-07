import {
	BookOpen,
	Bot,
	Box,
	CircleHelp,
	Coins,
	FileText,
	type LucideIcon,
	Network,
	KeyRound,
	LayoutDashboard,
	Settings,
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
		desc: "USDC on Base · card when available",
	},
	{
		href: "/docs#endpoints",
		label: "API reference",
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
		title: "Explore",
		links: primaryLinks,
	},
	{
		title: "tools",
		caption: "fund · integrate · learn",
		links: toolsLinks,
	},
];

/** Account destinations shared by desktop, mobile, and the footer. */
export const accountLinks: NavItem[] = [
	{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
	{ href: "/dashboard?tab=api-keys", label: "API keys", icon: KeyRound },
	{ href: "/deposit", label: "Buy credits", icon: Coins },
	{ href: "/settings", label: "Settings", icon: Settings },
];

/** A pathname cannot identify a specific fragment or query tab. */
export function isCurrentNavLink(pathname: string, href: string): boolean {
	return !/[?#]/.test(href) && isCurrentPath(pathname, href);
}

export function isCurrentPath(pathname: string, href: string): boolean {
	const currentPath = pathname.split(/[?#]/, 1)[0] || "/";
	const routePath = href.split(/[?#]/, 1)[0] || "/";
	return currentPath === routePath || currentPath.startsWith(`${routePath}/`);
}
