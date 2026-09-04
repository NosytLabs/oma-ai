/**
	* Better Auth — single source of truth for OMA-AI user authentication.
	*
	* Plugins:
	*   - magicLink:  passwordless email sign-in via Resend
	*   - siwe:       Sign-In With Ethereum (EIP-4361) — binds a wallet to the
	*                 user row and recovers ENS names + avatars via viem.
	*   - admin:      Self-hosted admin — roles, ban/unban, impersonation, user management.
	*   - emailOTP:   One-time passwords for sign-in, email verification, and password reset.
	*   - agentAuth:  Agent-level auth with delegated/autonomous capability execution.
	*   - apiKey:     API key management for programmatic access (create, verify, list, revoke).
	*
	* Mounted by index.ts at `/api/auth/*`. Hono wraps the Fetch-style handler
	* directly. Server-side session reads in non-handler code use
	* `auth.api.getSession({ headers })`.
	*/
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import {
	magicLink,
	siwe,
	emailOTP,
	admin,
} from "better-auth/plugins";
import { agentAuth as agentAuthPlugin } from "@better-auth/agent-auth";
import { verifyMessage, createPublicClient, http, getAddress } from "viem";
import { mainnet } from "viem/chains";
import { generateRandomString } from "better-auth/crypto";
import { sql } from "drizzle-orm";
import { db } from "./db/client.js";
import * as schema from "./db/schema.js";
import { creditBalances, creditGrants } from "./db/schema.js";
import { config } from "./config.js";
import { logger } from "./lib/logger.js";
import { ensureCatalogLoaded, listAllModels } from "./inference/models.js";
import { getRedisClient } from "./lib/redis-client.js";

const RESEND_FROM = config.RESEND_FROM ?? "OMA-AI <noreply@nosytlabs.com>";

// SECURITY (audit 1.2): per-email cooldown for magic-link + email-OTP sends.
// Without this, the IP-level 40/min bucket lets an attacker flood any inbox
// at the same rate. Cooldown: 60s for OTP, 60s for magic link. When Redis is
// down we fail OPEN so we don't lock everyone out, but the IP bucket still
// gates the request.
const EMAIL_SEND_COOLDOWN_SECONDS = 60;

export async function checkEmailSendCooldown(
	email: string,
	kind: "magic" | "otp",
): Promise<{ ok: true } | { ok: false; retryAfter: number }> {
	const normalized = email.trim().toLowerCase();
	const key = `auth:cooldown:${kind}:${normalized}`;
	const redis = await getRedisClient();
	if (!redis) {
		// Fail open if Redis is down — the IP-level mutation bucket
		// (40/min) is the secondary gate.
		return { ok: true };
	}
	try {
		const set = await redis.set(key, "1", { NX: true, EX: EMAIL_SEND_COOLDOWN_SECONDS });
		if (set === "OK") return { ok: true };
		const ttl = await redis.ttl(key);
		return { ok: false, retryAfter: ttl > 0 ? ttl : EMAIL_SEND_COOLDOWN_SECONDS };
	} catch (err) {
		logger.warn({ err, kind, email: normalized }, "[auth] email cooldown check failed; fail-open");
		return { ok: true };
	}
}

/**
	* Free-trial credit grant — recorded against the email so the grant
	* survives user deletion.
	*
	* SECURITY (audit 1.3 / CRITICAL): The legacy `databaseHooks.user.create.after`
	* path credited `creditBalances` on every new user; an attacker could
	* sign up → delete → re-signup the same email to farm `$1` per cycle
	* because FK cascade wiped the balance row. Recording the grant against
	* `lower(email)` (via `creditGrants` with a unique index on
	* (emailNormalized, grantType)) makes the trial one-shot per email,
	* even if the user row is deleted.
	*
	* Returns true if the trial was newly granted, false if it was already
	* recorded (no-op). On DB error returns false and logs (the auth signup
	* still proceeds so we never block a real user on a transient blip).
	*/
