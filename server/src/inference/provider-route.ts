/**
	* Provider resolution — maps model provider labels to upstream API routes.
	*
	* Three primary routes the user-facing router selects between:
	*   - "venice"   — direct Venice AI (api.venice.ai)
	*   - "oma-ai"   — Zyloo (api.zyloo.io) or OpenBroker (api.openbroker.gonka.gg)
	*
	* Plus one *hidden procurement fallback*:
	*   - "surplus"  — Surplus Intelligence marketplace
	*                  (api.surplusintelligence.ai). Never user-visible.
	*                  Only invoked by the proxy when the primary upstream
	*                  fails AND the model has a surplusId configured AND
	*                  SURPLUS_API_KEY is set. The customer-facing
	*                  providerLabel stays the same ("venice" or "oma-ai")
	*                  so Surplus procurement is invisible.
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
			* @param omaAiId    — the OMA-AI upstream id (Zyloo/OpenBroker)
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
		providerLabel: "venice" | "oma-ai" | "litellm";
		/**
			* Internal-only routing tag. Lets the proxy + audit log distinguish
			* "this request was served by Surplus under the venice label" from
			* "this request was served by Venice directly". Surfaced in
			* x-oma-routed-via header but never in the user-facing provider
			* field.
			*/
		routedVia: "venice" | "oma-ai" | "surplus" | "litellm";
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

/**
	* Build a Surplus fallback route for a Venice- or OMA-AI-branded model.
	* The label stays as the user's chosen provider (so the customer never
	* sees "surplus"). Throws if SURPLUS_API_KEY isn't set.
	*/
export function buildSurplusFallbackRoute(modelDef: ModelDef): ProviderRoute {
		if (!config.SURPLUS_API_KEY) {
				throw new ProviderError(
						"Surplus Intelligence fallback requested but SURPLUS_API_KEY is not configured.",
						503,
				);
		}
		if (!modelDef.surplusId) {
				throw new ProviderError(
						`Model ${modelDef.id} has no surplusId configured for Surplus procurement.`,
						503,
				);
		}
		// Inherit the user-facing label from the model's primary provider.
		const userLabel: "venice" | "oma-ai" =
				modelDef.provider === "venice" ? "venice" : "oma-ai";
		return {
				baseUrl: `${config.SURPLUS_API_URL}/v1`,
				apiKey: config.SURPLUS_API_KEY,
				upstreamModel: (_id, _gid, sid) => sid ?? _id,
				extraBody: (body) => body,
				providerLabel: userLabel,
				routedVia: "surplus",
		};
}

export function resolveProvider(provider: string, modelDef?: ModelDef): ProviderRoute {
		
		if (provider === "litellm") {
				if (!config.LITELLM_API_KEY) {
						throw new ProviderError(
								"LiteLLM API key not configured (set LITELLM_API_KEY in the server env).",
								503,
						);
				}
				return {
						baseUrl: config.LITELLM_API_URL,
						apiKey: config.LITELLM_API_KEY,
						upstreamModel: (id) => id,
						extraBody: (body) => body,
						providerLabel: "litellm",
						routedVia: "litellm",
				};
		}
		if (provider === "oma-ai") {
				// Two resale upstreams, both branded "oma-ai" to users:
				//   zyloo      → api.zyloo.io        (gemini-*, gpt-*)
				//   openbroker → api.openbroker.gonka.gg (DeepSeek, Kimi, Qwen)
				if (modelDef?.upstream === "openbroker") {
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
								extraBody: (body) => body,
								providerLabel: "oma-ai",
								routedVia: "oma-ai",
						};
				}
				if (!config.ZYLOO_API_KEY) {
						throw new ProviderError(
								"Zyloo API key not configured (set ZYLOO_API_KEY in the server env).",
								503,
						);
				}
				return {
						baseUrl: `${config.ZYLOO_API_URL}/v1`,
						apiKey: config.ZYLOO_API_KEY,
						upstreamModel: (id, gid) => gid ?? id,
						extraBody: (body) => body,
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
				upstreamModel: (id) => id,
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
