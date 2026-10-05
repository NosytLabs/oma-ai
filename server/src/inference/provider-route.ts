/**
 * Provider resolution — maps model provider labels to upstream API routes.
 *
 * Two primary routes the user-facing router selects between:
 *   - "venice"   — direct Venice AI (api.venice.ai)
 *   - "oma-ai"   — OpenBroker (api.openbroker.gonka.gg)
 *
 * Plus one *hidden procurement fallback*:
 *   - "surplus"  — Surplus Intelligence marketplace
 *                  (api.surplusintelligence.ai). Never user-visible.
 *                  Only invoked by the proxy when the primary upstream
 *                  fails AND the model has a surplusId configured AND
 *                  SURPLUS_API_KEY is set. The customer-facing
 *                  providerLabel stays the same ("venice" or "oma-ai")
 *                  so Surplus procurement is invisible.
 *
 * (Zyloo was previously a sister upstream of "oma-ai"; removed 2026-08-17.)
 */
import { config } from "../config.js";
import type { ModelDef } from "./models.js";

/** Provider-specific request envelope. All backends are OpenAI-compatible. */
export interface ProviderRoute {
	baseUrl: string;
	apiKey: string;
	/**
	 * Translate OMA model id → upstream model id.
	 * @param omaModelId — the model.id from the catalog (fallback)
	 * @param omaAiId    — the OMA-AI upstream id (OpenBroker)
	 * @param surplusId  — the Surplus marketplace id
	 */
	upstreamModel: (omaModelId: string, omaAiId?: string, surplusId?: string) => string;
	/** Strip provider-only fields the upstream doesn't accept. */
	extraBody: (body: Record<string, unknown>) => Record<string, unknown>;
	/**
	 * User-facing provider label. Surplus returns the SAME label as the
	 * primary route it's procuring for ("venice" or "oma-ai") — Surplus
	 * is never surfaced to users.
	 */
	providerLabel: "venice" | "oma-ai";
	/**
	 * Internal-only routing tag. Lets the proxy + audit log distinguish
	 * "this request was served by Surplus under the venice label" from
	 * "this request was served by Venice directly". Surfaced in
	 * x-oma-routed-via header but never in the user-facing provider
	 * field.
	 */
	routedVia: "venice" | "oma-ai" | "surplus";
}

export class ProviderError extends Error {
	constructor(
		message: string,
		readonly status: number,
	) {
		super(message);
		this.name = "ProviderError";
	}
}

export function resolveProvider(provider: string, _modelDef?: ModelDef): ProviderRoute {
	if (provider === "oma-ai") {
		// "oma-ai" is backed exclusively by OpenBroker after the Zyloo removal.
		// Every catalog entry must declare upstream: "openbroker" (or be
		// rejected by the catalog loader); we don't branch on it here.
		if (!config.OPENBROKER_API_KEY) {
			throw new ProviderError(
				"OpenBroker API key not configured (set OPENBROKER_API_KEY in the server env).",
				503,
			);
		}
		return {
			baseUrl: `${config.OPENBROKER_API_URL}/v1`,
			apiKey: config.OPENBROKER_API_KEY,
			upstreamModel: (id, gid) => gid ?? id,
			// `models` is an OpenRouter-style failover hint consumed by OUR
			// fallback chain (buildFallbackChain) — never an upstream param.
			// The Gonka network rejects non-standard params with a hard error
			// ("currently rejected by the Gonka network"), which surfaced as
			// an empty stream to website-chat guests. Strip it here.
			extraBody: ({ models: _clientFailoverHint, ...body }) => body,
			providerLabel: "oma-ai",
			routedVia: "oma-ai",
		};
	}
	// default: venice
	if (!config.VENICE_API_KEY) {
		throw new ProviderError(
			"Inference provider not configured (VENICE_API_KEY missing).",
			503,
		);
	}
	return {
		baseUrl: `${config.VENICE_API_URL}/api/v1`,
		apiKey: config.VENICE_API_KEY,
		// Send the catalog's `veniceId` when it declares one, else the public
		// id. A few entries keep a stable public id that differs from their
		// Venice id (e.g. public `mistral-small-2603` -> Venice
		// `mistral-small-3-2-24b-instruct`); without this the public id went
		// upstream verbatim and 404'd.
		upstreamModel: (id) => _modelDef?.veniceId ?? id,
		extraBody: (body) => ({
			...body,
			// Venice privacy: force private mode unless the operator explicitly
			// enabled non-private opt-out. Other providers ignore this field.
			venice_parameters: {
				private: !config.OMMA_ALLOW_NON_PRIVATE_VENICE,
			},
		}),
		providerLabel: "venice",
		routedVia: "venice",
	};
}
