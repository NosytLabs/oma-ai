/**
 * Canonical public origin for metadata, sitemaps, robots and structured data.
 * Keep this in one place so deploy-time environment differences cannot make
 * crawlers see competing hosts.
 */
const SITE_URL =
	process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ||
	"https://www.oma-ai.com";

export default SITE_URL;
