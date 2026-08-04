import { z } from "zod";
import { PLACEHOLDER_ADDRESSES, CREDIT_EXPIRY_DAYS } from "./constants.js";

const INSECURE_DEFAULTS = [
  "dev-secret-change-me-in-prod-32ch",
  "changeme",
  "secret",
  "jwt-secret",
  "dev-receipt-hmac-placeholder",
  "dev-encryption-key-change-me-in-prod-32ch",
];

/** Parse human-friendly environment booleans without Boolean("false") surprises. */
export function parseBooleanEnv(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "off", ""].includes(normalized)) return false;
  return value;
}

const envBoolean = z.preprocess(parseBooleanEnv, z.boolean());

const envSchema = z.object({
  DATABASE_URL: z.string().min(1).optional().default("postgresql://localhost:5432/oma"),
  REDIS_URL: z.string().min(1).optional().default("redis://localhost:6379"),
  VENICE_API_KEY: z.string().min(1).optional(),
  VENICE_API_URL: z.string().min(1).default("https://api.venice.ai"),
  // Gonka decentralized provable-inference broker (optional).
  // PRIMARY PATH (2026-07-16): api.openbroker.gonka.gg — your dedicated broker
  // account, devshard-backed, GNK-settled, ~$0.0000008 per 500-token request.
  // Falls back to proxy.gonka.gg (open community proxy) if API key missing.
  // Override via GONKA_API_URL env var to point at a different community broker.
  // OPENBROKER_* aliases are optional — if both set, GONKA_* wins.
  GONKA_API_KEY: z.string().min(1).optional(),
  GONKA_API_URL: z.string().url().optional().default("https://api.openbroker.gonka.gg"),
  OPENBROKER_API_KEY: z.string().min(1).optional(),
  OPENBROKER_API_URL: z.string().url().optional().default("https://api.openbroker.gonka.gg"),
  // Allow Venice non-private mode. By default all Venice requests set
  // venice_parameters.private=true. Set OMMA_ALLOW_NON_PRIVATE_VENICE=true to
  // let callers opt out per-request (private:false) for non-sensitive traffic.
  // Production should leave this unset (defaults to false).
  OMMA_ALLOW_NON_PRIVATE_VENICE: envBoolean.default(false),
  // Non-private providers (OpenRouter, Together, DeepInfra, Claude,
  // Gemini, Morpheus, AntSeed, LiteLLM) removed. OMA routes exclusively through
  // Venice-based providers (Venice direct, Surplus, CheapTokens) to guarantee
  // zero-data-retention privacy. If you need a non-private provider, add it to
  // provider-selector.ts, call-provider.ts, and models.ts in the same commit.
  SURPLUS_WALLET_PRIVATE_KEY: z.string().min(1).optional(),
  CHEAPTOKENS_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  // Primary Base mainnet RPC. Default = QuickNode multichain endpoint (active
  // production endpoint). Set to https://base-rpc.publicnode.com or another
  // provider for dev/test environments.
  // SECURITY (A12): No empty-string default. Callers must handle undefined.
  // Production requires CHAIN_RPC_URL (or the QUICKNODE_RPC_URL alias below).
  CHAIN_RPC_URL: z.string().min(1).optional(),
  CHAIN_RPC_URL_FALLBACK: z.string().optional(),

  // 2026-07-30: dedicated Ethereum mainnet RPC for ENS lookups
  // (SIWE plugin). viem's default mainnet transport is unreliable;
  // cloudflare-eth.com is a safer default.
  ETH_RPC_URL: z.string().url().optional(),
  // QuickNode aliases — folded into CHAIN_RPC_URL* after parse (alias wins).
  QUICKNODE_RPC_URL: z.string().url().optional(),
  QUICKNODE_RPC_URL_FALLBACK: z.string().url().optional(),
  FACILITATOR_MODE: z.enum(["mock", "live"]).default("mock"),
  FACILITATOR_PRIVATE_KEY: z.string().regex(/^0x[a-fA-F0-9]{64}$/).optional(),
  // SECURITY (A14): No placeholder default. Must be explicitly set in
  // production. The production startup guard below rejects known placeholders.
  TREASURY_BASE_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  // Flat USD price for one x402-paid /v1/chat/completions request (no
  // account, no credits — settled per request via PAYMENT-SIGNATURE).
  // "0" disables the 402 challenge path; requires TREASURY_BASE_ADDRESS.
  X402_CHAT_PRICE_USD: z.string().regex(/^\d+(\.\d+)?$/).default("0.10"),
  PORT: z.coerce.number().default(3001),
  // Better Auth owns session signing and CSRF protection; we just need to provide a
  // 32+ char secret. Generate one per environment with `openssl rand -hex 32`.
  BETTER_AUTH_SECRET: z.string().min(32).default("dev-better-auth-secret-change-me-in-prod-32ch"),
  // The base URL Better Auth uses to build callback URLs. In dev = the Next
  // app's port (:3000). In prod = PUBLIC_APP_URL. Falls back to the API URL
  // if neither is set.
  BETTER_AUTH_URL: z.string().url().optional(),
  // Resend API key for magic-link emails. Unset = dev mode (logs to stdout).
  RESEND_API_KEY: z.string().min(1).optional(),
  RESEND_FROM: z.string().min(1).optional(),
  ENCRYPTION_KEY: z.string().min(32).default("dev-encryption-key-change-me-in-prod-32ch"),
  // Browser clients run on the Next app origin, not the API port.
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  // Canonical production domain. Used as the SIWE `domain` bind target
  // and as the default for sign-in message headers. Set in production; tests
  // and dev default to a permissive value.
  PRIMARY_DOMAIN: z.string().min(1).default("oma-ai.com"),
  // Public-facing API URL. Used by OpenAPI spec, SSO SAML entity/ACS URLs, and any
  // server-rendered surface that surfaces the public endpoint to clients.
  // Falls back to the production domain; production deployments can override
  // (e.g. staging environments).
  PUBLIC_API_URL: z.string().url().default("https://api.oma-ai.com"),
  // PUBLIC_APP_URL — the Next.js app origin. Used by Better Auth's
  // trustedOrigins and as the baseURL fallback for session cookie domain.
  // Falls back to localhost in dev.
  PUBLIC_APP_URL: z.string().url().optional().default("http://localhost:3000"),
  ONRAMP_WEBHOOK_SECRET: z.string().min(1).optional(),
  // Shared secret for the /internal/jobs/:name trigger endpoints (GitHub
  // Actions cron). Endpoints return 503 when unset — fail closed.
  JOBS_TOKEN: z.string().min(32).optional(),
  // LI.FI deposit webhook HMAC secret. Required for production LI.FI webhook verification.
  LIFI_WEBHOOK_SECRET: z.string().min(1).optional(),
  // CCTP deposit webhook HMAC secret. Required for production CCTP webhook verification.
  CCTP_WEBHOOK_SECRET: z.string().min(1).optional(),
  RECEIPT_HMAC_SECRET: z.string().min(1).optional().default("dev-receipt-hmac-placeholder"),
  NODE_ENV: z.enum(["development", "production", "test", "staging", "preview"]).default("development"),
  DEBUG_STREAM: envBoolean.default(false),
  // Log level for the server logger (trace, debug, info, warn, error, fatal)
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).optional(),
  AUTO_RELOAD_THRESHOLD: z.coerce.number().positive().default(50000),
  AUTO_RELOAD_AMOUNT: z.coerce.number().positive().default(1000000),
  AUTO_RELOAD_SPEND_LIMIT: z.coerce.number().positive().default(1000000),
  OMA_PRICE_OVERRIDE: z.coerce.number().positive().optional(),
  SPEND_LIMIT_DAILY_CENTS: z.coerce.number().positive().default(10000),

  // Credit ledger expiry (days). Used by credits/preflight for batch windows.
  CREDIT_EXPIRY_DAYS: z.coerce.number().positive().default(CREDIT_EXPIRY_DAYS),

  // API key expiration (0 = never expires)
  DEFAULT_KEY_EXPIRY_DAYS: z.coerce.number().min(0).default(90),

  // Admin wallet addresses (comma-separated, checks on every admin route)
  ADMIN_WALLET_ADDRESSES: z.string().optional().default(""),
  PLATFORM_TEAM_ID: z.string().optional().default(""),

  // When true, admin money-movement routes (refund grant/deny, ledger sweep)
  // FAIL CLOSED if the acting admin has not enrolled 2FA — the TOTP step-up
  // becomes a hard requirement instead of an opt-in. Default false so existing
  // admins without 2FA are not locked out; enable in prod once all admins have
  // 2FA enrolled. See auth/require-fresh-totp.ts.
  REQUIRE_ADMIN_2FA: envBoolean.default(false),

  CCTP_CIRCLE_API_URL: z.string().min(1).default("https://iris-api.circle.com"),
  CCTP_SOURCE_CHAINS: z.string().min(1).default("ethereum,arbitrum,optimism,polygon,avalanche"),
  CCTP_BASE_DOMAIN: z.coerce.number().default(6),

  // Base mainnet chain ID
  BASE_CHAIN_ID: z.coerce.number().int().positive().default(8453),

  // Markup percentage applied to inference billing (e.g. 25 = 25% markup on cost)
  // Applied per-model via ModelPricing.markup in billing-service.ts.
  OMA_MARKUP_PCT: z.coerce.number().min(0).max(100).default(25),

  // Free signup credit — credits minted to a brand-new user on first
  // sign-in. 100 = $1.00 at 1 credit = 1 cent. Set to 0 to disable the
  // free trial. Without this, /v1/balance reads 0 forever and users
  // hit "insufficient_balance" on their first real call.
  FREE_SIGNUP_CENTS: z.coerce.number().min(0).max(100000).default(100),

  // Tiered markup strategy (best practice: higher margin on cheap models,
  // lower on frontier — price-sensitive buyers absorb cost on budget tiers,
  // frontier buyers are inelastic and won't tolerate steep markup).
  // Format: "budget=40,mid=30,premium=22,frontier=15". Falls back to
  // OMA_MARKUP_PCT for any missing tier. Keyed off ModelDef.category.
  OMA_TIERED_MARKUP: z.string().optional(),

  // Operator-expected markup floor per model, used by the price-drift audit at
  // catalog load. Format: "model-a=25,model-b=10". If a catalog entry's actual
  // markupPercent is below its expected floor, OMA logs a WARN (likely selling
  // at a loss — sync server/src/inference/models.ts with upstream pricing). Optional.
  OMA_MODEL_MARKUP_OVERRIDES: z.string().optional(),

  // Minimum deposit floor (USD). Prevents spam/dust deposits that cost more in
  // on-chain verification + DB writes than they're worth. Research (Flexprice,
  // OpenRouter) shows a $10 floor is the sweet spot — blocks abuse without
  // friction for real users. Applied to all deposit routes (usdc/cctp/lifi).
  MIN_DEPOSIT_USD: z.coerce.number().min(0).max(100000).default(10),
  AFFINITY_TTL_MS: z.coerce.number().int().positive().default(300_000),

  // Onramp configuration (moved from hardcoded literals in routes/onramp.ts)
  ONRAMP_PROCESSING_FEE_PERCENT: z.coerce.number().min(0).max(50).default(2.9), // 2.9% — value is in PERCENT
  ONRAMP_QUOTE_CACHE_TTL_MS: z.coerce.number().int().positive().default(10 * 60 * 1000), // 10 min

  LIFI_API_URL: z.string().min(1).default("https://li.quest/v1"),
  LIFI_INTEGRATOR: z.string().min(1).default("oma-ai"),

  LIFI_SOURCE_CHAINS: z.string().min(1).default("ethereum,arbitrum,optimism,polygon,avalanche,base,bsc,gnosis,fantom"),

  // OpenTelemetry configuration
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().min(1).default("http://localhost:4318").optional(),
  OTEL_SERVICE_NAME: z.string().min(1).default("oma-server").optional(),

  // Weighted load balancing for provider failover (format: "venice:70,surplus:30")
  // Weights are relative proportions - higher weight = more traffic. 0 = disabled.
  // If not set, defaults to sequential fallback (primary provider first, then others in order).
  PROVIDER_WEIGHTS: z.string().optional(),

  // Per-model weighted load balancing (format: "deepseek-v3.2=venice:70,surplus:30")
  // Takes precedence over PROVIDER_WEIGHTS for matching models. Format: modelId=provider:weight,...
  MODEL_WEIGHTS: z.string().optional(),

  // Provider request timeouts (ms)
  PROVIDER_TIMEOUT_STREAM_MS: z.coerce.number().min(1000).default(120000),
  PROVIDER_TIMEOUT_NON_STREAM_MS: z.coerce.number().min(1000).default(60000),

  // Optional path whose directory holds models-overrides.json (runtime catalog is code-loaded).
  MODELS_CONFIG_PATH: z.string().optional(),

  // Trusted proxy IPs for X-Forwarded-For validation (comma-separated)
  // Only trust X-Forwarded-For headers from these known proxy IPs
  TRUSTED_PROXY_IPS: z.string().optional().default(""),

  // Additional SIWE allowed domains (comma-separated)
  ALLOWED_SIWE_DOMAINS: z.string().optional(),

  // Build metadata (injected at build time)
  BUILD_SHA: z.string().optional().default("dev"),
  BUILD_TIME: z.string().optional().default(() => new Date().toISOString()),

  // CheapTokens: force disable provider
  CHEAPTOKENS_FORCE_DISABLE: envBoolean.default(false),

  // ===========================================================================
  // M5: Hardcoded business constants moved from inline literals into the
  // schema. Defaults preserve the previous hardcoded behavior so deployments
  // without these env vars continue to work.
  // ===========================================================================

  // CCTP: per-chain RPC URL map (comma-separated `chain:url` pairs).
  // Example: "ethereum:https://eth.example.com,base:https://base.example.com".
  // When unset, cctp-client.ts falls back to viem's default RPC transport.
  CHAIN_RPC_URL_PER_CHAIN: z.string().optional(),

  // CheapTokens: per-day USDC spend cap in cents. 0 (default) = no cap.
  // The runtime check is `if (capCents > 0)` so an unset env var maps to
  // the same "no cap" behavior as the prior hardcoded `undefined` literal.
  CT_DAILY_USDC_CENTS_MAX: z.coerce.number().int().nonnegative().default(0),

  // Surplus provider: minimum acceptable discount percentage (0-100). The
  // surplus chat-completion path will reject quotes with discount < this floor.
  SURPLUS_MIN_DISCOUNT_PCT: z.coerce.number().min(0).max(100).default(0),

  // Surplus provider: contract addresses. The verifier is the legacy EIP-712
  // verifyingContract; the settlement contract is the new x402 settlement
  // proxy on Base (0x0770…c137). permit2 + usdc are required for `upto` scheme.
  SURPLUS_VERIFIER_CONTRACT: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  SURPLUS_SETTLEMENT_CONTRACT: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  SURPLUS_PERMIT2_CONTRACT: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  SURPLUS_USDC_CONTRACT: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  SURPLUS_CHAIN_ID: z.coerce.number().int().positive().default(8453), // Base mainnet
  SURPLUS_DEFAULT_SCHEME: z.enum(["upto", "exact"]).default("upto"),

  // Session / auth: cookie lifetime in milliseconds. Default 1h.
  SESSION_COOKIE_TTL_MS: z.coerce.number().int().positive().default(60 * 60 * 1000),

  // Onramp: USD → credits conversion rate and per-quote USD bounds.
  // CREDITS_PER_USD is multiplied against net USD to produce credits (cents).
  // ONRAMP_MIN_USD / ONRAMP_MAX_USD bound a single quote's amountUsd.
  CREDITS_PER_USD: z.coerce.number().int().positive().default(100),
  ONRAMP_MIN_USD: z.coerce.number().positive().default(10),
  ONRAMP_MAX_USD: z.coerce.number().positive().default(1000),

  // Connection pool size for Neon Postgres (used with PgBouncer)
  CONNECTION_POOL_SIZE: z.coerce.number().int().positive().default(10),

  // ===========================================================================
  // x402 facilitator provider selection.
  //
  // "coinbase-cdp" (default) — verify/settle locally using viem + CHAIN_RPC_URL,
  //                            settlement to TREASURY_BASE_ADDRESS via FACILITATOR_PRIVATE_KEY.
  // "quicknode"            — delegate verify/settle to QuickNode's hosted x402
  //                            facilitator (marketplace addon). Requires
  //                            QUICKNODE_X402_URL + QUICKNODE_X402_API_KEY.
  //                            Falls back to "coinbase-cdp" if QuickNode env vars
  //                            are unset.
  // ===========================================================================
  X402_FACILITATOR_PROVIDER: z.enum(["coinbase-cdp", "quicknode"]).default("coinbase-cdp"),
  QUICKNODE_X402_URL: z.string().url().optional(),
  QUICKNODE_X402_API_KEY: z.string().min(1).optional(),

  // Polar.sh merchant of record configuration
  POLAR_ACCESS_TOKEN: z.string().min(1).optional(),
  POLAR_WEBHOOK_SECRET: z.string().min(1).optional(),
  POLAR_ORGANIZATION_ID: z.string().min(1).optional(),
  POLAR_SERVER: z.enum(["production", "sandbox"]).optional().default("production"),

  // USDC deposit receiver on Base. Operator wallet that credits user balances
  // after on-chain transfer confirmation. Empty in dev = surface a 503 instead
  // of accepting deposits to nowhere.
  USDC_DEPOSIT_ADDRESS: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .optional(),
  USDC_DEPOSIT_NETWORK: z.enum(["base"]).default("base"),
  USDC_DEPOSIT_MIN_CENTS: z.coerce.number().int().positive().default(100),  // $1
  USDC_DEPOSIT_MAX_CENTS: z.coerce.number().int().positive().default(1000000), // $10,000
  // Per-plan Polar product UUIDs. Get these from Polar dashboard → Products.
  POLAR_HOBBY_PRODUCT_ID: z.string().min(1).optional(),
  POLAR_BUILDER_PRODUCT_ID: z.string().min(1).optional(),
  POLAR_SCALE_PRODUCT_ID: z.string().min(1).optional(),
  /**
   * Optional Polar Meter ID for usage-based billing. When set, every
   * successful chat completion sends an event to Polar Meters so the
   * customer can be billed for what they actually used. Leave unset
   * (or `metr_…` placeholder) to disable usage tracking. See
   * `inference/polar-usage.ts` for the event shape.
   *
   * Important: Polar TOS forbids reselling COMPUTE on Polar. Treat this
   * as subscription-bundled credits (customers buy a plan, use credits
   * inside the plan's allocation), NOT pure-usage metering.
   */
  POLAR_USAGE_METER_ID: z.string().min(1).optional(),
});

