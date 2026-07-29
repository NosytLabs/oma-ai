/**
 * Better Auth — single source of truth for OMA-AI user authentication.
 *
 * Plugins:
 *   - magicLink:  passwordless email sign-in via Resend (dev: console.log fallback)
 *   - siwe:       Sign-In With Ethereum (EIP-4361) — binds a wallet to the
 *                 user row and recovers ENS names + avatars via viem.
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
} from "better-auth/plugins";
import { verifyMessage, createPublicClient, http, getAddress } from "viem";
import { mainnet } from "viem/chains";
import { generateRandomString } from "better-auth/crypto";
import { db } from "./db/client.js";
import * as schema from "./db/schema.js";
import { config } from "./config.js";
import { logger } from "./lib/logger.js";

const RESEND_FROM = config.RESEND_FROM ?? "OMA-AI <noreply@oma-ai.com>";

async function sendMagicLink({
	email,
	url,
}: {
	email: string;
	url: string;
	token: string;
	metadata?: Record<string, unknown>;
}): Promise<void> {
	if (!config.RESEND_API_KEY) {
		logger.info(
			{ email, magicLink: url },
			"[magicLink] (dev) no RESEND_API_KEY set — click the URL to sign in",
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
			subject: "Sign in to OMA-AI",
			html: renderMagicLinkEmail(url),
			text: `Sign in to OMA-AI\n\nClick this link to sign in (expires in 5 minutes):\n${url}\n\nIf you didn't request this, ignore this email.`,
		}),
	});
	if (!res.ok) {
		const body = await res.text();
		throw new Error(`[magicLink] Resend ${res.status}: ${body}`);
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

const ensClient = createPublicClient({ chain: mainnet, transport: http() });

export const auth = betterAuth({
	baseURL: config.BETTER_AUTH_URL ?? config.PUBLIC_APP_URL ?? "http://localhost:3000",
	secret: config.BETTER_AUTH_SECRET,
	database: drizzleAdapter(db, { provider: "pg", schema }),

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

  trustedOrigins: [
    ...(config.PUBLIC_APP_URL ? [config.PUBLIC_APP_URL] : []),
    "http://localhost:3000",
    "http://127.0.0.1:3000",
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
    ...(config.PUBLIC_APP_URL?.includes(".")
      ? {
          crossSubDomainCookies: {
            enabled: true,
            domain: config.PUBLIC_APP_URL.replace(/^https?:\/\//, "").split("/")[0],
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
            address: getAddress(address),
            message,
            signature: signature as `0x${string}`,
          });
          return valid;
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
  ],
});

export type Auth = typeof auth;
export type AuthSession = Auth["$Infer"]["Session"];