async function grantFreeTrialOnce(email: string, cents: number, userId: string): Promise<boolean> {
	if (cents <= 0) return false;
	const normalized = email.trim().toLowerCase();
	try {
		await db.transaction(async (tx) => {
			const inserted = await tx
				.insert(creditGrants)
				.values({
					emailNormalized: normalized,
					userId,
					grantType: "free_signup",
					cents: cents.toString(),
				})
				.onConflictDoNothing({
					target: [creditGrants.emailNormalized, creditGrants.grantType],
				})
				.returning({ id: creditGrants.id });

			if (inserted.length === 0) {
				// Already granted for this email — do nothing.
				return;
			}

			await tx
				.insert(creditBalances)
				.values({
					userId,
					balanceCents: cents.toString(),
					totalDepositedCents: cents.toString(),
					totalUsedCents: "0",
				})
				.onConflictDoUpdate({
					target: creditBalances.userId,
					set: {
						balanceCents: sql`${creditBalances.balanceCents}::numeric + ${cents}::numeric`,
						totalDepositedCents: sql`${creditBalances.totalDepositedCents}::numeric + ${cents}::numeric`,
						lastActivityAt: sql`NOW()`,
					},
				});
		});
		return true;
	} catch (err) {
		logger.warn(
			{ err, email: normalized },
			"[auth] failed to record free-trial credit grant",
		);
		return false;
	}
}

async function sendMagicLink({
	email,
	url,
}: {
	email: string;
	url: string;
	token: string;
	metadata?: Record<string, unknown>;
}): Promise<void> {
	const cooldown = await checkEmailSendCooldown(email, "magic");
	if (!cooldown.ok) {
		throw new Error(
			`A magic link was sent to this address ${cooldown.retryAfter}s ago. Please wait before requesting another.`,
		);
	}
	// Dev / failover — log the magic-link URL only when Resend is unset in
	// non-production. Never put bearer-like login URLs in production logs;
	// a configured sender failure is surfaced as an auth failure instead.
	const sendViaResend = async () => {
		const res = await fetch("https://api.resend.com/emails", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${config.RESEND_API_KEY}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				from: RESEND_FROM,
				to: email,
				subject: "Sign in to OMA-AI",
				html: renderMagicLinkEmail(url),
				text: `Sign in to OMA-AI\n\nClick this link to sign in (expires in 5 minutes):\n${url}\n\nIf you didn't request this, ignore this email.`,
			}),
		});
		if (!res.ok) {
			const body = await res.text().catch(() => "");
			throw new Error(`[magicLink] Resend ${res.status}: ${body.slice(0, 200)}`);
		}
	};

	if (!config.RESEND_API_KEY) {
		if (config.NODE_ENV === "production" || config.NODE_ENV === "staging" || config.NODE_ENV === "preview") {
			logger.error({ email }, "[magicLink] RESEND_API_KEY is not configured");
			throw new Error("Magic-link delivery is not configured");
		}
		logger.info(
			{ email, magicLink: url },
			"[magicLink] (dev) no RESEND_API_KEY set — click the URL to sign in",
		);
		return;
	}
	try {
		await sendViaResend();
	} catch (err) {
		if (config.NODE_ENV === "production" || config.NODE_ENV === "staging" || config.NODE_ENV === "preview") {
			logger.error({ err: (err as Error).message, email }, "[magicLink] Resend delivery failed");
			throw err;
		}
		logger.warn(
			{ err: (err as Error).message, email, magicLink: url },
			"[magicLink] Resend failed — falling back to console log in development",
		);
	}
}

