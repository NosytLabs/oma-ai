import { z } from "zod";
import { PLACEHOLDER_ADDRESSES } from "./constants.js";

const INSECURE_DEFAULTS = [
		"dev-secret-change-me-in-prod-32ch",
		"changeme",
		"secret",
		"jwt-secret",
		"dev-receipt-hmac-placeholder",
		"placeholder_hmac_secret_32_chars_min",
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
		// OMA-AI resale upstream (branded "oma-ai" to users):
		//   OPENBROKER_* → api.openbroker.gonka.gg — MiniMax-M2.7, Kimi-K2.6, etc.
		// (Zyloo was previously a sister upstream; removed 2026-08-17.)

		LITELLM_API_KEY: z.string().min(1).optional(),
		LITELLM_API_URL: z.string().url().optional().default("http://localhost:4000/v1"),
		OPENBROKER_API_KEY: z.string().min(1).optional(),
		// Local/dev aliases — Gonka issues keys as GONKA_API_KEY or OBK_API_KEY.
		GONKA_API_KEY: z.string().min(1).optional(),
		OBK_API_KEY: z.string().min(1).optional(),
		OPENBROKER_API_URL: z.string().url().optional().default("https://api.openbroker.gonka.gg"),
		// Surplus Intelligence (https://api.surplusintelligence.ai) — marketplace
		// resale upstream. Opt-in: leave SURPLUS_API_KEY unset to disable the Surplus
		// catalog entirely (provider is never selected for real traffic).
		SURPLUS_API_KEY: z.string().min(1).optional(),
		SURPLUS_API_URL: z.string().url().optional().default("https://api.surplusintelligence.ai"),
		// Allow Venice non-private mode. By default all Venice requests set
		// venice_parameters.private=true. Set OMMA_ALLOW_NON_PRIVATE_VENICE=true to
		// let callers opt out per-request (private:false) for non-sensitive traffic.
		// Production should leave this unset (defaults to false).
		OMMA_ALLOW_NON_PRIVATE_VENICE: envBoolean.default(false),
		// Surplus Intelligence (api.surplusintelligence.ai) is the only opt-in
		// non-private resale upstream. It's gated behind SURPLUS_API_KEY — when unset,
		// Surplus catalog entries are not selected for traffic. Trust/security notes
		// live in the header comment of src/inference/models.ts.
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
		CORS_ORIGIN: z.string().default("http://localhost:3000,http://localhost:3003"),
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
		RECEIPT_HMAC_SECRET: z.string().min(1).optional().default("placeholder_hmac_secret_32_chars_min"),
		NODE_ENV: z.enum(["development", "production", "test", "staging", "preview"]).default("development"),
		// Log level for the server logger (trace, debug, info, warn, error, fatal)
		LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).optional(),

		// API key expiration (0 = never expires)
		DEFAULT_KEY_EXPIRY_DAYS: z.coerce.number().min(0).default(90),

		// Admin wallet addresses (comma-separated, checks on every admin route)
		ADMIN_WALLET_ADDRESSES: z.string().optional().default(""),

		// Base mainnet chain ID
		BASE_CHAIN_ID: z.coerce.number().int().positive().default(8453),

		// Free signup credit — credits minted to a brand-new user on first
		// sign-in. 100 = $1.00 at 1 credit = 1 cent. Set to 0 to disable the
		// free trial. Without this, /v1/balance reads 0 forever and users
		// hit "insufficient_balance" on their first real call.
		FREE_SIGNUP_CENTS: z.coerce.number().min(0).max(100000).default(100),

		// OpenTelemetry configuration
		OTEL_EXPORTER_OTLP_ENDPOINT: z.string().min(1).default("http://localhost:4318").optional(),
		OTEL_SERVICE_NAME: z.string().min(1).default("oma-server").optional(),

		// Optional path whose directory holds models-overrides.json (runtime catalog is code-loaded).
		MODELS_CONFIG_PATH: z.string().optional(),

		// Optional path to a per-model overrides sidecar (input/output price,
		// free-chat status). Read on every request so operators can hot-patch
		// pricing without redeploying. Consumed by src/lib/model-overrides.ts.
		MODEL_OVERRIDES_PATH: z.string().optional(),

		// Trusted proxy IPs for X-Forwarded-For validation (comma-separated)
		// Only trust X-Forwarded-For headers from these known proxy IPs
		TRUSTED_PROXY_IPS: z.string().optional().default(""),

		// Build metadata (injected at build time)
		BUILD_SHA: z.string().optional().default("dev"),
		BUILD_TIME: z.string().optional().default(() => new Date().toISOString()),

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
});

export type Config = z.infer<typeof envSchema>;

function usableProviderKey(key: string | undefined): boolean {
		if (!key || key.length < 16) return false;
		if (/placeholder|changeme|your-key|example/i.test(key)) return false;
		if (/^(plch-|your-|dev-)/i.test(key)) return false;
		if (/^(openbroker_|surplus_)(placeh|changeme|your|xxx|dummy)/i.test(key)) {
			return false;
		}
		return true;
}

