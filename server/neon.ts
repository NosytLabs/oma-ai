/**
 * Neon Functions deployment manifest (infra-as-code) for the OMA-AI backend.
 *
 * Deploys the Hono API (`src/index.ts` -> `export default app`) as a Neon
 * Function so it runs next to the branch's Postgres, with DATABASE_URL and all
 * Neon service credentials injected automatically (see
 * https://neon.com/docs/compute/functions/environment-variables).
 *
 * Uses defineConfig from @neon/config/v1 (typed against the installed package).
 * Schema reference (types.d.ts): `functions` keyed by branch-unique slug
 * (^[a-z0-9]{1,20}$), `triggers` keyed by branch-unique name.
 *
 * Usage (from this package):
 *   export NEON_API_KEY=...                          # from .hermes/.env or CI secret
 *   neon config plan --config server/neon.ts         # preview changes (no apply)
 *   neon deploy --config server/neon.ts --update-existing
 *
 * Docs:
 *   - https://neon.com/docs/compute/functions/overview
 *   - https://neon.com/docs/compute/functions/deploy
 *   - https://neon.com/docs/compute/functions/triggers/schedule
 */
import { defineConfig } from "@neon/config/v1";

// Forward the app secrets/configuration that Neon does NOT inject (they are
// snapshotted onto the deployed function from process.env at deploy time).
//
// Injected by Neon automatically (leave unset here): DATABASE_URL,
// DATABASE_URL_UNPOOLED, NEON_BRANCH, NEON_AUTH_*, NEON_AI_GATEWAY_*, AWS_*.
const APP_VARS = [
	"NODE_ENV",
	"NEON_FUNCTION",
	"PORT",
	"CORS_ORIGIN",
	"PUBLIC_API_URL",
	"PUBLIC_APP_URL",
	"PRIMARY_DOMAIN",
	"BETTER_AUTH_URL",
	"ENCRYPTION_KEY",
	"BETTER_AUTH_SECRET",
	// Authenticates the Vercel -> Neon hop so the function can trust Vercel's
	// forwarded client IP. Omitting it here made the function boot-fail on the
	// production guard, because fnEnv() only forwards the vars listed here --
	// having it in the shell/.env file is not sufficient.
	"INTERNAL_PROXY_SECRET",
	"INTERNAL_PROXY_SECRET_PREVIOUS",
	"OPENBROKER_API_KEY",
	"GONKA_API_KEY",
	"OBK_API_KEY",
	"OPENBROKER_API_URL",
	"VENICE_API_KEY",
	"UPSTASH_REDIS_REST_URL",
	"UPSTASH_REDIS_REST_TOKEN",
	"REDIS_TOKEN",
	"OMMA_ALLOW_NON_PRIVATE_VENICE",
	"QUICKNODE_RPC_URL",
	"QUICKNODE_RPC_URL_FALLBACK",
	"CHAIN_RPC_URL",
	"CHAIN_RPC_URL_FALLBACK",
	"ETH_RPC_URL",
	"FACILITATOR_MODE",
	"X402_FACILITATOR_PROVIDER",
	"TREASURY_BASE_ADDRESS",
	"FACILITATOR_PRIVATE_KEY",
	"RECEIPT_HMAC_SECRET",
	"RECEIPT_HMAC_SECRET_PREVIOUS",
	"FREE_SIGNUP_CENTS",
	"USDC_DEPOSIT_ADDRESS",
	"USDC_DEPOSIT_NETWORK",
	"USDC_DEPOSIT_MIN_CENTS",
	"USDC_DEPOSIT_MAX_CENTS",
	"POLAR_ACCESS_TOKEN",
	"POLAR_WEBHOOK_SECRET",
	"POLAR_ORGANIZATION_ID",
	"POLAR_SERVER",
	"POLAR_HOBBY_PRODUCT_ID",
	"POLAR_BUILDER_PRODUCT_ID",
	"POLAR_SCALE_PRODUCT_ID",
	"ADMIN_WALLET_ADDRESSES",
	"RESEND_API_KEY",
	"RESEND_FROM",
	// Shared secret authorizing manual invocations of POST /internal/recover-deposits.
	// The Neon scheduled trigger is authorized by the trusted X-Neon-Trigger-Invocation-Id
	// header instead (Neon strips client-set X-Neon-* headers).
	"RECOVERY_TOKEN",
	// Serverless (REST) Redis for rate-limit / x402 replay / DLQ. Neon Functions
	// has no Redis, so this points at a serverless provider such as Upstash.
	"REDIS_URL",
] as const;

function fnEnv(): Record<string, string> {
	const env: Record<string, string> = {};
	for (const key of APP_VARS) {
		const v = process.env[key];
		if (v !== undefined) env[key] = v;
	}
	return env;
}

export default defineConfig({
	functions: {
		omaapi: {
			name: "OMA-AI API",
			source: "./src/index.ts",
			env: fnEnv(),
		},
	},
	triggers: {
		// Deposit recovery, every 15 minutes (was every minute; the per-minute
		// schedule kept Neon compute awake 24/7 and burned the free CU-hour allowance).
		// Invokes POST /internal/recover-deposits, which persists the block cursor
		// in Postgres so each run is stateless and resumes from the last checkpoint.
		"oma-deposit-recovery": {
			type: "schedule",
			function: "omaapi",
			cron: "*/15 * * * *",
			functionPath: "/internal/recover-deposits",
		},
		// Replays settlements that were accepted on-chain but failed to
		// persist. Every 15 minutes: the queue is normally empty, and each entry
		// backs off exponentially on repeated failure, so this is cheap.
		"oma-settlement-dlq": {
			type: "schedule",
			function: "omaapi",
			cron: "*/15 * * * *",
			functionPath: "/internal/drain-settlement-dlq",
		},
	},
});
