/** Gateway readiness for account flows, including its database and cache. */

import { request } from "./client.js";

export const health = {
	ping(): Promise<boolean> {
		return request<{ status: string } | null>("/ready", {
			cache: "no-store",
			signal: AbortSignal.timeout(5_000),
		})
			.then((body) => body?.status === "ready")
			.catch(() => false);
	},
};