export type Config = z.infer<typeof envSchema>;

// Parse, then fold QuickNode RPC aliases into CHAIN_RPC_URL so every consumer
// only needs to read CHAIN_RPC_URL / CHAIN_RPC_URL_FALLBACK. Similarly, fold
// the OPENBROKER_API_URL alias into GONKA_API_URL (explicit GONKA_* wins).
const _parsed = envSchema.parse(process.env);
export const config: Config = {
  ..._parsed,
  CHAIN_RPC_URL: _parsed.QUICKNODE_RPC_URL ?? _parsed.CHAIN_RPC_URL,
  CHAIN_RPC_URL_FALLBACK:
    _parsed.QUICKNODE_RPC_URL_FALLBACK ?? _parsed.CHAIN_RPC_URL_FALLBACK,
  GONKA_API_URL: process.env.GONKA_API_URL
    ? _parsed.GONKA_API_URL
    : process.env.OPENBROKER_API_URL
      ? _parsed.OPENBROKER_API_URL
      : _parsed.GONKA_API_URL,
};

// Cached set of admin wallet addresses for O(1) lookup in requireAdmin()
const ADMIN_WALLET_ADDRESSES_SET: Set<string> = new Set(
  config.ADMIN_WALLET_ADDRESSES
    .split(",")
    .map((a) => a.trim().toLowerCase())
    .filter(Boolean)
);
export { ADMIN_WALLET_ADDRESSES_SET };

