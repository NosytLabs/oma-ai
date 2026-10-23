import "dotenv/config";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { compress } from "hono/compress";
import { serve } from "@hono/node-server";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { eq } from "drizzle-orm";
import { config } from "./config.js";
import { securityHeaders } from "./middleware/security.js";
import { originGuard } from "./middleware/origin-guard.js";
import { logger } from "./lib/logger.js";
import { drainSettlementDlq, getSettlementDlqLength } from "./lib/dlq.js";
import { auth } from "./auth.js";
import { initAuth } from "./auth/middleware.js";
import { ensureCatalogLoaded } from "./inference/models.js";
import { ProviderError } from "./inference/provider-route.js";
import { authRoutes } from "./routes/auth.js";
import { modelRoutes } from "./routes/models.js";
import { healthRoutes } from "./routes/health.js";
import { metricsRoutes, metricsMiddleware } from "./routes/metrics.js";
import { opsRoutes } from "./routes/ops.js";
import { x402Routes } from "./x402/facilitator.js";
import { chatRoutes } from "./routes/chat/index.js";
import { anthropicRoutes } from "./routes/anthropic/index.js";
import { searchRoutes } from "./routes/search.js";
import { depositRoutes } from "./routes/deposit/index.js";
import { creditsRoutes } from "./routes/credits.js";
import { exportRoutes } from "./routes/export.js";
import { refundsRoutes } from "./routes/refunds.js";
import { adminRefundsRoutes } from "./routes/admin-refunds.js";
import { dailyUsageRoutes } from "./routes/daily-usage.js";
import { usageRoutes } from "./routes/usage.js";
import { usageSummaryRoutes } from "./routes/usage-summary.js";
import { adminTreasuryRoutes } from "./routes/admin-treasury.js";
import { openapiRoutes } from "./routes/openapi.js";
import { polarRoutes } from "./routes/polar.js";
import { adminRoutes } from "./routes/admin.js";
import type { OmaEnv } from "./types.js";
import { generateCorrelationId } from "./tracing.js";
import { rateLimit } from "./middleware/rate-limit.js";
import { demoModeGuard } from "./middleware/demo-mode-guard.js";
import { db } from "./db/client.js";
import { siteSettings, depositRecoveryState } from "./db/schema.js";
import { runRecoveryIteration } from "./lib/deposit-recovery.js";
import { getPublicClient } from "./lib/rpc-client.js";

// Fail-fast admin address validation. Runs at startup, not at module
// import, so test imports of the auth middleware don't exit the process.
initAuth();

// ---------------------------------------------------------------
// Neon Functions mode.
//
// This module also ships as the entrypoint for a Neon Function
// (`export default app` at the bottom). On Neon there is no
// long-lived HTTP server process: the platform owns the socket and
// invokes our `fetch`-handler per request, and it may cold-start /
// evict instances at any time. So we must NOT:
//   - call startServer() (would try to bind a port), or
//   - run an in-memory setInterval background loop (nothing to hold it,
//     and state is lost on eviction).
//
// Instead deposit recovery runs as a Neon Function Trigger (cron) that
// hits an internal route; the block cursor is persisted in Postgres so
// each run is stateless. `NEON_FUNCTION=1` is set in the neon.ts env.
// ---------------------------------------------------------------
const isNeonFunction = process.env.NEON_FUNCTION === "1";

// Deprecated runtime flag kept for old deployments; true when the
// platform is running us as a function (no PORT binding expected).
const runsAsHttpServer = !isNeonFunction && config.NODE_ENV !== "test";

// Boot-time model catalog load. Await so the server doesn't accept traffic
// before the catalog is ready — initial requests would fail with "Model not found".
ensureCatalogLoaded().then(startServerIfHttp).catch((err) => {
	logger.error({ err }, "[startup] model catalog load failed; starting server anyway (will retry on first request)");
	startServerIfHttp();
});

function startServerIfHttp() {
	if (runsAsHttpServer) {
		startServer();
	}
}

