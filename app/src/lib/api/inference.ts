/**
 * Health namespace: server health probe.
 */

import { request } from "./client.js";
import type { HealthResponse } from "./types.js";

export const health = {
	get() {
		return request<HealthResponse>("/health");
	},
};
