import type { Context } from "hono";
import { config } from "../config.js";
import { proxyIsAuthenticated } from "../middleware/rate-limit/utils.js";
import type { OmaEnv } from "../types.js";

export const WEBSITE_CHAT_PATH = "/website/chat/completions";

/** Website sponsorship is never selected by headers on the public SDK route. */
export function isWebsiteChatRequest(c: Context<OmaEnv>): boolean {
	if (c.req.path !== WEBSITE_CHAT_PATH || c.req.header("X-OMA-Source") !== "website") return false;
	let origin: string;
	try { origin = new URL(c.req.header("Origin") || "").origin; }
	catch { return false; }
	const allowed = [config.PUBLIC_APP_URL];
	if (config.NODE_ENV !== "production") allowed.push("http://localhost:3000", "http://127.0.0.1:3000");
	if (!allowed.some(value => { try { return new URL(value).origin === origin; } catch { return false; } })) return false;
	if (proxyIsAuthenticated(c.req)) return true;
	// Secretless local development stays usable; deployed backends fail closed.
	return config.NODE_ENV !== "production" && !config.INTERNAL_PROXY_SECRET &&
		["localhost", "127.0.0.1", "[::1]"].includes(new URL(c.req.url).hostname);
}
