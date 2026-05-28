import { z } from "zod";
import { PLACEHOLDER_ADDRESSES, CREDIT_EXPIRY_DAYS } from "./constants.js";

const INSECURE_DEFAULTS = [
  "dev-secret-change-me-in-prod-32ch",
  "changeme",
  "secret",
  "jwt-secret",
  "dev-receipt-hmac-placeholder",
];

const envSchema = z.object({
  DATABASE_URL: z.string().min(1).optional().default("postgresql://localhost:5432/oma"),
  REDIS_URL: z.string().min(1).optional().default("redis://localhost:6379"),
  VENICE_API_KEY: z.string().min(1).optional(),
  VENICE_API_URL: z.string().min(1).default("https://api.venice.ai"),
  ANTSEED_PROXY_URL: z.string().min(1).optional(),
  LITELLM_PROXY_URL: z.string().min(1).optional(),
  LITELLM_API_KEY: z.string().min(1).optional(),
  OPENROUTER_API_KEY: z.string().min(1).optional(),
  OPENROUTER_API_URL: z.string().min(1).default("https://openrouter.ai/api/v1"),
  OPENROUTER_REFERRER: z.string().min(1).optional(),
  OPENROUTER_VENICE_KEY: z.string().optional(),
  OPENROUTER_ALLOW_FALLBACKS: z.boolean().default(true),
  TOGETHER_API_KEY: z.string().min(1).optional(),
  TOGETHER_API_URL: z.string().min(1).default("https://api.together.xyz/v1"),
  DEEPINFRA_API_KEY: z.string().min(1).optional(),
  DEEPINFRA_API_URL: z.string().min(1).default("https://api.deepinfra.com/v1/openai"),
  GROQ_API_KEY: z.string().min(1).optional(),
  CEREBRAS_API_KEY: z.string().min(1).optional(),
  BEDROCK_ACCESS_KEY_ID: z.string().min(1).optional(),
  BEDROCK_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  BEDROCK_REGION: z.string().min(1).default("us-east"),
  HOUDINI_API_KEY: z.string().min(1).optional(),
  HOUDINI_API_SECRET: z.string().min(1).optional(),
  HOUDINI_PARTNER_ID: z.string().min(1).optional(),
  HOUDINI_WEBHOOK_SECRET: z.string().min(1).optional(),
  HOUDINI_API_URL: z.string().min(1).default("https://api-partner.houdiniswap.com/v2"),
  HOUDINI_WS_URL: z.string().min(1).default("wss://partner-api.houdiniswap.com/v2/ws"),
  HOUDINI_ADDRESS_TO: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  CHEAPTOKENS_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  CHAIN_RPC_URL: z.string().min(1).optional().default("https://base-rpc.publicnode.com"),
  CHAIN_RPC_URL_FALLBACK: z.string().optional(),
  AERODROME_POOL_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  SOLANA_RPC_URL: z.string().min(1).default("https://api.mainnet-beta.solana.com"),
  SOLANA_RPC_URL_FALLBACK: z.string().optional(),
  FACILITATOR_MODE: z.enum(["mock", "live"]).default("mock"),
  FACILITATOR_PRIVATE_KEY: z.string().min(1).optional(),
  TREASURY_SOLANA_ADDRESS: z.string().min(1).optional(),
  TREASURY_BASE_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/).default("0x3333333333333333333333333333333333333333"),
  PORT: z.coerce.number().default(3001),
  JWT_SECRET: z.string().min(32).default("dev-secret-change-me-in-prod-32ch"),
  ENCRYPTION_KEY: z.string().min(32).default("dev-secret-change-me-in-prod-32ch"),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  ONRAMP_WEBHOOK_SECRET: z.string().min(1).optional(),
  RECEIPT_HMAC_SECRET: z.string().min(1).optional().default("dev-receipt-hmac-placeholder"),
  NODE_ENV: z.enum(["development", "production", "test", "staging", "preview"]).default("development"),
  DEBUG_STREAM: z.coerce.boolean().default(false),
  AUTO_RELOAD_THRESHOLD: z.coerce.number().positive().default(50000),
  AUTO_RELOAD_AMOUNT: z.coerce.number().positive().default(1000000),
  AUTO_RELOAD_SPEND_LIMIT: z.coerce.number().positive().default(1000000),
  OMA_PRICE_OVERRIDE: z.coerce.number().positive().optional(),
  SPEND_LIMIT_DAILY_CENTS: z.coerce.number().positive().default(10000),

  // Credit system: $1 = $1 (1 dollar = 1 dollar, no conversion math)
  CREDIT_VALUE_PER_DOLLAR: z.coerce.number().default(1),
  CREDIT_PRICE_PER_TOKEN: z.coerce.number().default(0.000001),
  CREDIT_EXPIRY_DAYS: z.coerce.number().positive().default(CREDIT_EXPIRY_DAYS),
  CREDIT_BATCH_EXPIRY_DAYS: z.coerce.number().positive().default(CREDIT_EXPIRY_DAYS),

  // API key expiration (0 = never expires)
  DEFAULT_KEY_EXPIRY_DAYS: z.coerce.number().min(0).default(90),

  // Admin wallet addresses (comma-separated, checks on every admin route)
  ADMIN_WALLET_ADDRESSES: z.string().optional().default(""),
  PLATFORM_TEAM_ID: z.string().optional().default(""),

  CCTP_CIRCLE_API_URL: z.string().min(1).default("https://iris-api.circle.com"),
  CCTP_SOURCE_CHAINS: z.string().min(1).default("solana,ethereum,arbitrum,optimism,polygon,avalanche"),
  CCTP_BASE_DOMAIN: z.coerce.number().default(6),

  LIFI_API_URL: z.string().min(1).default("https://li.quest/v1"),
  LIFI_INTEGRATOR: z.string().min(1).default("oma-ai"),

  LIFI_SOURCE_CHAINS: z.string().min(1).default("ethereum,arbitrum,optimism,polygon,avalanche,base,solana,bsc,gnosis,fantom"),

  // OpenTelemetry configuration
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().min(1).default("http://localhost:4318").optional(),
  OTEL_SERVICE_NAME: z.string().min(1).default("oma-server").optional(),
  OTEL_EXPORTER_PROMETHEUS_PORT: z.coerce.number().positive().default(9464).optional(),

  TINYFISH_API_KEY: z.string().optional(),

  // CSRF protection secret (required for session-based auth flows)
  CSRF_SECRET: z.string().min(32).default("dev-csrf-secret-change-me-in-prod-32ch"),

  // Weighted load balancing for provider failover (format: "venice:70,antseed:30,litellm:0,openrouter:0,together:0,deepinfra:0")
  // Weights are relative proportions - higher weight = more traffic. 0 = disabled.
  // If not set, defaults to sequential fallback (primary provider first, then others in order).
  PROVIDER_WEIGHTS: z.string().optional(),

  // Per-model weighted load balancing (format: "gpt-4=venice:70,openrouter:30;dalle-3=openrouter:100;claude-3=venice:50,antseed:50")
  // Takes precedence over PROVIDER_WEIGHTS for matching models. Format: modelId=provider:weight,...
  MODEL_WEIGHTS: z.string().optional(),

  // Provider request timeouts (ms)
  PROVIDER_TIMEOUT_STREAM_MS: z.coerce.number().min(1000).default(120000),
  PROVIDER_TIMEOUT_NON_STREAM_MS: z.coerce.number().min(1000).default(60000),

  // Path to models.json config file (supports absolute paths, useful for Docker/K8s deployments)
  MODELS_CONFIG_PATH: z.string().optional(),

  // Cross-chain security settings
  CROSSCHAIN_SLIPPAGE_TOLERANCE: z.coerce.number().min(0).max(0.5).default(0.02),
  CROSSCHAIN_BLOCK_CONFIRMATIONS: z.coerce.number().int().min(1).max(100).default(6),

  // Trusted proxy IPs for X-Forwarded-For validation (comma-separated)
  // Only trust X-Forwarded-For headers from these known proxy IPs
  TRUSTED_PROXY_IPS: z.string().optional().default(""),
});