const validProductionEnvironments: string[] = ["production", "staging", "prod", "preview"];
const isProductionEnv = validProductionEnvironments.includes(config.NODE_ENV);

// Better Auth prod guards — fail fast on insecure defaults before any
// request is served. The dev defaults are obviously insecure (32-z char
// "dev-better-auth-secret..." bookmark reveals the intent).
if (isProductionEnv && config.BETTER_AUTH_SECRET.startsWith("dev-")) {
  console.error("[FATAL] BETTER_AUTH_SECRET must not be a dev placeholder in production. Run `openssl rand -hex 32` and set the result.");
  process.exit(1);
}

if (isProductionEnv && config.BETTER_AUTH_SECRET.length < 64) {
  console.error("[FATAL] BETTER_AUTH_SECRET must be at least 64 hex characters in production for adequate entropy.");
  process.exit(1);
}

if (config.FACILITATOR_MODE === "mock" && isProductionEnv) {
  throw new Error("FATAL: FACILITATOR_MODE=mock is not allowed in production or staging environments. Set FACILITATOR_MODE=live or run in development.");
}

if (config.FACILITATOR_MODE === "live" && isProductionEnv) {
  if (config.X402_FACILITATOR_PROVIDER === "coinbase-cdp" && !config.FACILITATOR_PRIVATE_KEY) {
    throw new Error(
      "FATAL: FACILITATOR_MODE=live with X402_FACILITATOR_PROVIDER=coinbase-cdp requires FACILITATOR_PRIVATE_KEY to be set. " +
      "Set a 32-byte hex private key (0x-prefixed, 64 hex chars) or switch X402_FACILITATOR_PROVIDER=quicknode."
    );
  }
  if (config.X402_FACILITATOR_PROVIDER === "quicknode" && (!config.QUICKNODE_X402_URL || !config.QUICKNODE_X402_API_KEY)) {
    throw new Error(
      "FATAL: X402_FACILITATOR_PROVIDER=quicknode requires QUICKNODE_X402_URL and QUICKNODE_X402_API_KEY to be set. " +
      "Both are required when delegating x402 settlement to QuickNode."
    );
  }
}