// Parse, then fold QuickNode RPC aliases into CHAIN_RPC_URL so every consumer
// only needs to read CHAIN_RPC_URL / CHAIN_RPC_URL_FALLBACK.
const _parsed = envSchema.parse(process.env);
export const config: Config = {
		..._parsed,
		RESEND_API_KEY: usableProviderKey(_parsed.RESEND_API_KEY)
				? _parsed.RESEND_API_KEY
				: undefined,
		CHAIN_RPC_URL: _parsed.QUICKNODE_RPC_URL ?? _parsed.CHAIN_RPC_URL,
		CHAIN_RPC_URL_FALLBACK:
				_parsed.QUICKNODE_RPC_URL_FALLBACK ?? _parsed.CHAIN_RPC_URL_FALLBACK,
		// Prefer explicit USDC_DEPOSIT_ADDRESS; otherwise reuse the Base treasury
		// so local/prod setups with only TREASURY_BASE_ADDRESS still accept deposits.
		USDC_DEPOSIT_ADDRESS:
				_parsed.USDC_DEPOSIT_ADDRESS ?? _parsed.TREASURY_BASE_ADDRESS,
		// Gonka ships keys as GONKA_API_KEY / OBK_API_KEY. Fold those into
		// OPENBROKER_API_KEY when the dedicated var is missing or a placeholder.
		OPENBROKER_API_KEY: usableProviderKey(_parsed.OPENBROKER_API_KEY)
				? _parsed.OPENBROKER_API_KEY
				: _parsed.GONKA_API_KEY ?? _parsed.OBK_API_KEY,
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

// SECURITY (audit 7.6): Reject dev-grade placeholder prefixes in any
// non-development environment. `staging-` and `preview-` are easy to
// typo into production by accident, and the placeholder format is
// obvious enough to leak via secret scans if misconfigured.
const BETTER_AUTH_PLACEHOLDER_PREFIXES = ["dev-", "staging-", "preview-", "test-"];
if (
		isProductionEnv &&
		BETTER_AUTH_PLACEHOLDER_PREFIXES.some((prefix) => config.BETTER_AUTH_SECRET.startsWith(prefix))
) {
		console.error(
				`[FATAL] BETTER_AUTH_SECRET must not start with a dev/staging/preview/test prefix in production. Run \`openssl rand -hex 32\` and set the result.`,
		);
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
		if (
			PLACEHOLDER_ADDRESSES.includes(treasuryAddress) ||
			/^0x0{39}[0-9a-f]$/i.test(treasuryAddress)
		) {
			throw new Error("FATAL: TREASURY_BASE_ADDRESS is a placeholder address. Set a real address in production.");
		}
		if (config.USDC_DEPOSIT_ADDRESS && (
			PLACEHOLDER_ADDRESSES.includes(config.USDC_DEPOSIT_ADDRESS) ||
			/^0x0{39}[0-9a-f]$/i.test(config.USDC_DEPOSIT_ADDRESS)
		)) {
			throw new Error("FATAL: USDC_DEPOSIT_ADDRESS is a placeholder address. Set a real address in production.");
		}
	}

// SECURITY (audit 7.5): Reject Polar sandbox mode in production. Operators
// who accidentally point POLAR_SERVER=sandbox at the production build will
// silently collect revenue into a sandbox account — never the operator's
// real merchant of record. Fail-fast at startup.
if (isProductionEnv && config.POLAR_SERVER === "sandbox") {
		console.error(
				"[FATAL] POLAR_SERVER='sandbox' is not allowed in production. Set POLAR_SERVER='production' or unset (defaults to production).",
		);
		process.exit(1);
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

if (isProductionEnv && !config.RECEIPT_HMAC_SECRET) {
		console.error("[FATAL] RECEIPT_HMAC_SECRET must be set in production environments.");
		process.exit(1);
}

if (isProductionEnv && INSECURE_DEFAULTS.includes(config.RECEIPT_HMAC_SECRET)) {
		console.error("[FATAL] RECEIPT_HMAC_SECRET must not be a known insecure default in production. Set a strong secret.");
		process.exit(1);
}

if (config.NODE_ENV !== "test" && !isProductionEnv && config.RECEIPT_HMAC_SECRET === "placeholder_hmac_secret_32_chars_min") {
		console.warn("[oma-config] WARNING: RECEIPT_HMAC_SECRET is the development placeholder. Set a strong secret before deploying to production (NODE_ENV=production/staging/preview).");
}

if (isProductionEnv && (config.DATABASE_URL.includes("localhost") || !config.DATABASE_URL.includes("@"))) {
		throw new Error("[FATAL] DATABASE_URL must have proper credentials in production. Set a user:password@host in the connection string.");
}