export type Config = z.infer<typeof envSchema>;

export const config: Config = envSchema.parse(process.env);

// Cached set of admin wallet addresses for O(1) lookup in requireAdmin()
const ADMIN_WALLET_ADDRESSES_SET: Set<string> = new Set(
  config.ADMIN_WALLET_ADDRESSES
    .split(",")
    .map((a) => a.trim().toLowerCase())
    .filter(Boolean)
);
export { ADMIN_WALLET_ADDRESSES_SET };

const validProductionEnvironments = ["production", "staging", "prod", "preview"];
const isProductionEnv = validProductionEnvironments.includes(config.NODE_ENV);

if (isProductionEnv && INSECURE_DEFAULTS.includes(config.CSRF_SECRET)) {
  console.error("[FATAL] CSRF_SECRET must not be a known insecure default in production. Set a strong secret (>= 32 chars).");
  process.exit(1);
}

if (config.FACILITATOR_MODE === "mock" && isProductionEnv) {
  throw new Error("FATAL: FACILITATOR_MODE=mock is not allowed in production or staging environments. Set FACILITATOR_MODE=live or run in development.");
}

if (isProductionEnv) {
  for (const key of ["TREASURY_BASE_ADDRESS"] as const) {
    if (PLACEHOLDER_ADDRESSES.includes(config[key])) {
      throw new Error(`FATAL: ${key}=${config[key]} is a placeholder address. Set a real address in production.`);
    }
  }
}

if (isProductionEnv && INSECURE_DEFAULTS.includes(config.JWT_SECRET)) {
  console.error("[FATAL] JWT_SECRET must not be a known insecure default in production. Set a strong secret (>= 32 chars).");
  process.exit(1);
}

if (isProductionEnv && config.JWT_SECRET.length < 40) {
  console.error("[FATAL] JWT_SECRET must be at least 40 characters in production for adequate entropy.");
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

if (isProductionEnv && (config.DATABASE_URL.includes("localhost") || !config.DATABASE_URL.includes("@"))) {
  throw new Error("[FATAL] DATABASE_URL must have proper credentials in production. Set a user:password@host in the connection string.");
}

if (isProductionEnv && !config.ONRAMP_WEBHOOK_SECRET) {
  console.warn("[ONRAMP] WARNING: ONRAMP_WEBHOOK_SECRET is not set. Webhook verification will fail unless ONRAMP_WEBHOOK_SECRET is explicitly configured.");
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
    const ALL_PROVIDERS_LIST = ["venice", "antseed", "litellm", "openrouter", "together", "deepinfra"];
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