if (isProductionEnv) {
  const treasuryAddress = config.TREASURY_BASE_ADDRESS;
  if (!treasuryAddress) {
    throw new Error("FATAL: TREASURY_BASE_ADDRESS must be set in production.");
  }
  if (PLACEHOLDER_ADDRESSES.includes(treasuryAddress)) {
    throw new Error("FATAL: TREASURY_BASE_ADDRESS is a placeholder address. Set a real address in production.");
  }
}

// SECURITY (A12): Require a Base RPC endpoint in production.
if (isProductionEnv && !config.CHAIN_RPC_URL) {
  throw new Error(
    "FATAL: CHAIN_RPC_URL (or QUICKNODE_RPC_URL alias) must be set in production.",
  );
}
if (isProductionEnv && INSECURE_DEFAULTS.includes(config.ENCRYPTION_KEY)) {
  console.error("[FATAL] ENCRYPTION_KEY must not be a known insecure default in production. Set a strong secret (>= 32 chars).");
  process.exit(1);
}

if (isProductionEnv && config.ENCRYPTION_KEY.length < 40) {
  console.error("[FATAL] ENCRYPTION_KEY must be at least 40 characters in production for adequate entropy.");
  process.exit(1);
}

if (isProductionEnv && config.FACILITATOR_MODE === "live" && !config.SURPLUS_WALLET_PRIVATE_KEY) {
  console.error("[FATAL] FACILITATOR_MODE=live requires SURPLUS_WALLET_PRIVATE_KEY to be set in production. Set a Surplus settlement key or disable the surplus fallback path.");
  process.exit(1);
}