function renderMagicLinkEmail(url: string): string {
		return `<!doctype html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:40px 20px;color:#0a0a0a;background:#fafafa">
		<div style="background:#0a0a0a;padding:32px 24px;border-radius:12px;text-align:center;margin-bottom:24px">
				<div style="font-family:ui-monospace,monospace;font-size:14px;letter-spacing:0.2em;color:#10b981;text-transform:uppercase">OMA-AI</div>
		</div>
		<h1 style="font-size:20px;font-weight:600;margin:0 0 12px">Sign in to OMA-AI</h1>
		<p style="margin:0 0 24px;color:#555">Click the button below to sign in. The link expires in 5 minutes.</p>
		<p style="margin:0 0 32px">
				<a href="${url}" style="display:inline-block;background:#10b981;color:#0a0a0a;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Sign in</a>
		</p>
		<p style="margin:0 0 6px;color:#888;font-size:12px">Or paste this URL into your browser:</p>
		<p style="margin:0 0 24px;font-family:ui-monospace,monospace;font-size:11px;background:#f0f0f0;padding:8px;border-radius:4px;word-break:break-all">${url}</p>
		<p style="margin:0;color:#aaa;font-size:11px">If you didn't request this, you can safely ignore this email.</p>
</body></html>`;
}

function renderOTPEmail(email: string, otp: string, type: string): string {
		const title =
				type === "forget-password"
						? "Reset your OMA-AI password"
						: type === "email-verification"
								? "Verify your email"
								: "Sign in to OMA-AI";
		const body =
				type === "forget-password"
						? "Use this code to reset your password. It expires in 5 minutes."
						: type === "email-verification"
								? "Use this code to verify your email address."
								: "Use this code to sign in. It expires in 5 minutes.";
		return `<!doctype html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:40px 20px;color:#0a0a0a;background:#fafafa">
		<div style="background:#0a0a0a;padding:32px 24px;border-radius:12px;text-align:center;margin-bottom:24px">
				<div style="font-family:ui-monospace,monospace;font-size:14px;letter-spacing:0.2em;color:#10b981;text-transform:uppercase">OMA-AI</div>
		</div>
		<h1 style="font-size:20px;font-weight:600;margin:0 0 12px">${title}</h1>
		<p style="margin:0 0 24px;color:#555">${body}</p>
		<div style="background:#f0f0f0;padding:20px;border-radius:8px;text-align:center;margin:0 0 24px">
				<span style="font-size:32px;font-weight:700;letter-spacing:0.15em;color:#0a0a0a">${otp}</span>
		</div>
		<p style="margin:0;color:#aaa;font-size:11px">If you didn't request this, you can safely ignore this email.</p>
</body></html>`;
}

// 2026-07-30: viem's default mainnet RPC is unreliable for ENS
// lookups (saw 521 from eth.llamarpc.com on a fresh install). Honor a
// configurable RPC URL (ETH_RPC_URL) and fall back to the public
// defaults. This matters because the SIWE plugin calls this client
// on every wallet sign-in — a flaky RPC means failed sign-ups with
// a confusing 500.
const ensRpcUrl =
	config.ETH_RPC_URL ?? "https://cloudflare-eth.com";
const ensClient = createPublicClient({
	chain: mainnet,
	transport: http(ensRpcUrl),
});

// SECURITY (audit 1.1): treat `preview` as production for cookie
// security. Preview deployments ship with a real domain and HTTPS,
// so insecure cookies (secure:false) leak the session token on every
// non-HTTPS hop. Dev-only environments keep secure:false so localhost
// HTTP works.
const isSecureCookieEnv =
	config.NODE_ENV === "production" || config.NODE_ENV === "preview";

