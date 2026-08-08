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
import { db } from "./db/client.js";
import * as schema from "./db/schema.js";
import { creditBalances } from "./db/schema.js";
import { config } from "./config.js";
import { logger } from "./lib/logger.js";
import { ensureCatalogLoaded, listAllModels } from "./inference/models.js";

const RESEND_FROM = config.RESEND_FROM ?? "OMA-AI <noreply@nosytlabs.com>";

async function sendMagicLink({
	email,
	url,
}: {
	email: string;
	url: string;
	token: string;
	metadata?: Record<string, unknown>;
}): Promise<void> {
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
    <a href="${url}" style="display:inline-block;background:#10b981;color:#0a0a0a;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Sign in →</a>
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

export const auth = betterAuth({
	baseURL: config.BETTER_AUTH_URL ?? config.PUBLIC_APP_URL ?? "http://localhost:3000",
	secret: config.BETTER_AUTH_SECRET,
	database: drizzleAdapter(db, { provider: "pg", schema }),

	databaseHooks: {
		// Seed the user's credit balance on first sign-in so they have
		// something to spend before they hit a deposit path. Without this,
		// /v1/balance returns 0 forever and the user silently bypasses
		// billing (proxy.ts used to read the row and skip the deduction
		// when no row existed — fixed in 2026-07-30 audit).
		user: {
			create: {
				after: async (createdUser) => {
					const freeTrialCents = String(config.FREE_SIGNUP_CENTS ?? 0);
					if (Number(freeTrialCents) <= 0) return;
					try {
						await db
							.insert(creditBalances)
							.values({
								userId: createdUser.id,
								balanceCents: freeTrialCents,
								totalDepositedCents: freeTrialCents,
								totalUsedCents: "0",
							})
							.onConflictDoNothing();
					} catch (err) {
						logger.warn(
							{ err, userId: createdUser.id },
							"[auth] failed to seed free-trial credit balance",
						);
					}
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

  // Account linking — lets a wallet (SIWE) identity and an email (magic-link
  // / email-OTP) identity resolve to ONE account instead of two siloed users.
  // Linking is implicit at sign-in: when a trusted provider's verified email
  // matches an existing verified local account, better-auth attaches the new
  // identity to that account rather than creating a duplicate. There is NO
  // standalone /link-account endpoint — it happens inside the sign-in flow.
  // requireLocalEmailVerified defaults true → no account takeover. NOTE: SIWE
  // mints wallet-derived emails ({address}@oma-ai.com) that never match a real
  // email, so merging a wallet INTO an existing email account needs a signed-in
  // "connect wallet" flow on the frontend, not implicit linking.
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["siwe", "credential"],
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
    useSecureCookies: config.NODE_ENV === "production",
    defaultCookieAttributes: {
      httpOnly: true,
      sameSite: "lax",
      secure: config.NODE_ENV === "production",
      path: "/",
    },
    ...(config.NODE_ENV === "production" && config.PUBLIC_APP_URL?.includes(".")
      ? {
          crossSubDomainCookies: {
            enabled: true,
            domain: config.PUBLIC_APP_URL.replace(/^https?:\/\//, "").split("/")[0],
          },
        }
      : {}),
    // Dev: share cookies across ports (3000 frontend + 3001 backend) so
    // sign-in works on both. Production sets the explicit domain above;
    // dev stays on host-only cookies. Setting sameSite: "lax" + secure:false
    // lets the browser send cookies over http on localhost.
    ...(config.NODE_ENV !== "production"
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
        if (!config.RESEND_API_KEY) {
          logger.info(
            { email, otp, type },
            "[emailOTP] (dev) no RESEND_API_KEY — OTP not sent",
          );
          return;
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
              modelId: { type: "string", description: "The model id, e.g. 'gemini-3-flash-preview'." },
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

type Auth = typeof auth;
export type AuthSession = Auth["$Infer"]["Session"];