if (isProductionEnv && !config.RECEIPT_HMAC_SECRET) {
  console.error("[FATAL] RECEIPT_HMAC_SECRET must be set in production environments.");
  process.exit(1);
}

if (isProductionEnv && INSECURE_DEFAULTS.includes(config.RECEIPT_HMAC_SECRET)) {
  console.error("[FATAL] RECEIPT_HMAC_SECRET must not be a known insecure default in production. Set a strong secret.");
  process.exit(1);
}

if (config.NODE_ENV !== "test" && !isProductionEnv && config.RECEIPT_HMAC_SECRET === "dev-receipt-hmac-placeholder") {
  console.warn("[oma-config] WARNING: RECEIPT_HMAC_SECRET is the development placeholder. Set a strong secret before deploying to production (NODE_ENV=production/staging/preview).");
}

if (isProductionEnv && (config.DATABASE_URL.includes("localhost") || !config.DATABASE_URL.includes("@"))) {
  throw new Error("[FATAL] DATABASE_URL must have proper credentials in production. Set a user:password@host in the connection string.");
}

if (isProductionEnv && !config.ONRAMP_WEBHOOK_SECRET) {
  console.warn("[ONRAMP] WARNING: ONRAMP_WEBHOOK_SECRET is not set. Webhook verification will fail unless ONRAMP_WEBHOOK_SECRET is explicitly configured.");
}

