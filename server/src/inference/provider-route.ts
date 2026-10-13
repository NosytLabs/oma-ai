/**
 * Provider resolution — maps model provider labels to upstream API routes.
 *
 * Two primary routes the user-facing router selects between:
 *   - "venice"   — direct Venice AI (api.venice.ai)
 *   - "oma-ai"   — OpenBroker (api.openbroker.gonka.gg)
 *
 */
import { config } from "../config.js";
import { logger } from "../lib/logger.js";
import type { ModelDef } from "./models.js";

/** Provider-specific request envelope. All backends are OpenAI-compatible. */
export interface ProviderRoute {
	baseUrl: string;
	apiKey: string;
	/**
	 * Translate OMA model id → upstream model id.
	 * @param omaModelId — the model.id from the catalog (fallback)
	 * @param omaAiId    — the OMA-AI upstream id (OpenBroker)
	 */
	upstreamModel: (omaModelId: string, omaAiId?: string) => string;
	/** Strip provider-only fields the upstream doesn't accept. */
	extraBody: (body: Record<string, unknown>) => Record<string, unknown>;
	/** Provider label used for customer usage and billing. */
	providerLabel: "venice" | "oma-ai";
	/** Internal route metadata retained for usage accounting. */
	routedVia: "venice" | "oma-ai";
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

/** A rejected operator credential is a gateway failure, not a customer's 401. */
export class ProviderAuthenticationError extends ProviderError {
	constructor() {
		super("Model provider authentication failed. Contact support.", 502);
	}
}

export function resolveProvider(provider: string, _modelDef?: ModelDef): ProviderRoute {
	if (provider === "oma-ai") {
		// "oma-ai" is backed exclusively by OpenBroker after the Zyloo removal.
		// Every catalog entry must declare upstream: "openbroker" (or be
		// rejected by the catalog loader); we don't branch on it here.
		if (!config.OPENBROKER_API_KEY) {
			logger.error({ provider: "oma-ai", requiredSetting: "OPENBROKER_API_KEY" }, "[inference] provider credential missing");
			throw new ProviderError(
				"This model is temporarily unavailable. Try another model or contact support.",
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
		logger.error({ provider: "venice", requiredSetting: "VENICE_API_KEY" }, "[inference] provider credential missing");
		throw new ProviderError(
			"This model is temporarily unavailable. Try another model or contact support.",
			503,
		);
	}
	return {
		baseUrl: `${config.VENICE_API_URL}/api/v1`,
		apiKey: config.VENICE_API_KEY,
		// Send the catalog's `veniceId` when it declares one, else the public
		// id. A few entries keep a stable public id that differs from their
		// Venice id (e.g. public `public-deepseek-alias` -> Venice
		// `deepseek-v4-flash-0731`); without this the public id went
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