export const auth = betterAuth({
	baseURL: config.BETTER_AUTH_URL ?? config.PUBLIC_APP_URL ?? "http://localhost:3000",
	secret: config.BETTER_AUTH_SECRET,
	database: drizzleAdapter(db, { provider: "pg", schema }),

	databaseHooks: {
		// SECURITY (audit 1.3 / CRITICAL): Record the free-trial grant
		// against the *email*, not the user row. FK cascade on user
		// delete used to wipe creditBalances, letting an attacker
		// sign-up → delete → re-signup the same email to farm $1 per
		// cycle. The creditGrants table has a unique index on
		// (lower(email), grantType) so the trial is one-shot per email.
		user: {
			create: {
				after: async (createdUser) => {
					const freeTrialCents = Number(config.FREE_SIGNUP_CENTS ?? 0);
					if (freeTrialCents <= 0) return;
					const email = (createdUser as { email?: string | null }).email ?? "";
					if (!email) return;
					await grantFreeTrialOnce(email, freeTrialCents, createdUser.id);
				},
			},
		},
	},

user: {
		additionalFields: {
			evmAddress: {
				type: "string",
				required: false,
				input: false,
			},
			isAnonymous: {
				type: "boolean",
				required: false,
				input: false,
				defaultValue: false,
			},
		},
	},

		session: {
				expiresIn: 60 * 60 * 24 * 7, // 7 days
				updateAge: 60 * 60 * 24, // refresh once per day
				cookieCache: {
						enabled: true,
						maxAge: 60,
				},
		},

		emailAndPassword: {
				enabled: false,
		},

		// Account linking — DISABLED.
		//
		// SECURITY (audit 1.4 / 6.1): accountLinking.enabled was previously
		// true with trustedProviders: ["siwe", "credential"]. The bridge was
		// a NO-OP for SIWE because wallet-derived emails ({address}@oma-ai.com)
		// never match a real account email — implicit linking only ever fired
		// for the "credential" provider (password, never enabled in this app).
		// Keeping it enabled surfaced a phantom attack surface in the security
		// model without any actual functionality. A future "Connect wallet"
		// flow must use an explicit, signed-in endpoint (server-side FK) — not
		// better-auth's implicit trusted-provider matching.
		account: {
				accountLinking: {
						enabled: false,
				},
		},

		trustedOrigins: [
				...(config.PUBLIC_APP_URL ? [config.PUBLIC_APP_URL] : []),
				"http://localhost:3000",
				"http://127.0.0.1:3000",
				"http://localhost:3123",
				"http://127.0.0.1:3123",
		],

		advanced: {
				cookiePrefix: "oma",
				// SECURITY (audit 1.1): treat `preview` as production for cookie
				// security. Preview deployments ship with a real domain and HTTPS,
				// so insecure cookies (secure:false) leak the session token on every
				// non-HTTPS hop. Dev-only environments keep secure:false so localhost
				// HTTP works.
				useSecureCookies: isSecureCookieEnv,
				defaultCookieAttributes: {
						httpOnly: true,
						sameSite: "lax",
						secure: isSecureCookieEnv,
						path: "/",
				},
				...(isSecureCookieEnv && config.PUBLIC_APP_URL?.includes(".")
						? {
										crossSubDomainCookies: {
												enabled: true,
												domain: config.PUBLIC_APP_URL.replace(/^https?:\/\//, "").split("/")[0],
										},
								}
						: {}),
				// Dev: share cookies across ports (3000 frontend + 3001 backend) so
				// sign-in works on both. Production/preview set the explicit domain
				// above; dev stays on host-only cookies. Setting sameSite: "lax" +
				// secure:false lets the browser send cookies over http on localhost.
				...(!isSecureCookieEnv
						? {
										defaultCookieAttributes: {
												httpOnly: true,
												sameSite: "lax",
												secure: false,
												path: "/",
										},
								}
						: {}),
		},

		plugins: [
				magicLink({
						sendMagicLink,
						expiresIn: 60 * 5,
						disableSignUp: false,
				}),

				siwe({
						domain: config.PRIMARY_DOMAIN ?? "oma-ai.com",
						emailDomainName: "oma-ai.com",
						// Wallet-only signups don't need an email. The wallet address is
						// already a strong identity signal; we attach it to the user row
						// via the additionalField on `user.evmAddress`.
						anonymous: true,
						getNonce: async () => {
								return generateRandomString(32, "a-z", "A-Z", "0-9");
						},
						verifyMessage: async ({ message, signature, address }: { message: string; signature: string; address: string }) => {
								try {
										const valid = await verifyMessage({
												address: getAddress(address) as `0x${string}`,
												message,
												signature: signature as `0x${string}`,
										});
										return !!valid;
								} catch (err) {
										logger.warn({ err, address }, "[siwe] verifyMessage failed");
										return false;
								}
						},
						ensLookup: async ({ walletAddress }: { walletAddress: string }) => {
								try {
										const ensName = await ensClient.getEnsName({
												address: getAddress(walletAddress),
										});
										const ensAvatar = ensName
												? await ensClient.getEnsAvatar({ name: ensName })
												: null;
										return {
												name: ensName ?? "",
												avatar: ensAvatar ?? "",
										};
								} catch {
										return { name: "", avatar: "" };
								}
						},
				}),

				admin({
						defaultRole: "user",
						adminRoles: ["admin"],
				}),

				// Email OTP — passwordless sign-in, email verification, and password reset.
				// Uses the same Resend API key as magicLink for sending OTP emails.
				emailOTP({
						async sendVerificationOTP({ email, otp, type }) {
								const cooldown = await checkEmailSendCooldown(email, "otp");
								if (!cooldown.ok) {
										throw new Error(
												`An OTP was sent to this address ${cooldown.retryAfter}s ago. Please wait before requesting another.`,
										);
								}
								if (!config.RESEND_API_KEY) {
										// SECURITY (audit 1.5): never log the OTP code in non-development
										// envs. A misconfigured `NODE_ENV=preview` otherwise leaks the
										// OTP to server logs and breaks the email-OTP threat model.
										if (config.NODE_ENV === "development") {
												logger.info(
														{ email, otp, type },
														"[emailOTP] (dev) no RESEND_API_KEY — OTP not sent",
												);
												return;
										}
										logger.error(
												{ email, type },
												"[emailOTP] RESEND_API_KEY is not configured; refusing to send OTP",
										);
										throw new Error("OTP delivery is not configured");
								}
								const res = await fetch("https://api.resend.com/emails", {
										method: "POST",
										headers: {
												Authorization: `Bearer ${config.RESEND_API_KEY}`,
												"Content-Type": "application/json",
										},
										body: JSON.stringify({
												from: RESEND_FROM,
												to: email,
												subject:
														type === "forget-password"
																? "Reset your OMA-AI password"
																: type === "email-verification"
																		? "Verify your OMA-AI email"
																		: "Sign in to OMA-AI",
												html: renderOTPEmail(email, otp, type),
												text: `Your OMA-AI ${type} code is: ${otp}`,
										}),
								});
								if (!res.ok) {
										const body = await res.text().catch(() => "");
										logger.error(
												{ email, type, status: res.status, body },
												"[emailOTP] Resend send failed",
										);
										throw new Error(`Resend send failed: ${res.status}`);
								}
						},
						changeEmail: {
								enabled: true,
								verifyCurrentEmail: true,
						},
				}),

				// Agent Auth — programmatic agent authentication with capability-based access control.
				agentAuthPlugin({
						providerName: "OMA-AI",
						providerDescription: "OMA-AI inference gateway — discover and inspect AI models via the Agent Auth Protocol.",
						modes: ["delegated", "autonomous"],
						capabilities: [
								{
										name: "list_models",
										description: "List all available AI inference models with provider, context window, and pricing.",
								},
								{
										name: "get_model",
										description: "Get details for a single AI inference model by its id.",
										input: {
												type: "object",
												properties: {
														modelId: { type: "string", description: "The model id, e.g. 'deepseek-v4-flash-0731-openbroker'." },
												},
												required: ["modelId"],
										},
								},
						],
						async onExecute({ capability, arguments: args }) {
								await ensureCatalogLoaded();
								const serialize = (m: ReturnType<typeof listAllModels>[number]) => ({
										id: m.id,
										provider: m.provider ?? "oma",
										context_length: m.contextWindow ?? 0,
										supports_streaming: m.supportsStreaming,
										supports_tools: m.capabilities?.includes("tools") ?? false,
										pricing: { prompt: m.inputPricePer1M, completion: m.outputPricePer1M },
								});
								switch (capability) {
										case "list_models":
												return listAllModels().map(serialize);
										case "get_model": {
												const model = listAllModels().find((x) => x.id === String(args?.modelId));
												if (!model) throw new Error(`Model not found: ${String(args?.modelId)}`);
												return serialize(model);
										}
										default:
												throw new Error(`Unsupported capability: ${capability}`);
								}
						},
				}),
		],
});

