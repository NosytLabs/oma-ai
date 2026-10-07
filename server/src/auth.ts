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
import { createAuthMiddleware } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import {
	magicLink,
	siwe,
	emailOTP,
	admin,
} from "better-auth/plugins";
import { createPublicClient, http, getAddress } from "viem";
import { mainnet } from "viem/chains";
import { verifySiweSignature } from "./lib/siwe-verify.js";
import { generateRandomString } from "better-auth/crypto";
import { sql } from "drizzle-orm";
import { db } from "./db/client.js";
import * as schema from "./db/schema.js";
import { creditBalances, creditGrants } from "./db/schema.js";
import { config } from "./config.js";
import { logger } from "./lib/logger.js";

import { getRedisClient } from "./lib/redis-client.js";

const RESEND_FROM = config.RESEND_FROM ?? "OMA-AI <noreply@oma-ai.com>";

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
		const set = await redis.set(key, "1", { nx: true, ex: EMAIL_SEND_COOLDOWN_SECONDS });
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
		// Both production drivers support transactions. Keep the durable grant
		// and balance together so a failed credit cannot consume the trial.
		return await db.transaction(async (tx) => {
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
				return false;
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
			return true;
		});
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

function renderOTPEmail(otp: string, type: string): string {
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
	transport: http(ensRpcUrl, { timeout: 3_000, retryCount: 0 }),
});

// SECURITY (audit 1.1): treat `preview` as production for cookie
// security. Preview deployments ship with a real domain and HTTPS,
// so insecure cookies (secure:false) leak the session token on every
// non-HTTPS hop. Dev-only environments keep secure:false so localhost
// HTTP works.
//
// This is an allow-list of the environments that are *definitely* local
// HTTP, rather than an enumeration of the ones that are secure. The old
// form (`production` or `preview`) meant any environment added later —
// `staging` was the one that actually shipped — silently defaulted to
// secure:false on a real HTTPS host. Fail closed instead: anything that
// is not explicitly local development or test gets Secure cookies.
export function shouldUseSecureCookies(nodeEnv: string | undefined): boolean {
	return nodeEnv !== "development" && nodeEnv !== "test";
}

const isSecureCookieEnv = shouldUseSecureCookies(config.NODE_ENV);

/** Environment fields the origin resolvers read. */
export interface AuthOriginConfig {
	BETTER_AUTH_URL?: string | undefined;
	PUBLIC_APP_URL?: string | undefined;
	PRIMARY_DOMAIN?: string | undefined;
	NODE_ENV?: string | undefined;
}

/**
 * Strip scheme, path, port and case from a configured domain.
 *
 * Single source of truth: the trusted-origin list, the auth base URL and the
 * SIWE domain previously each normalized PRIMARY_DOMAIN by hand, and the
 * copies had already drifted (only one of them treated `::1` as local).
 */