// Deposit recovery: inbound USDC transfers to the treasury address are
// matched against recorded deposits and credited on chain confirmation.
//
// HTTP mode (self-hosted / Coolify): a lightweight 30s in-memory loop with a
// concurrency guard. Only runs here — a Neon Function has no background loop.
//
// Neon Functions mode: recovery runs as a scheduler (Function Trigger cron)
// that POSTs to /internal/recover-deposits, which persists the block cursor
// in Postgres so each stateless invocation resumes from the last checkpoint.
if (runsAsHttpServer && config.USDC_DEPOSIT_ADDRESS) {
	const client = getPublicClient();
	let fromBlock = 0n;
	let isRunning = false;
	const runDepositRecovery = async (): Promise<void> => {
		// Concurrency guard. If an iteration takes longer than the 30s
		// interval (slow RPC, large block range), don't fire a second loop
		// that would race on `fromBlock` and waste RPC quota.
		if (isRunning) {
			logger.warn(
				"[deposit-recovery] previous iteration still running, skipping this tick",
			);
			return;
		}
		isRunning = true;
		try {
			if (fromBlock === 0n) {
				const current = await client.getBlockNumber();
				fromBlock = current > 1_000n ? current - 1_000n : 0n;
			}
			fromBlock = await runRecoveryIteration(client, config.USDC_DEPOSIT_ADDRESS as string, fromBlock);
		} catch (err) {
			logger.error({ err, fromBlock }, "[deposit-recovery] scheduled iteration failed");
		} finally {
			isRunning = false;
		}
	};
	void runDepositRecovery();
	setInterval(() => void runDepositRecovery(), 30_000).unref();
}


if (config.CORS_ORIGIN === "*" && config.NODE_ENV === "production") {
		logger.fatal("[SECURITY] CORS_ORIGIN='*' is not allowed in production. Refusing to start. Set specific origins (comma-separated).");
		process.exit(1);
}

const app = new Hono<OmaEnv>();

app.use("*", async (c, next) => {
		const correlationId = c.req.header("X-Correlation-ID") || generateCorrelationId();
		c.set("correlationId", correlationId);
		c.header("X-Request-ID", correlationId);
		await next();
});

app.use("*", compress());
app.use("*", securityHeaders);



const corsOptions = {
		origin: (origin: string | undefined): string | null => {
				if (!origin) return null;
				if (
						config.NODE_ENV === "development" &&
						(origin.startsWith("http://localhost") || origin.startsWith("http://127.0.0.1"))
				) {
						return origin;
				}
				const allowedOrigins = config.CORS_ORIGIN.split(",").map((o) => o.trim());
				for (const allowed of allowedOrigins) {
						if (allowed === "*") {
								logger.warn({ origin }, "[CORS] Wildcard origin '*' is set. Credentials will be denied by browsers. Set specific origins in production.");
								logger.info({ allowedOrigins }, "[CORS] Allowed origins loaded");
								return null;
						}
						try {
								const allowedUrl = new URL(allowed);
								const originUrl = new URL(origin);
								if (allowed === origin || allowedUrl.origin === originUrl.origin) return origin;
						} catch {
								// ignore
						}
				}
				return null;
		},
		credentials: true,
		allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
		// Include X-OMA-Source so website chat can identify itself for the free
		// daily tier (20 anon / 100 signed-in) vs API key auth (credit-billed).
		// Without this, CORS preflight rejects the browser request outright.
		allowHeaders: [
				"Content-Type",
				"Authorization",
				"PAYMENT-SIGNATURE",
				"PAYMENT-REQUIRED",
				"X-PAYMENT",
				"X-OMA-Source",
				"X-Correlation-ID",
				"X-Requested-With",
		],
		exposeHeaders: [
				"X-RateLimit-Limit",
				"X-RateLimit-Remaining",
				"X-RateLimit-Reset",
				// Expose the policy header so browser clients can tell a real Redis
				// limiter (header absent) from the degraded per-instance memory
				// store ("degraded-memory") or the fail-closed path ("limiter").
				// Without this, enforcement silently degrades and the browser
				// cannot observe it. See middleware/rate-limit/sliding-window.ts.
				"X-RateLimit-Policy",
				"Retry-After",
				"X-DailyLimit-Limit",
				"X-DailyLimit-Remaining",
				"X-DailyLimit-Reset",
				"X-Request-ID",
				"X-OMA-Request-ID",
				"PAYMENT-RESPONSE",
				"X-PAYMENT-RESPONSE",
				// OpenRouter-style routing transparency (read by website chat toast)
				"x-provider",
				"x-actual-model",
				"x-oma-fallback",
				"x-oma-requested-model",
		],
		maxAge: 86400,
};

