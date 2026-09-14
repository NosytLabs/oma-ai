import "dotenv/config";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { compress } from "hono/compress";
import { serve } from "@hono/node-server";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { config } from "./config.js";
import { securityHeaders } from "./middleware/security.js";
import { logger } from "./lib/logger.js";
import { auth } from "./auth.js";
import { initAuth } from "./auth/middleware.js";
import { ensureCatalogLoaded } from "./inference/models.js";
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
import { dailyUsageRoutes } from "./routes/daily-usage.js";
import { usageRoutes } from "./routes/usage.js";
import { openapiRoutes } from "./routes/openapi.js";
import { polarRoutes } from "./routes/polar.js";
import { adminRoutes } from "./routes/admin.js";
import type { OmaEnv } from "./types.js";
import { generateCorrelationId } from "./tracing.js";
import { rateLimit } from "./middleware/rate-limit.js";
import { demoModeGuard } from "./middleware/demo-mode-guard.js";
import { db } from "./db/client.js";
import { siteSettings } from "./db/schema.js";
import { runRecoveryIteration } from "./lib/deposit-recovery.js";
import { getPublicClient } from "./lib/rpc-client.js";

// Fail-fast admin address validation. Runs at startup, not at module
// import, so test imports of the auth middleware don't exit the process.
initAuth();

// Boot-time model catalog load. Await so the server doesn't accept traffic
// before the catalog is ready — initial requests would fail with "Model not found".
ensureCatalogLoaded()
		.then(() => {
				startServer();
		})
		.catch((err) => {
				logger.error({ err }, "[startup] model catalog load failed; starting server anyway (will retry on first request)");
				startServer();
		});

if (config.NODE_ENV !== "test" && config.USDC_DEPOSIT_ADDRESS) {
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
				"Retry-After",
				"X-DailyLimit-Limit",
				"X-DailyLimit-Remaining",
				"X-DailyLimit-Reset",
				"X-Request-ID",
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

app.use("*", cors(corsOptions));
app.use("*", metricsMiddleware);

// Global Maintenance Mode Check
app.use("*", async (c, next) => {
		const path = c.req.path;
		// Bypass maintenance mode for essential system & admin endpoints
		if (
				path.startsWith("/api/auth/") ||
				path === "/v1/site-settings" ||
				path.startsWith("/v1/admin") ||
				path === "/v1/health" ||
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

// Public operational routes.
app.route("/", healthRoutes);
app.route("/", metricsRoutes);
app.route("/", opsRoutes);
app.route("/", openapiRoutes);

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
});
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

// Agent Auth Protocol discovery document. The plugin serves it under the
// /api/auth basePath but advertises the well-known path, so forward it.
app.get("/.well-known/agent-configuration", (c) => {
		const url = new URL(c.req.url);
		url.pathname = "/api/auth/agent-configuration";
		return auth.handler(new Request(url, c.req.raw));
});

// OMA-specific auth-adjacent routes (CSRF, /user, /keys).
app.route("/", authRoutes);

// OpenAI-compatible gateway surface.
app.route("/", modelRoutes);
app.route("/", chatRoutes);
app.route("/", anthropicRoutes);
app.route("/", searchRoutes);
app.route("/", depositRoutes);
app.route("/", exportRoutes);

// Credit batches and history.
app.route("/", creditsRoutes);

// x402 payments.
app.route("/", x402Routes);

// Daily usage / quota endpoint for the website chat free-tier counter.
app.route("/", dailyUsageRoutes);
app.route("/", usageRoutes);

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
		logger.error({ correlationId, error: err.message }, "[OMA] Unhandled error");
		const errWithStatus = err as Error & { status?: ContentfulStatusCode };
		const status = errWithStatus.status ?? 500;
		// 5xx with an explicit ProviderError message — surface it. These are
		// upstream-failure messages we crafted for users (e.g. "Backend
		// request timed out", "All model providers failed: ..."). Hiding them
		// as "Internal server error" leaves chat users staring at a silent
		// failure with no way to recover.
		if (status >= 500 && errWithStatus.message && errWithStatus.message !== "Internal server error") {
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
