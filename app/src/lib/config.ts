/**
 * Centralized frontend configuration constants.
 *
 * Runs in Node.js server components, route handlers, and edge middleware.
 */

/** Default backend API base URL. Strips trailing slashes. */
const rawApi = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export const DEFAULT_API_URL = (rawApi || "http://localhost:3001").replace(
	/\/+$/,
	"",
);
