/**
 * M10.4 — Vendor Meta
 *
 * Structured, public metadata for each upstream inference / search / wallet
 * provider OMA routes traffic to. Inspired by new-api's `controller/vendor_meta.go`
 * (2.7KB) which exposes a structured `VendorMeta` array to the operator console.
 *
 * Surface: GET /v1/providers/meta (no auth) — used by the dashboard provider
 * showcase, marketing /models page, and admin audit reports.
 *
 * IMPORTANT: This module exposes ONLY a `hasApiKey: boolean` per provider —
 * it NEVER returns the raw API key value. The key is read from `config.*` to
 * determine presence, then dropped — only the boolean survives the boundary.
 *
 * Why import config (impure):
 *   - The boolean hasApiKey must reflect CURRENT operator config (which keys
 *     are provisioned in the environment) so the dashboard can render a
 *     "key required" warning accurately.
 *   - For test isolation: vitest's `vi.mock("../config.js", ...)` swaps the
 *     config module before this file is evaluated, so the hasApiKey values
 *     are computed against the mock during test runs.
 */
import { config } from "../config.js";
import { healthCheckVenice } from "./venice.js";
import { logger } from "../lib/logger.js";

export interface VendorHealth {
  ok: boolean;
  latencyMs?: number;
  error?: string;
  checkedAt: string;
}

export interface VendorMeta {
  name: "venice" | "antseed" | "openrouter" | "together" | "deepinfra" | "morpheus" | "surplus" | "litellm" | "claude" | "gemini";
  displayName: string;
  baseUrl: string;
  iconUrl: string;
  docsUrl: string;
  supportsStreaming: boolean;
  supportsTools: boolean;
  supportsVision: boolean;
  hasApiKey: boolean;
  region: string;
  addedAt: string; // ISO 8601 date (YYYY-MM-DD) for the first integration
  health?: VendorHealth; // optional — only present for providers with a live health probe
}

/**
 * Internal shape used during construction: every entry declares which config
 * key the runtime should consult to determine `hasApiKey`. Keeping this as a
 * separate field (not a hard-coded `true`/`false` literal) prevents the
 * classic "always-true" / "always-false" regression and makes the data↔env
 * relationship explicit.
 */
interface VendorMetaStatic extends Omit<VendorMeta, "hasApiKey" | "health"> {
  apiKeyConfigKey: string;
  /** When true, the meta route will attach a live health probe to this entry. */
  probeHealth?: boolean;
}

const VENDOR_META_DATA: readonly VendorMetaStatic[] = [
  {
    name: "venice",
    displayName: "Venice AI",
    baseUrl: "https://api.venice.ai",
    iconUrl: "/providers/venice.svg",
    docsUrl: "https://docs.venice.ai",
    supportsStreaming: true,
    supportsTools: true,
    supportsVision: true,
    region: "us-east",
    addedAt: "2025-09-01",
    apiKeyConfigKey: "VENICE_API_KEY",
    probeHealth: true,
  },
  {
    name: "antseed",
    displayName: "AntSeed (P2P)",
    baseUrl: "https://antseed.com/api/v1",
    iconUrl: "/providers/antseed.svg",
    docsUrl: "https://docs.antseed.com",
    supportsStreaming: true,
    supportsTools: false,
    supportsVision: false,
    region: "global-p2p",
    addedAt: "2025-11-15",
    // AntSeed is a P2P proxy, not a key — but it still needs an endpoint
    // to be reachable, so we surface "has endpoint configured" the same way.
    apiKeyConfigKey: "ANTSEED_PROXY_URL",
  },
  {
    name: "openrouter",
    displayName: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    iconUrl: "/providers/openrouter.svg",
    docsUrl: "https://openrouter.ai/docs",
    supportsStreaming: true,
    supportsTools: true,
    supportsVision: true,
    region: "us-west",
    addedAt: "2025-09-15",
    apiKeyConfigKey: "OPENROUTER_API_KEY",
  },
  {
    name: "together",
    displayName: "Together AI",
    baseUrl: "https://api.together.xyz/v1",
    iconUrl: "/providers/together.svg",
    docsUrl: "https://docs.together.ai",
    supportsStreaming: true,
    supportsTools: true,
    supportsVision: true,
    region: "us-west",
    addedAt: "2025-10-01",
    apiKeyConfigKey: "TOGETHER_API_KEY",
  },
  {
    name: "deepinfra",
    displayName: "DeepInfra",
    baseUrl: "https://api.deepinfra.com/v1/openai",
    iconUrl: "/providers/deepinfra.svg",
    docsUrl: "https://deepinfra.com/docs",
    supportsStreaming: true,
    supportsTools: true,
    supportsVision: true,
    region: "us-east",
    addedAt: "2025-10-15",
    apiKeyConfigKey: "DEEPINFRA_API_KEY",
  },
  {
    name: "morpheus",
    displayName: "Morpheus",
    baseUrl: "https://api.mor.org/api/v1",
    iconUrl: "/providers/morpheus.svg",
    docsUrl: "https://docs.mor.org",
    supportsStreaming: true,
    supportsTools: true,
    supportsVision: false,
    region: "global",
    addedAt: "2026-02-01",
    apiKeyConfigKey: "MORPHEUS_API_KEY",
  },
  {
    name: "surplus",
    displayName: "Surplus Intelligence",
    baseUrl: "https://api.surplusintelligence.ai/v1",
    iconUrl: "/providers/surplus.svg",
    docsUrl: "https://docs.surplusintelligence.ai",
    supportsStreaming: true,
    supportsTools: false,
    supportsVision: false,
    region: "global-discount",
    addedAt: "2026-03-10",
    // Surplus uses a wallet private key for x402-style discount routing, not
    // a traditional API key. We still report it as hasApiKey=true when the
    // operator has provisioned it.
    apiKeyConfigKey: "SURPLUS_WALLET_PRIVATE_KEY",
  },
  {
    name: "litellm",
    displayName: "LiteLLM Proxy",
    baseUrl: "https://litellm.oma-ai.dev/v1",
    iconUrl: "/providers/litellm.svg",
    docsUrl: "https://docs.litellm.ai",
    supportsStreaming: true,
    supportsTools: true,
    supportsVision: false,
    region: "self-hosted",
    addedAt: "2025-12-01",
    apiKeyConfigKey: "LITELLM_API_KEY",
  },
  {
    name: "litellm",
    displayName: "LiteLLM Proxy",
    baseUrl: "https://litellm.oma-ai.dev/v1",
    iconUrl: "/providers/litellm.svg",
    docsUrl: "https://docs.litellm.ai",
    supportsStreaming: true,
    supportsTools: true,
    supportsVision: false,
    region: "self-hosted",
    addedAt: "2025-12-01",
    apiKeyConfigKey: "LITELLM_API_KEY",
  },
  {
    name: "gemini",
    displayName: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com",
    iconUrl: "/providers/gemini.svg",
    docsUrl: "https://ai.google.dev/gemini-api/docs",
    supportsStreaming: true,
    supportsTools: true,
    supportsVision: true,
    region: "us-central",
    addedAt: "2026-06-14",
    apiKeyConfigKey: "GEMINI_API_KEY",
  },
] as const;