// CORS must run BEFORE bodyLimit: an oversized request is rejected with 413 by
// bodyLimit, and if CORS had not yet added the Access-Control-* headers the
// browser would report an opaque network error instead of payload_too_large.
app.use("*", cors(corsOptions));

// SECURITY: only appear credentialed to allowlisted origins. Hono emits
// `Access-Control-Allow-Credentials: true` unconditionally; combined with a
// future wildcard ACAO fallback that would allow any site to make credentialed
// requests. Strip the header whenever no ACAO was granted for this request.
app.use("*", async (c, next) => {
	await next();
	if (!c.res.headers.get("Access-Control-Allow-Origin")) {
		c.res.headers.delete("Access-Control-Allow-Credentials");
	}
});

// SECURITY: without an explicit body limit, any route that calls
// c.req.json()/text()/arrayBuffer() will buffer an arbitrarily large
// request into memory first. A single oversized POST to /v1/chat/completions
// is enough to pressure the worker. 2 MiB comfortably covers a large
// multimodal/tool payload; anything larger should be chunked client-side.
app.use("*", bodyLimit({ maxSize: 2 * 1024 * 1024, onError: (c) =>
	c.json(
		{
			error: {
				message: "Request body is too large",
				type: "invalid_request_error",
				code: "payload_too_large",
			},
		},
		413,
	),
}));

app.use("*", metricsMiddleware);

// Global Maintenance Mode Check
app.use("*", async (c, next) => {
		const path = c.req.path;
		// Bypass maintenance mode for essential system & admin endpoints
		if (
				path.startsWith("/api/auth/") ||
				path === "/v1/site-settings" ||
				path.startsWith("/v1/admin") ||
				path === "/health" ||
				path === "/v1/health" ||
				path === "/live" ||
				path === "/version" ||
				path === "/health/db" ||
				path === "/ready" ||
				path === "/v1/metrics" ||
				path.startsWith("/.well-known")
		) {
				return await next();
		}

		try {
				const [settings] = await db.select({ maintenanceMode: siteSettings.maintenanceMode }).from(siteSettings).limit(1);
				if (settings?.maintenanceMode) {
						return c.json(
								{
										error: {
												message: "OMA-AI is currently undergoing scheduled maintenance. Please try again later.",
												type: "service_unavailable",
										},
								},
								503,
						);
				}
		} catch (err) {
				logger.error({ err }, "[maintenance] failed to check site settings");
		}

		await next();
});

// Demo mode guard — blocks mutations under /v1/* when the HttpOnly
// `oma-demo` cookie is present. See middleware/demo-mode-guard.ts
// for rationale. Mounted AFTER the maintenance check (so a 503 for
// maintenance still wins) and BEFORE route mounting (so it covers
// every /v1 mutation: deposit, checkout, keys, account, credits,
// admin, chat, etc. without per-route edits).
app.use("/v1/*", demoModeGuard);
app.use("/website/*", demoModeGuard);

// Public operational routes.
app.route("/", healthRoutes);
app.route("/", metricsRoutes);
app.route("/", opsRoutes);
app.route("/", openapiRoutes);