if (isProductionEnv && !config.LIFI_WEBHOOK_SECRET) {
  console.warn("[LI.FI] WARNING: LIFI_WEBHOOK_SECRET is not set. LI.FI webhook verification will fail unless LIFI_WEBHOOK_SECRET is explicitly configured.");
}

if (isProductionEnv && !config.CCTP_WEBHOOK_SECRET) {
  console.warn("[CCTP] WARNING: CCTP_WEBHOOK_SECRET is not set. CCTP webhook verification will fail unless CCTP_WEBHOOK_SECRET is explicitly configured.");
}

function validateModelWeightsSync(modelWeightsStr: string | undefined): boolean {
  if (!modelWeightsStr) return true;
  const modelEntries = modelWeightsStr.split(";");
  for (let i = 0; i < modelEntries.length; i++) {
    const entry = modelEntries[i].trim();
    if (!entry) continue;
    const parts = entry.split("=");
    if (parts.length !== 2) {
      console.error(`[FATAL] MODEL_WEIGHTS entry ${i + 1}: expected "model=provider:weight,...", got "${entry}"`);
      return false;
    }
    const [modelId, weightsStr] = parts.map(s => s.trim());
    if (!modelId) {
      console.error(`[FATAL] MODEL_WEIGHTS entry ${i + 1}: model name cannot be empty`);
      return false;
    }
    if (!weightsStr) {
      console.error(`[FATAL] MODEL_WEIGHTS entry ${i + 1}: weights cannot be empty for model "${modelId}"`);
      return false;
    }
    const weightEntries = weightsStr.split(",");
    const ALL_PROVIDERS_LIST = ["venice", "surplus"];
    let totalWeight = 0;
    for (const we of weightEntries) {
      const [provider, weight] = we.split(":").map(s => s.trim());
      if (!provider || !weight) {
        console.error(`[FATAL] MODEL_WEIGHTS entry ${i + 1}: invalid weight format "${we}" for model "${modelId}"`);
        return false;
      }
      if (!ALL_PROVIDERS_LIST.includes(provider)) {
        console.error(`[FATAL] MODEL_WEIGHTS entry ${i + 1}: unknown provider "${provider}" for model "${modelId}". Valid: ${ALL_PROVIDERS_LIST.join(", ")}`);
        return false;
      }
      const w = parseInt(weight, 10);
      if (isNaN(w) || w < 0 || w > 100) {
        console.error(`[FATAL] MODEL_WEIGHTS entry ${i + 1}: weight "${weight}" must be 0-100 for provider "${provider}" in model "${modelId}"`);
        return false;
      }
      totalWeight += w;
    }
    if (totalWeight > 0 && totalWeight !== 100) {
      console.error(`[FATAL] MODEL_WEIGHTS entry ${i + 1}: weights sum to ${totalWeight}% (should be 100 or omit 0% providers) for model "${modelId}"`);
      return false;
    }
  }
  return true;
}

if (config.MODEL_WEIGHTS && !validateModelWeightsSync(config.MODEL_WEIGHTS)) {
  process.exit(1);
}