function normalizePrimaryDomain(raw: string | undefined): string {
	if (!raw?.trim()) return "";
	try {
		const value = raw.trim();
		return new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`).hostname.toLowerCase();
	} catch {
		return "";
	}
}

/** True when a normalized domain refers to the local machine, not a site. */
function isLocalDomain(domain: string): boolean {
	if (!domain) return true;
	if (domain === "::1" || domain === "[::1]") return true;
	if (domain === "localhost" || domain.endsWith(".localhost")) return true;
	if (/^127\./.test(domain)) return true;
	return false;
}

/**
 * The canonical public origins for a real domain: apex and www.
 *
 * Deriving these from PRIMARY_DOMAIN is what stops a stale PUBLIC_APP_URL from
 * locking real users out of sign-in (a misconfigured localhost value used to
 * make Better Auth 403 the live site with INVALID_ORIGIN). Only real,
 * non-local domains get fabricated https origins; dev keeps its explicit
 * localhost list below.
 */
export function resolveTrustedOrigins(input: AuthOriginConfig): string[] {
	const isProd = shouldUseSecureCookies(input.NODE_ENV);
	const origins = new Set<string>();

	// The configured app origin (dev/preview/staging deployments).
	if (input.PUBLIC_APP_URL) {
		try {
			const appUrl = new URL(input.PUBLIC_APP_URL);
			if (["http:", "https:"].includes(appUrl.protocol) && (!isProd || !isLocalDomain(appUrl.hostname))) {
				origins.add(appUrl.origin);
			}
		} catch {
			// Ignore malformed optional app URLs; PRIMARY_DOMAIN remains canonical.
		}
	}

	const domain = normalizePrimaryDomain(input.PRIMARY_DOMAIN);
	if (isProd && !isLocalDomain(domain)) {
		const apex = domain.replace(/^www\./, "");
		origins.add(`https://${apex}`);
		origins.add(`https://www.${apex}`);
	}

	// Local dev/preview ports, retained so local sign-in keeps working.
	// SECURITY (audit): only add localhost when the environment is actually
	// local (non-secure-cookie env = development/test). Trusting localhost in
	// production/staging/preview means any process able to serve content on
	// localhost — or a DNS-rebinding-style host — is a trusted origin for
	// magic-link, OTP and SIWE endpoints on the live site.
	if (!isProd) {
		origins.add("http://localhost:3000");
		origins.add("http://127.0.0.1:3000");
		origins.add("http://localhost:3123");
		origins.add("http://127.0.0.1:3123");
	}

	return [...origins];
}

/**
 * The base URL Better Auth uses to build callback URLs (magic-link redirects,
 * email verification links).
 *
 * Must resolve to the SAME canonical origin as resolveTrustedOrigins: if the
 * two disagree, a link can be accepted for sending yet emailed pointing
 * somewhere unusable. In a deployed environment PRIMARY_DOMAIN wins, with
 * OMA's apex normalized to www; explicit custom and preview hosts stay intact.
 */
export function resolveAuthBaseURL(input: AuthOriginConfig): string {
	const isProd = shouldUseSecureCookies(input.NODE_ENV);
	const domain = normalizePrimaryDomain(input.PRIMARY_DOMAIN);
	if (isProd && !isLocalDomain(domain)) {
		// Only OMA's apex redirects to www. Keep explicit preview/custom hosts.
		return `https://${domain === "oma-ai.com" ? "www.oma-ai.com" : domain}`;
	}
	return input.BETTER_AUTH_URL ?? input.PUBLIC_APP_URL ?? "http://localhost:3000";
}

/**
 * Canonical better-auth base URL (host + scheme). Exported so other modules
 * that must bind a client-supplied SIWE message to our own origin — currently
 * routes/auth.ts's POST /v1/user/attach-wallet — derive the expected domain
 * from the same value the siwe plugin uses, instead of re-implementing the
 * prod-redirect rule and drifting from it.
 */
export const authBaseURL = resolveAuthBaseURL(config);
const authHostname = new URL(authBaseURL).hostname;