// ---------------------------------------------------------------------
// Internal: deposit-recovery ticker.
//
// Runs one deposit-recovery iteration and persists the block cursor in
// Postgres (`deposit_recovery_state`). In HTTP mode this is a manual/admin
// trigger; in Neon Functions mode it is the cron / Function-Trigger target so
// each invocation is stateless and resumes from the last checkpoint.
//
// Auth: accepts either a matching RECOVERY_TOKEN bearer token (admin / manual
// trigger) OR a Neon scheduled-invocation call identified by the trusted
// X-Neon-Trigger-Invocation-Id header (Neon strips client-set X-Neon-* headers,
// so its presence proves the call came from Neon's scheduler, which sends no
// credentials).
// Only trust that provenance inside the Neon runtime. Website proxy requests
// cannot qualify as scheduled invocations; local HTTP operators need the token.
// ---------------------------------------------------------------------
app.post("/internal/recover-deposits", async (c) => {
	const token = c.req.header("Authorization")?.replace(/^Bearer\s+/i, "") ?? "";
	const expected = process.env.RECOVERY_TOKEN;
	const fromNeonScheduler = process.env.NEON_FUNCTION === "1" &&
		!c.req.header("x-oma-proxy-secret") && Boolean(c.req.header("x-neon-trigger-invocation-id"));
	const authorized = fromNeonScheduler || (Boolean(expected) && token === expected);
	if (!authorized) {
		return c.json({ error: { message: "forbidden", type: "forbidden" } }, 403);
	}
	if (!config.USDC_DEPOSIT_ADDRESS) {
		return c.json({ error: { message: "deposit address not configured", type: "server_error" } }, 503);
	}
	try {
		const client = getPublicClient();
		// Load persisted cursor (defaults to a lookback behind head on first run).
		const [state] = await db
			.select({ lastBlock: depositRecoveryState.lastBlock })
			.from(depositRecoveryState)
			.where(eq(depositRecoveryState.depositAddress, config.USDC_DEPOSIT_ADDRESS))
			.limit(1);
		let fromBlock = state?.lastBlock ?? 0n;
		if (fromBlock === 0n) {
			const current = await client.getBlockNumber();
			fromBlock = current > 1_000n ? current - 1_000n : 0n;
		}
		const nextBlock = await runRecoveryIteration(client, config.USDC_DEPOSIT_ADDRESS, fromBlock);
		await db
			.insert(depositRecoveryState)
			.values({ depositAddress: config.USDC_DEPOSIT_ADDRESS, lastBlock: nextBlock })
			.onConflictDoUpdate({
				target: depositRecoveryState.depositAddress,
				set: { lastBlock: nextBlock },
			});
		return c.json({ fromBlock: fromBlock.toString(), processedThrough: nextBlock.toString() });
	} catch (err) {
		logger.error({ err }, "[deposit-recovery] internal ticker failed");
		return c.json({ error: { message: "deposit recovery failed", type: "server_error" } }, 500);
	}
});

// ---------------------------------------------------------------------
// Settlement DLQ drain.
//
// A settlement that was accepted on-chain but could not be persisted lands in
// the `settlement_dlq` table (Postgres-backed; see lib/dlq.ts). This route
// replays those rows into `settlements`. Before this existed the queue was
// write-only, so a failed persist was unrecoverable.
//
// Auth is identical to /internal/recover-deposits: either the Neon scheduler
// header (which Neon strips from clients) or the RECOVERY_TOKEN bearer.
// ---------------------------------------------------------------------
app.post("/internal/drain-settlement-dlq", async (c) => {
	const token = c.req.header("Authorization")?.replace(/^Bearer\s+/i, "") ?? "";
	const expected = process.env.RECOVERY_TOKEN;
	const fromNeonScheduler = process.env.NEON_FUNCTION === "1" &&
		!c.req.header("x-oma-proxy-secret") && Boolean(c.req.header("x-neon-trigger-invocation-id"));
	const authorized = fromNeonScheduler || (Boolean(expected) && token === expected);
	if (!authorized) {
		return c.json({ error: { message: "forbidden", type: "forbidden" } }, 403);
	}
	try {
		const result = await drainSettlementDlq();
		const remaining = await getSettlementDlqLength();
		if (result.recovered > 0 || result.abandoned > 0) {
			logger.info({ ...result, remaining }, "[DLQ] Settlement drain completed");
		}
		return c.json({ ...result, remaining });
	} catch (err) {
		logger.error({ err }, "[DLQ] Settlement drain failed");
		return c.json({ error: { message: "settlement drain failed", type: "server_error" } }, 500);
	}
});