/**
 * Returns true if the given config key holds a non-empty string value.
 * We treat `undefined`, `""`, and non-string values as "no key configured".
 * NEVER returns the value itself — only the boolean.
 */
function readHasApiKey(configKey: string): boolean {
  // config is the zod-validated object; we use a typed lookup to keep TS happy.
  const v = (config as unknown as Record<string, unknown>)[configKey];
  return typeof v === "string" && v.length > 0;
}

/**
 * The resolved, runtime-evaluated VendorMeta array. `hasApiKey` is computed
 * at module-load from `config.*` — never includes the key value itself.
 *
 * Exported as `readonly` so callers must not mutate, but the public API is
 * `getVendorMeta()` which returns a fresh shallow copy.
 *
 * Live health probes (Venice today) are attached on demand by `getVendorMeta`
 * — we deliberately do NOT pin a probe result at module-load so a transient
 * upstream hiccup at boot time can't permanently paint a provider red.
 */
export const VENDOR_META: readonly VendorMeta[] = VENDOR_META_DATA.map((p) => ({
  name: p.name,
  displayName: p.displayName,
  baseUrl: p.baseUrl,
  iconUrl: p.iconUrl,
  docsUrl: p.docsUrl,
  supportsStreaming: p.supportsStreaming,
  supportsTools: p.supportsTools,
  supportsVision: p.supportsVision,
  region: p.region,
  addedAt: p.addedAt,
  hasApiKey: readHasApiKey(p.apiKeyConfigKey),
}));

/**
 * Run a live health probe for a single vendor. Wrapped in try/catch + logged
 * so a probe failure never bubbles up and breaks the public meta response.
 */
async function probeVendorHealth(name: string): Promise<VendorHealth | undefined> {
  try {
    if (name === "venice") {
      const result = await healthCheckVenice();
      return {
        ok: result.ok,
        ...(result.latencyMs !== undefined ? { latencyMs: result.latencyMs } : {}),
        ...(result.error ? { error: result.error } : {}),
        checkedAt: new Date().toISOString(),
      };
    }
    return undefined;
  } catch (err) {
    logger.warn("[vendor-meta] health probe failed for %s: %s", name, err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      checkedAt: new Date().toISOString(),
    };
  }
}

/**
 * Return the public VendorMeta array (one entry per upstream provider).
 * Hard-coded base data + runtime hasApiKey — no DB read. Health probes are
 * awaited in parallel; if a probe fails the entry is still returned (with
 * `health.ok = false`) so the meta endpoint never 500s on a probe failure.
 */
export async function getVendorMeta(): Promise<VendorMeta[]> {
  const base = VENDOR_META.map((v) => ({ ...v }));
  const probes = await Promise.all(
    VENDOR_META_DATA.map((p) => (p.probeHealth ? probeVendorHealth(p.name) : Promise.resolve(undefined)))
  );
  for (let i = 0; i < base.length; i++) {
    if (probes[i]) {
      base[i] = { ...base[i], health: probes[i] };
    }
  }
  return base;
}
