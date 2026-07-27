/**
 * Polar.sh subscription billing — frontend namespace.
 *
 * Mirrors the server route at `server/src/routes/polar.ts`. When Polar isn't
 * configured server-side, every endpoint returns 503 `polar_not_configured`
 * — surface that gracefully in the UI (settings + dashboard) so users see
 * "Subscriptions are unavailable on this deployment" instead of a generic
 * 500.
 */
import { request } from "./client.js";

export interface PolarPlan {
	id: string;
	name: string;
	description: string;
	priceCents: number;
	currency: "USD";
	interval: "month";
	features: string[];
	available: boolean;
}

export interface PolarPlansResponse {
	plans: PolarPlan[];
}

export interface PolarSubscription {
	id: string;
	polarSubscriptionId: string;
	polarProductId: string;
	status: string;
	currentPeriodStart: string | null;
	currentPeriodEnd: string | null;
	cancelAtPeriodEnd: number;
	planId: string | null;
	planName: string | null;
}

export interface PolarSubscriptionResponse {
	subscription: PolarSubscription | null;
}

export interface PolarOrder {
	id: string;
	polarOrderId: string;
	polarProductId: string;
	amount: number;
	currency: string;
	status: string;
	createdAt: string;
}

export interface PolarOrdersResponse {
	orders: PolarOrder[];
}

/**
 * Detect the 503 "polar_not_configured" envelope so callers can degrade
 * gracefully. The server returns
 * `{ error: { type: "polar_not_configured" }, status: 503 }` — we surface
 * it as a boolean on the typed response so consumers don't need to peek
 * at the error type field.
 */
export class PolarNotConfiguredError extends Error {
	constructor(message = "Polar.sh subscriptions are not configured on this server") {
		super(message);
		this.name = "PolarNotConfiguredError";
	}
}

export const polar = {
	/** Fetch the curated plans list. Throws PolarNotConfiguredError on 503. */
	plans() {
		return request<PolarPlansResponse>("/v1/polar/plans").catch((err: unknown) => {
			if (err instanceof Error && err.message.includes("polar_not_configured")) {
				throw new PolarNotConfiguredError();
			}
			throw err;
		});
	},

	/**
	 * Open a Polar checkout session. Returns the redirect URL.
	 * Caller is responsible for `window.location.href = url`.
	 */
	checkout(planId: string) {
		return request<{ url: string; id: string }>("/v1/polar/checkout", {
			method: "POST",
			body: JSON.stringify({ planId }),
		});
	},

	subscription() {
		return request<PolarSubscriptionResponse>("/v1/polar/subscription");
	},

	orders(limit = 20) {
		return request<PolarOrdersResponse>(
			`/v1/polar/orders?limit=${Math.min(Math.max(limit, 1), 100)}`,
		);
	},

	/**
	 * Returns a URL the user can be redirected to in order to manage their
	 * subscription / payment method via Polar's hosted portal.
	 */
	portal() {
		return request<{ url: string }>("/v1/polar/portal", { method: "POST" });
	},
};