// Better Auth — sign-in / sign-up / magic-link / anonymous / SIWE / session.
// Session *reads* (get-session) are high-frequency: every page mount calls
// useSession(). A shared 30/min bucket was starving SPA navigation and
// full-site audits after a few page loads. Split the buckets:
//   - GET get-session / session: generous (browser polling)
//   - everything else (magic-link, SIWE, sign-out…): still strict
const authSessionReadLimit = rateLimit({
		windowMs: 60_000,
		maxRequests: 600,
		keyPrefix: "auth-session",
		failClosed: false,
});
const authMutationLimit = rateLimit({
		windowMs: 60_000,
		maxRequests: 40,
		keyPrefix: "auth",
		// Fail open when Redis is unavailable so a Redis blip never bricks the
		// whole login flow (magic-link, SIWE, OTP). Abuse is still bounded by the
		// per-email `checkEmailSendCooldown` (which also fails open) and the
		// per-IP `extractClientIp` keying; on return of Redis, limiting resumes.
		failClosed: false,
	});
// CSRF: explicit Origin/Referer check for OMA's own session-authenticated
// mutations. Scoped to the exact cookie-authenticated mutation paths rather
// than app-wide, so the OpenAI-compatible gateway (bearer-token, called by
// SDKs and curl rather than browsers) is unaffected — a machine client sends
// no Origin and a blanket rule would reject it.
//
// These are the cookie-authenticated mutation routes a forged cross-site
// request could ride a victim's cookie into:
//   POST   /v1/keys, /v1/keys/install
//   DELETE /v1/keys/:id, /v1/history, /sessions, /sessions/:id
// Reads (GET /user, /sessions, /v1/keys) are deliberately not gated.
//
// SECURITY (audit 2026-09-27 / P1): the earlier list claimed "routes guarded
// only by sessionAuth" and missed the money + admin mutations that also
// authenticate by cookie — DELETE /account, POST /v1/deposit/usdc(+/challenge),
// POST /v1/checkout, and every POST /v1/admin/*. SameSite=Lax blocks some
// cross-site POSTs but not sibling-origin or widened-cookie-domain CSRF
// (origin-guard's own docstring says Lax is not a sufficient long-term control),
// so the Origin/Referer guard belongs on all of these too.
const csrfOriginGuard = originGuard();
for (const p of [
	"/v1/keys",
	"/v1/keys/*",
	"/v1/history",
	"/sessions",
	"/sessions/*",
	"/account",
	"/v1/deposit/usdc",
	"/v1/deposit/usdc/*",
	"/v1/checkout",
	"/v1/admin/*",
]) {
	app.use(p, csrfOriginGuard);
}
app.use("/api/auth/*", async (c, next) => {
		const path = c.req.path;
		const isSessionRead =
				c.req.method === "GET" &&
				(path.includes("get-session") ||
						path.endsWith("/session") ||
						path.includes("/get-session"));
		if (isSessionRead) {
				return authSessionReadLimit(c, next);
		}
		return authMutationLimit(c, next);
});
app.all("/api/auth/*", (c) => auth.handler(c.req.raw));

// Agent discovery is served by the frontend's /.well-known/agent-card.json.
// There is no Better Auth agent-configuration route in this deployment.

// OMA-specific auth-adjacent routes (CSRF, /user, /keys).
//
// These are OMA's own Hono handlers, not Better Auth's. Better Auth
// hardens its own endpoints; these are guarded only by `sessionAuth`, so
// they get an explicit Origin check on state-changing requests. The
// session cookie is SameSite=Lax, which blocks the classic cross-site
// POST, but Lax still permits same-site sibling origins and stops
// protecting this the moment the cookie's scope widens. Safe methods
// (GET/HEAD/OPTIONS) are unaffected, so reads and the page's own fetches
// are untouched.
app.route("/", authRoutes);

// OpenAI-compatible gateway surface.
app.route("/", modelRoutes);
app.route("/", chatRoutes);
app.route("/", anthropicRoutes);
app.route("/", searchRoutes);
app.route("/", depositRoutes);
app.route("/", exportRoutes);

app.route("/", refundsRoutes);
app.route("/", adminRefundsRoutes);

// Credit batches and history.
app.route("/", creditsRoutes);

