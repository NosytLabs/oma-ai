/**
 * Canonical public origin for metadata, sitemaps, robots and structured data.
 * Keep this in one place so deploy-time environment differences cannot make
 * crawlers see competing hosts.
 */
const SITE_URL =
	(process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/+$/, "") ||
	"https://www.oma-ai.com";

/**
 * Canonical public API base URLs.
 *
 * `/api/v1` is the OpenAI-compatible base that SDKs and copy-paste curl
 * snippets use. `/api` is the base for clients that append their own version
 * path (the Anthropic-compatible `/api/v1/messages` endpoint, the OpenAPI
 * document). Both derive from the same origin as the site so a preview or
 * staging deploy can never advertise the production host in its own docs.
 */
export const API_BASE = `${SITE_URL}/api`;
export const API_V1_BASE = `${API_BASE}/v1`;

export default SITE_URL;
