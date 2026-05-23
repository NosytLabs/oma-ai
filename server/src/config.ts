import { z } from "zod";
import { PLACEHOLDER_ADDRESSES } from "./constants.js";

const INSECURE_DEFAULTS = [
  "dev-secret-change-me-in-prod-32ch",
  "changeme",
  "secret",
  "jwt-secret",
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
  HOUDINI_API_KEY: z.string().min(1).optional(),
  HOUDINI_API_SECRET: z.string().min(1).optional(),
  HOUDINI_PARTNER_ID: z.string().min(1).optional(),
  HOUDINI_WEBHOOK_SECRET: z.string().min(1).optional(),
  HOUDINI_API_URL: z.string().min(1).default("https://api-partner.houdiniswap.com/v2"),
  HOUDINI_WS_URL: z.string().min(1).default("wss://partner-api.houdiniswap.com/v2/ws"),
  HOUDINI_ADDRESS_TO: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  CHEAPTOKENS_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  CHAIN_RPC_URL: z.string().min(1).optional().default("https://mainnet.base.org"),
  AERODROME_POOL_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  SOLANA_RPC_URL: z.string().min(1).default("https://api.mainnet-beta.solana.com"),
  FACILITATOR_MODE: z.enum(["mock", "live"]).default("mock"),
  FACILITATOR_PRIVATE_KEY: z.string().min(1).optional(),
  TREASURY_SOLANA_ADDRESS: z.string().min(1).optional(),
  TREASURY_BASE_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/).default("0x3333333333333333333333333333333333333333"),
  PORT: z.coerce.number().default(3001),
  JWT_SECRET: z.string().min(32).default("dev-secret-change-me-in-prod-32ch"),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  ONRAMP_WEBHOOK_SECRET: z.string().min(1).optional(),
  RECEIPT_HMAC_SECRET: z.string().min(1).optional(),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  AUTO_RELOAD_THRESHOLD: z.coerce.number().positive().default(50000),
  AUTO_RELOAD_AMOUNT: z.coerce.number().positive().default(1000000),
  AUTO_RELOAD_SPEND_LIMIT: z.coerce.number().positive().default(1000000),
  OMA_PRICE_OVERRIDE: z.coerce.number().positive().optional(),
  SPEND_LIMIT_DAILY_CENTS: z.coerce.number().positive().default(10000),

  // Credit system: $1 = $1 (1 dollar = 1 dollar, no conversion math)
  CREDIT_VALUE_PER_DOLLAR: z.coerce.number().default(1),
  CREDIT_PRICE_PER_TOKEN: z.coerce.number().default(0.000001),
  CREDIT_EXPIRY_DAYS: z.coerce.number().positive().default(365),
  CREDIT_BATCH_EXPIRY_DAYS: z.coerce.number().positive().default(365),

  // Admin wallet addresses (comma-separated, checks on every admin route)
  ADMIN_WALLET_ADDRESSES: z.string().optional().default(""),

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
});

export type Config = z.infer<typeof envSchema>;

export const config: Config = envSchema.parse(process.env);

const validProductionEnvironments = ["production", "staging", "prod", "preview"];
const isProductionEnv = validProductionEnvironments.includes(config.NODE_ENV);

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