// x402 payments.
app.route("/", x402Routes);

// Daily usage / quota endpoint for the website chat free-tier counter.
app.route("/", dailyUsageRoutes);
app.route("/", usageRoutes);
app.route("/", usageSummaryRoutes);
app.route("/", adminTreasuryRoutes);

// Polar.sh checkout + webhook (no auth on webhook routes; signature-verified).
// polarRoutes dual-mounts POST /webhooks/polar and POST /api/webhook/polar
// with the same rate-limited, signature-verified handler.
app.route("/", polarRoutes);

// Admin operator endpoints (site-settings, credit-adjust, user-suspend, list-users).
// All require session/bearer auth + requireAdmin().
app.route("/", adminRoutes);

app.notFound((c) =>
		c.json({ error: { message: `Route ${c.req.path} not found`, type: "not_found" } }, 404),
);

app.onError((err, c) => {
		if (err instanceof HTTPException) {
				return err.getResponse();
		}
		const correlationId = c.get("correlationId") as string | undefined;
		logger.error({ correlationId, err }, "[OMA] Unhandled error");
		const errWithStatus = err as Error & { status?: ContentfulStatusCode };
		const status = errWithStatus.status ?? 500;
		// 5xx with an explicit ProviderError message — surface it. These are
		// upstream-failure messages we crafted for users (e.g. "Backend
		// request timed out", "All model providers failed: ..."). Hiding them
		// as "Internal server error" leaves chat users staring at a silent
		// failure with no way to recover.
		if (status >= 500 && err instanceof ProviderError) {
				return c.json({ error: { message: errWithStatus.message, type: "server_error", correlationId } }, status as ContentfulStatusCode);
		}
		if (status >= 500) {
				return c.json({ error: { message: "Internal server error", type: "server_error", correlationId } }, 500);
		}
		const safeClientStatuses: ContentfulStatusCode[] = [400, 401, 403, 404, 409, 422, 429];
		if (safeClientStatuses.includes(status)) {
				return c.json({ error: { message: err.message, type: "client_error" } }, status);
		}
		return c.json({ error: { message: "Client error", type: "client_error" } }, status);
});

function startServer() {
		const server = serve({
				fetch: app.fetch,
				port: config.PORT,
		}, (info) => {
				logger.info({ port: info.port }, "[OMA] API server running");
				logger.info({ healthUrl: `http://localhost:${info.port}/health` }, "[OMA] Health endpoint");
				logger.info({ modelsUrl: `http://localhost:${info.port}/v1/models` }, "[OMA] Models endpoint");
		});

		server.on("error", (err: NodeJS.ErrnoException) => {
				if (err.code === "EADDRINUSE") {
						logger.error(
								{ port: config.PORT },
								`[OMA] FATAL: port ${config.PORT} is already in use`,
						);
						process.exit(1);
				}
				throw err;
		});

		const shutdown = async (signal: string) => {
				logger.info({ signal }, "[OMA] Shutdown signal received, closing gracefully...");
				server.close(async () => {
						logger.info("[OMA] HTTP server closed");
						try {
							const { closeRedisClient } = await import("./lib/redis-client.js");
							await closeRedisClient();
						} catch (err) {
							logger.warn({ error: err }, "[OMA] Redis close error");
						}
						try {
							const { closeDb } = await import("./db/client.js");
							await closeDb();
						} catch (err) {
							logger.warn({ error: err }, "[OMA] DB close error");
						}
						process.exit(0);
				});
				setTimeout(() => {
						logger.error("[OMA] Forced shutdown after timeout");
						process.exit(1);
				}, 10_000);
		};

		if (config.NODE_ENV !== "test") {
				process.on("SIGTERM", () => shutdown("SIGTERM"));
				process.on("SIGINT", () => shutdown("SIGINT"));
				process.on("unhandledRejection", (reason) => {
						logger.fatal({ err: reason }, "Unhandled promise rejection — shutting down");
						shutdown("unhandledRejection");
				});
				process.on("uncaughtException", (err) => {
						logger.fatal({ err }, "Uncaught exception — shutting down");
						shutdown("uncaughtException");
				});
		}
}

export default app;