export const auth = betterAuth({
	baseURL: authBaseURL,
	secret: config.BETTER_AUTH_SECRET,
	database: drizzleAdapter(db, { provider: "pg", schema }),

	// SIWE creates the user and wallet binding only AFTER verifyMessage returns.
	// Bind the application profile to that completed identity, never an email
	// guessed from a request address (email ownership does not prove a wallet).
	hooks: {
		after: createAuthMiddleware(async (ctx) => {
			if (ctx.path !== "/siwe/verify") return;
			const result = ctx.context.returned as {
				success?: boolean;
				user?: { id: string; walletAddress: string; chainId: number };
			} | undefined;
			const session = ctx.context.newSession;
			if (!result?.success || !result.user || !session || result.user.id !== session.user.id) return;
			try {
				const address = getAddress(result.user.walletAddress);
				const binding = await ctx.context.adapter.findOne<{ userId: string }>({
					model: "walletAddress",
					where: [
						{ field: "userId", value: session.user.id },
						{ field: "address", value: address },
						{ field: "chainId", value: result.user.chainId },
					],
				});
				if (!binding || (session.user.evmAddress && session.user.evmAddress !== address)) return;
				const user = await ctx.context.internalAdapter.updateUser(session.user.id, { evmAddress: address });
				// The endpoint has already cached the pre-update user. Replace it so
				// the very first get-session sees the verified wallet.
				await setSessionCookie(ctx, { session: session.session, user });
			} catch (err) {
				logger.warn({ err, userId: session.user.id }, "[siwe] failed to persist verified wallet profile");
			}
		}),
	},

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
				// Settings can revoke sessions and delete accounts at any time.
				// Always consult the session store so a copied cookie cannot remain
				// authenticated after revocation (including Better Auth endpoints).
				cookieCache: { enabled: false },
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

		// Built from PUBLIC_APP_URL *and* the canonical apex/www pair derived
		// from PRIMARY_DOMAIN — see resolveTrustedOrigins for the live outage
		// this prevents.
		trustedOrigins: resolveTrustedOrigins({
			PUBLIC_APP_URL: config.PUBLIC_APP_URL,
			PRIMARY_DOMAIN: config.PRIMARY_DOMAIN,
			NODE_ENV: config.NODE_ENV,
		}),

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
				...(isSecureCookieEnv && !isLocalDomain(authHostname)
						? {
										crossSubDomainCookies: {
												enabled: true,
												domain: authHostname,
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

		// NOTE: `@better-auth/agent-auth` used to be registered here and is
		// deliberately NOT re-added yet. It requires four tables that have never
		// been migrated — `agent`, `agentHost`, `agentCapabilityGrant`,
		// `approvalRequest` — and Better Auth validates the whole plugin schema
		// when betterAuth() is constructed, not per route. Registering it without
		// those tables made EVERY auth call throw a "Drizzle schema mismatch"
		// and took production sign-in/sign-up offline.
		// Model discovery is unaffected: GET /api/v1/models is public.
		// Re-enable only after migrating all four tables — see
		// src/__tests__/agent-auth-gating.test.ts, which guards this.
		plugins: [
				magicLink({
					sendMagicLink,
					expiresIn: 60 * 5,
					disableSignUp: false,
					// SECURITY: better-auth's magicLink plugin defaults
					// `storeToken` to "plain", which persists the sign-in token
					// verbatim in the verification table. A read-only DB leak
					// (backup, replica, SQLi, a stray pg_dump) would then hand
					// an attacker every live magic link — a password reset token
					// by another name. "hashed" stores a digest instead, so the
					// stored value cannot be replayed.
					storeToken: "hashed",
				}),

			siwe({
					domain: new URL(authBaseURL).host,
					emailDomainName: "oma-ai.com",
						// Wallet-only signups don't need an email. The wallet address is
						// already a strong identity signal; we attach it to the user row
						// via the additionalField on `user.evmAddress`.
						anonymous: true,
						getNonce: async () => {
								return generateRandomString(32, "a-z", "A-Z", "0-9");
						},
						// Delegates to lib/siwe-verify.ts so sign-in and
											// POST /v1/user/attach-wallet cannot drift apart on what
											// counts as a valid signature.
											verifyMessage: async ({ message, signature, address }: { message: string; signature: string; address: string }) => {
												try {
													await verifySiweSignature({ address, message, signature });
													return true;
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
					// SECURITY (audit): mirror magicLink's `storeToken: "hashed"`.
					// The emailOTP plugin default is `storeOTP: "plain"` (verified in
					// node_modules/better-auth/dist/plugins/email-otp/index.mjs:16),
					// which persists OTP codes verbatim in the verification table.
					// A read-only DB leak (backup, replica, SQLi) would hand an
					// attacker every live OTP / reset code. Store a digest instead
					// so the stored value can never be replayed.
					storeOTP: "hashed",
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
												html: renderOTPEmail(otp, type),
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

		],
});
