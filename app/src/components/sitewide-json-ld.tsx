"use client";

import { usePathname } from "next/navigation";
import {
	OrganizationJsonLd,
	SoftwareApplicationJsonLd,
	WebSiteJsonLd,
} from "./json-ld";

// App/auth surfaces are noindex and robots-disallowed (see robots.ts and the
// route layouts' robots metadata). Emitting the sitewide marketing entities
// there puts rich structured data on pages blocked from indexing
// (crawl/schema-noindex-conflict), so the sitewide schema renders only on
// public routes. Client component because the root layout is shared by every
// route and only the client knows the pathname without forcing every page
// dynamic; usePathname resolves during SSR, so crawlers still see the
// scripts in the served HTML of public pages.
const APP_ROUTE_PREFIXES = [
	"/dashboard",
	"/deposit",
	"/login",
	"/settings",
	"/status",
];

export function SitewideJsonLd() {
	const pathname = usePathname() ?? "/";
	const isAppRoute = APP_ROUTE_PREFIXES.some(
		(prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
	);
	if (isAppRoute) return null;
	return (
		<>
			<OrganizationJsonLd />
			<WebSiteJsonLd />
			<SoftwareApplicationJsonLd />
		</>
	);
}
