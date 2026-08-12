/**
 * Provider resolution — maps model provider labels to upstream API routes.
 *
 * Extracted from proxy.ts for focused responsibility.
 */
import { config } from "../config.js";
import type { ModelDef } from "./models.js";

/** Provider-specific request envelope. Both backends are OpenAI-compatible. */
export interface ProviderRoute {
  baseUrl: string;
  apiKey: string;
  /** Translate OMA model id → upstream model id (Venice, OpenBroker). */
  upstreamModel: (omaModelId: string, omaAiId?: string) => string;
  /** Strip provider-only fields the upstream doesn't accept. */
  extraBody: (body: Record<string, unknown>) => Record<string, unknown>;
  /** Surface the upstream provider name in audit + usage rows. */
  providerLabel: "venice" | "oma-ai";
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

export function resolveProvider(provider: string, modelDef?: ModelDef): ProviderRoute {
  if (provider === "oma-ai") {
    // Two resale upstreams, both branded "oma-ai" to users:
    //   zyloo      → api.zyloo.io        (gemini-*, gpt-*)
    //   openbroker → api.openbroker.gonka.gg (MiniMax-M2.7, Kimi-K2.6)
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
        extraBody: (body) => body, // OpenAI-compatible — pass through
        providerLabel: "oma-ai",
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
      extraBody: (body) => body, // OpenAI-compatible — pass through
      providerLabel: "oma-ai",
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
  };
}
